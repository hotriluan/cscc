import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app';
import { dataStore } from '../src/store/data-store';
import type { ProjectRevision, RevisionStatusHistoryEntry } from '@cscc/shared';

describe('Revision Status (DRAFT / APPROVED / INACTIVE), RBAC, Mandatory Reason & Auto-Supersede Audit History', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    await dataStore.init(true);
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4098;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) server.close();
    await dataStore.init(true);
    await dataStore.disconnect();
  });

  it('1. Enforces RBAC (403 FORBIDDEN_STATUS_CHANGE) for TECHNICAL and SALES roles', async () => {
    for (const role of ['TECHNICAL', 'SALES']) {
      const res = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          status: 'APPROVED',
          note: 'Attempt by unauthorized role'
        })
      });
      assert.equal(res.status, 403, `Expected 403 for role ${role}`);
      const body = (await res.json()) as { error: string; message: string };
      assert.equal(body.error, 'FORBIDDEN_STATUS_CHANGE');
    }
  });

  it('2. Requires a non-empty reason (400 REASON_REQUIRED) when PROJECT_LEADER or ADMIN changes status', async () => {
    for (const role of ['PROJECT_LEADER', 'ADMIN']) {
      const emptyRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role
        },
        body: JSON.stringify({
          status: 'APPROVED',
          note: '   '
        })
      });
      assert.equal(emptyRes.status, 400, `Expected 400 for empty note as ${role}`);
      const emptyBody = (await emptyRes.json()) as { error: string; message: string };
      assert.equal(emptyBody.error, 'REASON_REQUIRED');
    }
  });

  it('3. Blocks direct transition from DRAFT to INACTIVE (400 INVALID_STATUS_TRANSITION)', async () => {
    const res = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        status: 'INACTIVE',
        note: 'Try to deactivate a draft revision directly'
      })
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string; message: string };
    assert.equal(body.error, 'INVALID_STATUS_TRANSITION');
  });

  it('4. Allows valid transitions DRAFT -> APPROVED -> INACTIVE and records RevisionStatusHistory entries', async () => {
    // Step 4a: PROJECT_LEADER approves Rev 00 (DRAFT -> APPROVED)
    const approveRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        status: 'APPROVED',
        note: 'Initial approval of Rev 00 for NITORI'
      })
    });
    assert.equal(approveRes.status, 200);
    const approvedRev = (await approveRes.json()) as ProjectRevision;
    assert.equal(approvedRev.status, 'APPROVED');

    // Step 4b: ADMIN marks Rev 00 as INACTIVE (APPROVED -> INACTIVE)
    const inactiveRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'ADMIN'
      },
      body: JSON.stringify({
        status: 'INACTIVE',
        note: 'Customer paused production for this color'
      })
    });
    assert.equal(inactiveRes.status, 200);
    const inactiveRev = (await inactiveRes.json()) as ProjectRevision;
    assert.equal(inactiveRev.status, 'INACTIVE');

    // Verify status history via GET /api/revisions/:id/status-history (accessible by TECHNICAL too)
    const historyRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status-history`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(historyRes.status, 200);
    const history = (await historyRes.json()) as RevisionStatusHistoryEntry[];
    assert.ok(history.length >= 2);
    // Ordered newest first
    assert.equal(history[0].fromStatus, 'APPROVED');
    assert.equal(history[0].toStatus, 'INACTIVE');
    assert.equal(history[0].changedByRole, 'ADMIN');
    assert.equal(history[0].note, 'Customer paused production for this color');
    assert.equal(history[0].isAutoSupersede, false);

    assert.equal(history[1].fromStatus, 'DRAFT');
    assert.equal(history[1].toStatus, 'APPROVED');
    assert.equal(history[1].changedByRole, 'PROJECT_LEADER');
    assert.equal(history[1].note, 'Initial approval of Rev 00 for NITORI');
    assert.equal(history[1].isAutoSupersede, false);
  });

  it('5. Auto-supersedes existing APPROVED sibling revisions to INACTIVE when approving a new revision in the same Project', async () => {
    // Re-activate Rev 00 back to APPROVED
    const reApproveRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        status: 'APPROVED',
        note: 'Re-activating Rev 00 as active production baseline'
      })
    });
    assert.equal(reApproveRes.status, 200);

    // Clone Rev 00 -> Rev 01 (starts as DRAFT)
    const cloneRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/clone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'TECHNICAL'
      },
      body: JSON.stringify({ note: 'Rev 01 updated coating formula' })
    });
    assert.equal(cloneRes.status, 201);
    const rev01 = (await cloneRes.json()) as ProjectRevision;
    assert.equal(rev01.revisionNo, 1);
    assert.equal(rev01.status, 'DRAFT');

    // Approve Rev 01 -> should automatically transition Rev 00 from APPROVED to INACTIVE
    const approveRev01Res = await fetch(`${baseUrl}/api/revisions/${rev01.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        status: 'APPROVED',
        note: 'Approve Rev 01 to replace Rev 00'
      })
    });
    assert.equal(approveRev01Res.status, 200);
    const approvedRev01 = (await approveRev01Res.json()) as ProjectRevision;
    assert.equal(approvedRev01.status, 'APPROVED');

    // Check Rev 00 is now INACTIVE and has an auto-supersede history entry
    const rev00Res = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(rev00Res.status, 200);
    const rev00After = (await rev00Res.json()) as ProjectRevision;
    assert.equal(rev00After.status, 'INACTIVE');
    assert.ok(rev00After.statusHistory && rev00After.statusHistory.length >= 4);

    const latestRev00History = rev00After.statusHistory![0];
    assert.equal(latestRev00History.fromStatus, 'APPROVED');
    assert.equal(latestRev00History.toStatus, 'INACTIVE');
    assert.equal(latestRev00History.isAutoSupersede, true);
    assert.ok(latestRev00History.note.includes('Rev 01'));
  });

  it('6. Enforces immutability on INACTIVE revisions (blocks PUT, DELETE, refresh-prices; allows clone)', async () => {
    // Rev 00 is currently INACTIVE from test 5
    const getRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    const rev00 = (await getRes.json()) as ProjectRevision;
    assert.equal(rev00.status, 'INACTIVE');

    // 6a: PUT /api/revisions/:id should be rejected with 400
    const putRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        productName: 'Tampered Product Name',
        steps: rev00.steps
      })
    });
    assert.equal(putRes.status, 400);

    // 6b: DELETE /api/revisions/:id should be rejected with 400
    const delRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'ADMIN' }
    });
    assert.equal(delRes.status, 400);

    // 6c: POST /api/revisions/:id/refresh-prices should be rejected with 400
    const refreshRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/refresh-prices`, {
      method: 'POST',
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(refreshRes.status, 400);

    // 6d: POST /api/revisions/:id/clone on INACTIVE revision is allowed (201 Created)
    const cloneRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/clone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'TECHNICAL'
      },
      body: JSON.stringify({ note: 'Clone from INACTIVE Rev 00 into Rev 02' })
    });
    assert.equal(cloneRes.status, 201);
    const rev02 = (await cloneRes.json()) as ProjectRevision;
    assert.equal(rev02.revisionNo, 2);
    assert.equal(rev02.status, 'DRAFT');
  });
});
