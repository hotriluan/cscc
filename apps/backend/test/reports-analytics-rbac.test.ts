import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import ExcelJS from 'exceljs';
import { ReportsOverviewResponse } from '@cscc/shared';
import { createApp } from '../src/app';
import { dataStore } from '../src/store/data-store';

describe('CSCC Reports & Analytics System — 7 Reports, Revision Scope, Salesman RBAC & Cost Redaction', () => {
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
    await dataStore.disconnect();
  });

  it('1. Product Usage Report & Customer Portfolio Report compute exact NTR 001 metrics for PROJECT_LEADER', async () => {
    const res = await fetch(`${baseUrl}/api/reports/overview`, {
      headers: { 'x-user-role': 'PROJECT_LEADER' }
    });
    assert.equal(res.status, 200);
    const overview = (await res.json()) as ReportsOverviewResponse;

    assert.ok(overview.productUsage.productCatalog.length > 0);
    assert.ok(overview.productUsage.usages.length >= 10);

    // Pick the first material in catalog and filter specifically by that materialCode
    const targetMat = overview.productUsage.productCatalog[0];
    const filteredRes = await fetch(
      `${baseUrl}/api/reports/overview?materialCode=${encodeURIComponent(targetMat.materialCode)}`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(filteredRes.status, 200);
    const filteredOverview = (await filteredRes.json()) as ReportsOverviewResponse;

    assert.equal(
      filteredOverview.productUsage.selectedMaterialCode,
      targetMat.materialCode
    );
    assert.equal(
      filteredOverview.productUsage.summary.totalOccurrences,
      targetMat.usageStepCount
    );
    for (const u of filteredOverview.productUsage.usages) {
      assert.equal(u.materialCode, targetMat.materialCode);
      assert.equal(u.projectCode, 'NTR 001');
      assert.equal(u.customerId, '1200001169');
      assert.ok(u.itemCaPlusLossGramM2 > 0);
      assert.ok(typeof u.itemCoatingCostVndM2 === 'number' && u.itemCoatingCostVndM2 >= 0);
      assert.equal(u.revisionTotalCostVndM2, 894143);
    }

    // Verify Report 2: Customer Portfolio for NITORI (1200001169)
    const nitoriRow = overview.customerPortfolio.customers.find(
      (c) => c.customerId === '1200001169'
    );
    assert.ok(nitoriRow, 'Expected NITORI customer 1200001169 in Customer Portfolio');
    assert.equal(nitoriRow.projectCount, 1);
    assert.equal(nitoriRow.totalRevisionCount, 1);
    assert.equal(nitoriRow.avgCoatingCostVndM2, 894143);
    assert.equal(nitoriRow.revisions.length, 1);
    assert.equal(nitoriRow.revisions[0].projectCode, 'NTR 001');
  });

  it('2. Revision Scope Filter switches accurately between ALL, LATEST, and APPROVED', async () => {
    // Approve Rev 00 first, then clone to Rev 01 (DRAFT)
    await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ status: 'APPROVED' })
    });

    const cloneRes = await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
      body: JSON.stringify({ refreshPrices: true })
    });
    assert.equal(cloneRes.status, 201);
    const cloned = (await cloneRes.json()) as { id: string; revisionNo: number };

    try {
      // 1) ALL -> should include both Rev 00 (APPROVED) and Rev 01 (DRAFT)
      const allRes = await fetch(
        `${baseUrl}/api/reports/overview?revisionScope=ALL&customerId=1200001169`,
        { headers: { 'x-user-role': 'PROJECT_LEADER' } }
      );
      const allData = (await allRes.json()) as ReportsOverviewResponse;
      assert.equal(allData.customerPortfolio.summary.totalRevisions, 2);
      assert.equal(allData.customerPortfolio.summary.approvedRevisions, 1);
      assert.equal(allData.customerPortfolio.summary.draftRevisions, 1);

      // 2) LATEST -> should include only Rev 01 (DRAFT)
      const latestRes = await fetch(
        `${baseUrl}/api/reports/overview?revisionScope=LATEST&customerId=1200001169`,
        { headers: { 'x-user-role': 'PROJECT_LEADER' } }
      );
      const latestData = (await latestRes.json()) as ReportsOverviewResponse;
      assert.equal(latestData.customerPortfolio.summary.totalRevisions, 1);
      assert.equal(latestData.customerPortfolio.summary.approvedRevisions, 0);
      assert.equal(latestData.customerPortfolio.summary.draftRevisions, 1);
      assert.equal(
        latestData.customerPortfolio.customers[0].revisions[0].revisionNo,
        1
      );

      // 3) APPROVED -> should include only Rev 00 (APPROVED)
      const approvedRes = await fetch(
        `${baseUrl}/api/reports/overview?revisionScope=APPROVED&customerId=1200001169`,
        { headers: { 'x-user-role': 'PROJECT_LEADER' } }
      );
      const approvedData = (await approvedRes.json()) as ReportsOverviewResponse;
      assert.equal(approvedData.customerPortfolio.summary.totalRevisions, 1);
      assert.equal(approvedData.customerPortfolio.summary.approvedRevisions, 1);
      assert.equal(approvedData.customerPortfolio.summary.draftRevisions, 0);
      assert.equal(
        approvedData.customerPortfolio.customers[0].revisions[0].revisionNo,
        0
      );
    } finally {
      // Cleanup: revert Rev 00 to DRAFT and delete cloned Rev 01
      await fetch(`${baseUrl}/api/revisions/rev-ntr001-00/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'PROJECT_LEADER' },
        body: JSON.stringify({ status: 'DRAFT' })
      });
      await fetch(`${baseUrl}/api/revisions/${cloned.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'PROJECT_LEADER' }
      });
    }
  });

  it('3. Row-level RBAC isolates SALES and TECHNICAL to their assigned salesmanName, while ADMIN and PROJECT_LEADER see all', async () => {
    // Assign NITORI (1200001169) to "Salesman Alpha" and create a temporary customer assigned to "Salesman Beta"
    await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        customerId: '1200001169',
        shortName: 'NITORI-HO CHI MINH',
        customerName: 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM',
        salesmanName: 'Salesman Alpha'
      })
    });

    const betaCustRes = await fetch(`${baseUrl}/api/master/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
      body: JSON.stringify({
        customerId: '99990001',
        shortName: 'BETA FURNITURE',
        customerName: 'CONG TY NOI THAT BETA',
        salesmanName: 'Salesman Beta'
      })
    });
    const betaCust = (await betaCustRes.json()) as { id: string; customerId: string };

    try {
      // 1) SALES scoped to "Salesman Alpha" -> sees NITORI (1200001169), does NOT see BETA (99990001)
      const alphaSalesRes = await fetch(`${baseUrl}/api/reports/overview`, {
        headers: {
          'x-user-role': 'SALES',
          'x-salesman-name': 'Salesman Alpha'
        }
      });
      assert.equal(alphaSalesRes.status, 200);
      const alphaSalesOverview = (await alphaSalesRes.json()) as ReportsOverviewResponse;
      assert.equal(alphaSalesOverview.meta.enforcedSalesmanScope, 'Salesman Alpha');
      assert.ok(
        alphaSalesOverview.customerPortfolio.customers.every(
          (c) => (c.salesmanName || '').toLowerCase() === 'salesman alpha'
        )
      );
      assert.ok(
        alphaSalesOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '1200001169'
        )
      );
      assert.ok(
        !alphaSalesOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '99990001'
        )
      );

      // 2) TECHNICAL scoped to "Salesman Beta" -> sees BETA (99990001), does NOT see NITORI (1200001169) or NTR 001
      const betaTechRes = await fetch(`${baseUrl}/api/reports/overview`, {
        headers: {
          'x-user-role': 'TECHNICAL',
          'x-salesman-name': 'Salesman Beta'
        }
      });
      assert.equal(betaTechRes.status, 200);
      const betaTechOverview = (await betaTechRes.json()) as ReportsOverviewResponse;
      assert.equal(betaTechOverview.meta.enforcedSalesmanScope, 'Salesman Beta');
      assert.equal(betaTechOverview.productUsage.usages.length, 0);
      assert.ok(
        betaTechOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '99990001'
        )
      );
      assert.ok(
        !betaTechOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '1200001169'
        )
      );

      // 3) ADMIN and PROJECT_LEADER see BOTH Salesman Alpha and Salesman Beta
      const adminRes = await fetch(`${baseUrl}/api/reports/overview`, {
        headers: { 'x-user-role': 'ADMIN' }
      });
      assert.equal(adminRes.status, 200);
      const adminOverview = (await adminRes.json()) as ReportsOverviewResponse;
      assert.equal(adminOverview.meta.enforcedSalesmanScope, null);
      assert.ok(adminOverview.meta.availableSalesmen.includes('Salesman Alpha'));
      assert.ok(adminOverview.meta.availableSalesmen.includes('Salesman Beta'));
      assert.ok(
        adminOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '1200001169'
        )
      );
      assert.ok(
        adminOverview.customerPortfolio.customers.some(
          (c) => c.customerId === '99990001'
        )
      );
    } finally {
      // Restore NITORI salesmanName to null and delete temporary Beta customer
      await fetch(`${baseUrl}/api/master/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'ADMIN' },
        body: JSON.stringify({
          customerId: '1200001169',
          shortName: 'NITORI-HO CHI MINH',
          customerName: 'DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM',
          salesmanName: null
        })
      });
      await fetch(`${baseUrl}/api/master/customers/${betaCust.id}`, {
        method: 'DELETE',
        headers: { 'x-user-role': 'ADMIN' }
      });
    }
  });

  it('4. Column-level Cost Redaction strips all VND/m² and VND/Kg fields to null across all 7 reports for TECHNICAL', async () => {
    const res = await fetch(`${baseUrl}/api/reports/overview`, {
      headers: { 'x-user-role': 'TECHNICAL' }
    });
    assert.equal(res.status, 200);
    const tech = (await res.json()) as ReportsOverviewResponse;

    // Report 1: Product Usage
    assert.equal(tech.productUsage.summary.avgItemCostVndM2, null);
    assert.equal(tech.productUsage.summary.minItemCostVndM2, null);
    assert.equal(tech.productUsage.summary.maxItemCostVndM2, null);
    assert.ok(tech.productUsage.usages.length > 0);
    for (const u of tech.productUsage.usages) {
      assert.ok(u.itemCaPlusLossGramM2 > 0);
      assert.equal(u.priceSnapshotVnd, null);
      assert.equal(u.itemCoatingCostVndM2, null);
      assert.equal(u.stepCoatingCostVndM2, null);
      assert.equal(u.revisionTotalCostVndM2, null);
    }

    // Report 2: Customer Portfolio
    assert.equal(tech.customerPortfolio.summary.avgRevisionCostVndM2, null);
    for (const c of tech.customerPortfolio.customers) {
      assert.equal(c.minCoatingCostVndM2, null);
      assert.equal(c.avgCoatingCostVndM2, null);
      assert.equal(c.maxCoatingCostVndM2, null);
      for (const r of c.revisions) {
        assert.equal(r.totalCoatingCostVndM2, null);
      }
    }

    // Report 3: Revision Variance
    for (const comp of tech.revisionVariance.projectComparisons) {
      assert.equal(comp.baseCostVndM2, null);
      assert.equal(comp.targetCostVndM2, null);
      assert.equal(comp.deltaCostVndM2, null);
      assert.equal(comp.deltaCostPercent, null);
      for (const diff of comp.itemDiffs) {
        assert.equal(diff.basePriceVnd, null);
        assert.equal(diff.targetPriceVnd, null);
        assert.equal(diff.baseCostVndM2, null);
        assert.equal(diff.targetCostVndM2, null);
      }
    }

    // Report 4: Price Drift
    assert.equal(tech.priceDrift.summary.totalDriftImpactVndM2, null);
    for (const item of tech.priceDrift.items) {
      assert.equal(item.snapshotPriceVnd, null);
      assert.equal(item.latestQuotationPriceVnd, null);
      assert.equal(item.deltaPriceVnd, null);
      assert.equal(item.costImpactVndM2, null);
    }

    // Report 5: Step & System Benchmark
    for (const st of tech.stepBenchmark.byStep) {
      assert.equal(st.avgStepCostVndM2, null);
      assert.equal(st.costSharePercent, null);
    }
    for (const sys of tech.stepBenchmark.bySystem) {
      assert.equal(sys.minCostVndM2, null);
      assert.equal(sys.avgCostVndM2, null);
      assert.equal(sys.maxCostVndM2, null);
    }

    // Report 6: Aggregated BOM Forecast
    assert.equal(tech.bomForecast.summary.totalEstimatedCostVnd, null);
    for (const m of tech.bomForecast.materials) {
      assert.ok(m.totalRequiredKgOrLtr > 0);
      assert.equal(m.avgPriceUnitVnd, null);
      assert.equal(m.totalEstimatedCostVnd, null);
    }

    // Report 7: Activity Funnel
    for (const s of tech.activityFunnel.bySalesman) {
      assert.equal(s.avgCoatingCostVndM2, null);
    }
  });

  it('5. Exports valid 7-sheet Analytics Excel (.xlsx) for PROJECT_LEADER and omits cost columns for TECHNICAL', async () => {
    const leaderRes = await fetch(
      `${baseUrl}/api/reports/export-excel?reportTab=ALL`,
      { headers: { 'x-user-role': 'PROJECT_LEADER' } }
    );
    assert.equal(leaderRes.status, 200);
    const leaderBuf = Buffer.from(await leaderRes.arrayBuffer());
    const leaderWb = new ExcelJS.Workbook();
    await leaderWb.xlsx.load(leaderBuf as unknown as ExcelJS.Buffer);
    assert.equal(leaderWb.worksheets.length, 7);

    const leaderSheet1Headers = (
      leaderWb.getWorksheet('1_Product_Usage')!.getRow(4).values as string[]
    )
      .filter(Boolean)
      .join(' | ');
    assert.ok(leaderSheet1Headers.includes('Price Snapshot (VND/Kg)'));
    assert.ok(leaderSheet1Headers.includes('Total Rev CC (VND/m²)'));

    // TECHNICAL Excel export
    const techRes = await fetch(
      `${baseUrl}/api/reports/export-excel?reportTab=ALL`,
      { headers: { 'x-user-role': 'TECHNICAL' } }
    );
    assert.equal(techRes.status, 200);
    const techBuf = Buffer.from(await techRes.arrayBuffer());
    const techWb = new ExcelJS.Workbook();
    await techWb.xlsx.load(techBuf as unknown as ExcelJS.Buffer);
    assert.equal(techWb.worksheets.length, 7);

    const techSheet1Headers = (
      techWb.getWorksheet('1_Product_Usage')!.getRow(4).values as string[]
    )
      .filter(Boolean)
      .join(' | ');
    assert.ok(!techSheet1Headers.includes('VND'));
  });
});

