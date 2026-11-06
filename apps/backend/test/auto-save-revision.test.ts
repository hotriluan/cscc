import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app';
import { dataStore } from '../src/store/data-store';
import type { ProjectRevision, ScheduleStep } from '@cscc/shared';

describe('Coating Schedule Smart Auto-Save: Stable Step/Item IDs & Lightweight Draft Persistence', () => {
  let server: http.Server;
  let baseUrl = '';

  before(async () => {
    await dataStore.init(true);
    const app = createApp();
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 4099;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) server.close();
    await dataStore.init(true);
    await dataStore.disconnect();
  });

  it('1. Preserves deterministic step.id and item.id across multiple consecutive auto-saves', async () => {
    // Create a fresh DRAFT project
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        projectCode: 'AUTO-SAVE-01',
        customerId: '1200001169',
        productName: 'AUTO SAVE TABLE',
        colorName: 'WALNUT',
        substrate: 'OAK',
        finishingSystem: 'PU'
      })
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as { revision: ProjectRevision };
    const revId = created.revision.id;

    const clientStepId = `${revId}-step-custom-abc123`;
    const clientItemId1 = `${clientStepId}-item-1`;
    const clientItemId2 = `${clientStepId}-item-custom-xyz789`;
    const clientSandingId = `${revId}-sanding-custom-snd456`;

    const draftSteps: ScheduleStep[] = [
      {
        id: clientStepId,
        stepOrder: 1,
        stepNumber: 1,
        rowType: 'CHEMICAL_STEP',
        stepName: 'STAIN',
        sandingSpec: null,
        visco: '12',
        caInputRaw: '50-60',
        caMin: 50,
        caMax: 60,
        caAvg: 55,
        methodName: 'SPRAY',
        efficiencySnapshot: 0.6,
        dryingTime: '30 mins',
        stepRemark: null,
        items: [
          {
            id: clientItemId1,
            stepId: clientStepId,
            itemOrder: 1,
            materialCode: '231-0317T0.75',
            materialName: 'STAIN MATERIAL A',
            packingDesc: '0.75 KG',
            nettWeight: 0.75,
            mixingRatio: 1,
            visco: '12',
            priceSnapshotVnd: 150000
          },
          {
            id: clientItemId2,
            stepId: clientStepId,
            itemOrder: 2,
            materialCode: '240-0016T20',
            materialName: 'THINNER B',
            packingDesc: '20 KG',
            nettWeight: 20,
            mixingRatio: 4,
            visco: null,
            priceSnapshotVnd: 65000
          }
        ]
      },
      {
        id: clientSandingId,
        stepOrder: 2,
        stepNumber: null,
        rowType: 'SANDING',
        stepName: 'SANDING',
        sandingSpec: 'SANDING #320',
        visco: null,
        caInputRaw: null,
        caMin: null,
        caMax: null,
        caAvg: null,
        methodName: null,
        efficiencySnapshot: null,
        dryingTime: null,
        stepRemark: null,
        items: []
      }
    ];

    // First auto-save (e.g. discrete step/item insertion)
    const putRes1 = await fetch(`${baseUrl}/api/revisions/${revId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        productName: 'AUTO SAVE TABLE V1',
        steps: draftSteps
      })
    });
    assert.equal(putRes1.status, 200);
    const body1 = (await putRes1.json()) as {
      revision: ProjectRevision;
      costSummary: { totalCoatingCostDisplay: number } | null;
    };

    assert.equal(body1.revision.steps.length, 2);
    assert.equal(body1.revision.steps[0].id, clientStepId);
    assert.equal(body1.revision.steps[0].items[0].id, clientItemId1);
    assert.equal(body1.revision.steps[0].items[1].id, clientItemId2);
    assert.equal(body1.revision.steps[1].id, clientSandingId);

    // Second auto-save (e.g. typing change on CA and product name)
    draftSteps[0].caInputRaw = '80-100';
    const putRes2 = await fetch(`${baseUrl}/api/revisions/${revId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'PROJECT_LEADER'
      },
      body: JSON.stringify({
        productName: 'AUTO SAVE TABLE V2',
        steps: draftSteps
      })
    });
    assert.equal(putRes2.status, 200);
    const body2 = (await putRes2.json()) as {
      revision: ProjectRevision;
      costSummary: { totalCoatingCostDisplay: number } | null;
    };

    // IDs must remain 100% identical across saves
    assert.equal(body2.revision.steps[0].id, clientStepId);
    assert.equal(body2.revision.steps[0].items[0].id, clientItemId1);
    assert.equal(body2.revision.steps[0].items[1].id, clientItemId2);
    assert.equal(body2.revision.steps[1].id, clientSandingId);
    assert.equal(body2.revision.steps[0].caAvg, 90);
    assert.ok(body2.costSummary && body2.costSummary.totalCoatingCostDisplay > 0);
  });

  it('2. Allows auto-saving incomplete / empty new steps and items while in DRAFT status', async () => {
    const getRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(getRes.status, 200);
    const rev = (await getRes.json()) as ProjectRevision;

    // Append an unconfigured chemical step (empty stepName, empty methodName, empty materialCode, 0 mixingRatio)
    // and an empty SANDING row — just like clicking "+ Add Step" and "Insert SANDING" in the UI
    const emptyChemStepId = `${rev.id}-step-empty-new`;
    const emptyItemId = `${emptyChemStepId}-item-1`;
    const emptySandingId = `${rev.id}-sanding-empty-new`;

    const nextSteps: ScheduleStep[] = [
      ...rev.steps,
      {
        id: emptyChemStepId,
        stepOrder: rev.steps.length + 1,
        stepNumber: 99,
        rowType: 'CHEMICAL_STEP',
        stepName: '',
        sandingSpec: null,
        visco: null,
        caInputRaw: '',
        caMin: null,
        caMax: null,
        caAvg: 0,
        methodName: '',
        efficiencySnapshot: null,
        dryingTime: '',
        stepRemark: null,
        items: [
          {
            id: emptyItemId,
            stepId: emptyChemStepId,
            itemOrder: 1,
            materialCode: '',
            materialName: '',
            packingDesc: null,
            nettWeight: null,
            mixingRatio: 0,
            visco: null,
            priceSnapshotVnd: 0
          }
        ]
      },
      {
        id: emptySandingId,
        stepOrder: rev.steps.length + 2,
        stepNumber: null,
        rowType: 'SANDING',
        stepName: 'SANDING',
        sandingSpec: '',
        visco: null,
        caInputRaw: null,
        caMin: null,
        caMax: null,
        caAvg: null,
        methodName: null,
        efficiencySnapshot: null,
        dryingTime: null,
        stepRemark: null,
        items: []
      }
    ];

    const putRes = await fetch(`${baseUrl}/api/revisions/${rev.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'TECHNICAL'
      },
      body: JSON.stringify({
        steps: nextSteps
      })
    });
    assert.equal(putRes.status, 200);
    const saved = (await putRes.json()) as { revision: ProjectRevision };
    assert.equal(saved.revision.steps.length, nextSteps.length);

    const savedEmptyChem = saved.revision.steps.find((s) => s.id === emptyChemStepId);
    assert.ok(savedEmptyChem, 'Empty chemical step should be persisted with its stable ID');
    assert.equal(savedEmptyChem.efficiencySnapshot, null);
    assert.equal(savedEmptyChem.items[0].id, emptyItemId);

    const savedEmptySanding = saved.revision.steps.find((s) => s.id === emptySandingId);
    assert.ok(savedEmptySanding, 'Empty sanding step should be persisted with its stable ID');
  });
});
