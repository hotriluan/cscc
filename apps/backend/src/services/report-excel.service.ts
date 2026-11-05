import ExcelJS from 'exceljs';
import {
  ReportsOverviewResponse,
  ReportSubTab,
  UserRole
} from '@cscc/shared';

function styleSheetHeader(sheet: ExcelJS.Worksheet, title: string, subtitle: string, colCount: number) {
  sheet.addRow([title]);
  sheet.mergeCells(1, 1, 1, Math.max(1, colCount));
  const r1 = sheet.getRow(1);
  r1.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  r1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  r1.alignment = { vertical: 'middle', horizontal: 'left' };
  r1.height = 26;

  sheet.addRow([subtitle]);
  sheet.mergeCells(2, 1, 2, Math.max(1, colCount));
  const r2 = sheet.getRow(2);
  r2.font = { italic: true, size: 10, color: { argb: 'FF334155' } };
  r2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF1F5F9' }
  };
  r2.height = 20;

  sheet.addRow([]);
}

function styleTableHeaders(sheet: ExcelJS.Worksheet, headerRowIndex: number, headers: string[]) {
  const row = sheet.getRow(headerRowIndex);
  row.values = headers;
  row.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 28;
}

export async function generateAnalyticsReportWorkbook(
  overview: ReportsOverviewResponse,
  userRole: UserRole,
  reportTab: ReportSubTab | 'ALL' = 'ALL'
): Promise<Buffer> {
  const isTech = userRole === 'TECHNICAL';
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ALKANA CS & CC Analytics System';
  workbook.created = new Date();

  const scopeLabel = overview.meta.appliedFilters.revisionScope || 'ALL';
  const salesmanScopeText =
    overview.meta.enforcedSalesmanScope ||
    overview.meta.appliedFilters.salesmanName ||
    'ALL SALESMEN / TẤT CẢ SALESMAN';

  const subtitleCommon = `Role / Vai trò: ${userRole} | Revision Scope / Phạm vi Rev: ${scopeLabel} | Salesman Scope: ${salesmanScopeText} | Exported: ${overview.meta.generatedAt.slice(0, 19).replace('T', ' ')}`;

  const shouldInclude = (tab: ReportSubTab) => reportTab === 'ALL' || reportTab === tab;

  // 1. PRODUCT USAGE REPORT
  if (shouldInclude('PRODUCT_USAGE')) {
    const sheet = workbook.addWorksheet('1_Product_Usage');
    const headers = isTech
      ? [
          'Material Code / Mã VT',
          'Material Name / Tên Sản Phẩm Sơn',
          'Customer ID / Mã KH',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Project Code / Mã HS',
          'Rev No.',
          'Status / Trạng Thái',
          'Furniture Item / Sản Phẩm Gỗ',
          'Color / Màu Sắc',
          'System / Hệ Sơn',
          'Step / Công Đoạn',
          'Method / Phương Pháp',
          'Mix Ratio / Tỷ Lệ Pha',
          'Share (%) / Tỷ Trọng',
          'Item CA+Loss (g/m²)'
        ]
      : [
          'Material Code / Mã VT',
          'Material Name / Tên Sản Phẩm Sơn',
          'Customer ID / Mã KH',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Project Code / Mã HS',
          'Rev No.',
          'Status / Trạng Thái',
          'Furniture Item / Sản Phẩm Gỗ',
          'Color / Màu Sắc',
          'System / Hệ Sơn',
          'Step / Công Đoạn',
          'Method / Phương Pháp',
          'Mix Ratio / Tỷ Lệ Pha',
          'Share (%) / Tỷ Trọng',
          'Item CA+Loss (g/m²)',
          'Price Snapshot (VND/Kg)',
          'Item Cost (VND/m²)',
          'Step Cost (VND/m²)',
          'Total Rev CC (VND/m²)'
        ];

    styleSheetHeader(
      sheet,
      '1. PRODUCT USAGE & WHERE-USED REPORT / BÁO CÁO TẦN SUẤT & CHI PHÍ THEO SẢN PHẨM SƠN',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const row of overview.productUsage.usages) {
      const revStr = `Rev ${String(row.revisionNo).padStart(2, '0')}`;
      const stepStr = row.stepNumber ? `#${row.stepNumber} - ${row.stepName}` : row.stepName;
      const baseValues: (string | number)[] = [
        row.materialCode,
        row.materialName,
        row.customerId,
        row.customerShortName,
        row.salesmanName || '-',
        row.projectCode,
        revStr,
        row.status,
        row.productName,
        row.colorName,
        row.finishingSystem,
        stepStr,
        row.methodName,
        row.mixingRatio,
        row.ratioSharePercent,
        row.itemCaPlusLossGramM2
      ];
      if (!isTech) {
        baseValues.push(
          row.priceSnapshotVnd ?? 0,
          row.itemCoatingCostVndM2 ?? 0,
          row.stepCoatingCostVndM2 ?? 0,
          row.revisionTotalCostVndM2 ?? 0
        );
      }
      sheet.addRow(baseValues);
    }

    sheet.columns = headers.map((h) => ({
      width: h.includes('Name') || h.includes('Customer /') ? 28 : 18
    }));
  }

  // 2. CUSTOMER PORTFOLIO REPORT
  if (shouldInclude('CUSTOMER_PORTFOLIO')) {
    const sheet = workbook.addWorksheet('2_Customer_Portfolio');
    const headers = isTech
      ? [
          'SAP Customer ID / Mã KH',
          'Short Name / Tên Viết Tắt',
          'Customer Name / Tên Đầy Đủ',
          'Salesman / Phụ Trách',
          'Projects / Số Dự Án',
          'Total CS / Tổng Rev',
          'Approved / Đã Duyệt',
          'Draft / Bản Nháp',
          'Chemicals / Số Mã Sơn',
          'Avg CA+Loss (g/m²)'
        ]
      : [
          'SAP Customer ID / Mã KH',
          'Short Name / Tên Viết Tắt',
          'Customer Name / Tên Đầy Đủ',
          'Salesman / Phụ Trách',
          'Projects / Số Dự Án',
          'Total CS / Tổng Rev',
          'Approved / Đã Duyệt',
          'Draft / Bản Nháp',
          'Chemicals / Số Mã Sơn',
          'Avg CA+Loss (g/m²)',
          'Min CC (VND/m²)',
          'Avg CC (VND/m²)',
          'Max CC (VND/m²)'
        ];

    styleSheetHeader(
      sheet,
      '2. CUSTOMER CS/CC PORTFOLIO REPORT / BÁO CÁO THỐNG KÊ HỒ SƠ & CHI PHÍ THEO KHÁCH HÀNG',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const c of overview.customerPortfolio.customers) {
      const vals: (string | number)[] = [
        c.customerId,
        c.shortName,
        c.customerName,
        c.salesmanName || '-',
        c.projectCount,
        c.totalRevisionCount,
        c.approvedRevisionCount,
        c.draftRevisionCount,
        c.distinctMaterialCount,
        c.totalConsumptionGramM2Avg
      ];
      if (!isTech) {
        vals.push(
          c.minCoatingCostVndM2 ?? 0,
          c.avgCoatingCostVndM2 ?? 0,
          c.maxCoatingCostVndM2 ?? 0
        );
      }
      sheet.addRow(vals);
    }

    sheet.columns = headers.map((h) => ({
      width: h.includes('Customer Name') ? 38 : h.includes('Short Name') ? 26 : 18
    }));
  }

  // 3. REVISION VARIANCE REPORT
  if (shouldInclude('REVISION_VARIANCE')) {
    const sheet = workbook.addWorksheet('3_Revision_Variance');
    const headers = isTech
      ? [
          'Project Code / Mã HS',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Product / Sản Phẩm',
          'Base Rev',
          'Target Rev',
          'Base Steps',
          'Target Steps',
          'Delta Steps',
          'Base (g/m²)',
          'Target (g/m²)',
          'Delta (g/m²)'
        ]
      : [
          'Project Code / Mã HS',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Product / Sản Phẩm',
          'Base Rev',
          'Target Rev',
          'Base Steps',
          'Target Steps',
          'Delta Steps',
          'Base (g/m²)',
          'Target (g/m²)',
          'Delta (g/m²)',
          'Base Cost (VND/m²)',
          'Target Cost (VND/m²)',
          'Delta Cost (VND/m²)',
          'Variance (%)'
        ];

    styleSheetHeader(
      sheet,
      '3. REVISION COST & SPEC VARIANCE REPORT / BÁO CÁO BIẾN ĐỘNG GIỮA CÁC REVISION',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const p of overview.revisionVariance.projectComparisons) {
      const vals: (string | number)[] = [
        p.projectCode,
        p.customerShortName,
        p.salesmanName || '-',
        p.productName,
        `Rev ${String(p.baseRevisionNo).padStart(2, '0')} (${p.baseStatus})`,
        `Rev ${String(p.targetRevisionNo).padStart(2, '0')} (${p.targetStatus})`,
        p.baseStepCount,
        p.targetStepCount,
        p.deltaStepCount,
        p.baseTotalGramM2,
        p.targetTotalGramM2,
        p.deltaTotalGramM2
      ];
      if (!isTech) {
        vals.push(
          p.baseCostVndM2 ?? 0,
          p.targetCostVndM2 ?? 0,
          p.deltaCostVndM2 ?? 0,
          p.deltaCostPercent ?? 0
        );
      }
      sheet.addRow(vals);
    }

    sheet.columns = headers.map(() => ({ width: 20 }));
  }

  // 4. PRICE DRIFT & QUOTATION ALERT REPORT
  if (shouldInclude('PRICE_DRIFT')) {
    const sheet = workbook.addWorksheet('4_Price_Drift_Alerts');
    const headers = isTech
      ? [
          'Alert Status / Trạng Thái',
          'Project Code / Mã HS',
          'Rev No.',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Step / Công Đoạn',
          'Material Code / Mã VT',
          'Material Name / Tên Vật Tư',
          'CA+Loss (g/m²)',
          'Valid From / Hiệu Lực Từ',
          'Valid To / Hết Hạn'
        ]
      : [
          'Alert Status / Trạng Thái',
          'Project Code / Mã HS',
          'Rev No.',
          'Customer / Khách Hàng',
          'Salesman / Phụ Trách',
          'Step / Công Đoạn',
          'Material Code / Mã VT',
          'Material Name / Tên Vật Tư',
          'CA+Loss (g/m²)',
          'Snapshot Price (VND/Kg)',
          'Latest Quotation (VND/Kg)',
          'Delta Price (VND/Kg)',
          'Delta (%)',
          'CC Impact (VND/m²)',
          'Valid From / Hiệu Lực Từ',
          'Valid To / Hết Hạn'
        ];

    styleSheetHeader(
      sheet,
      '4. PRICE DRIFT & QUOTATION ALERT REPORT / BÁO CÁO CHÊNH LỆCH GIÁ & CẢNH BÁO BÁO GIÁ',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const item of overview.priceDrift.items) {
      const vals: (string | number)[] = [
        item.alertStatus,
        item.projectCode,
        `Rev ${String(item.revisionNo).padStart(2, '0')}`,
        item.customerShortName,
        item.salesmanName || '-',
        item.stepName,
        item.materialCode,
        item.materialName,
        item.itemCaPlusLossGramM2
      ];
      if (!isTech) {
        vals.push(
          item.snapshotPriceVnd ?? 0,
          item.latestQuotationPriceVnd ?? 0,
          item.deltaPriceVnd ?? 0,
          item.deltaPricePercent ?? 0,
          item.costImpactVndM2 ?? 0
        );
      }
      vals.push(item.validFrom || '-', item.validTo || '-');
      sheet.addRow(vals);
    }

    sheet.columns = headers.map(() => ({ width: 20 }));
  }

  // 5. STEP & FINISHING SYSTEM BENCHMARK REPORT
  if (shouldInclude('STEP_BENCHMARK')) {
    const sheet = workbook.addWorksheet('5_Step_System_Benchmark');
    const headers = isTech
      ? [
          'Application Step / Công Đoạn Sơn',
          'Occurrences / Số Lần Dùng',
          'Revisions / Số Hồ Sơ',
          'Distinct Materials / Số Mã VT',
          'Avg CA (g/m²)',
          'Avg CA+Loss (g/m²)',
          'Consumption Share (%)'
        ]
      : [
          'Application Step / Công Đoạn Sơn',
          'Occurrences / Số Lần Dùng',
          'Revisions / Số Hồ Sơ',
          'Distinct Materials / Số Mã VT',
          'Avg CA (g/m²)',
          'Avg CA+Loss (g/m²)',
          'Consumption Share (%)',
          'Avg Step Cost (VND/m²)',
          'Min Step Cost (VND/m²)',
          'Max Step Cost (VND/m²)',
          'Cost Share (%)'
        ];

    styleSheetHeader(
      sheet,
      '5. STEP & FINISHING SYSTEM BENCHMARK / BÁO CÁO CƠ CẤU CHI PHÍ THEO CÔNG ĐOẠN & HỆ SƠN',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const s of overview.stepBenchmark.byStep) {
      const vals: (string | number)[] = [
        s.stepName,
        s.occurrenceCount,
        s.revisionCount,
        s.distinctMaterialCount,
        s.avgCaGramM2,
        s.avgCaPlusLossGramM2,
        s.gramSharePercent
      ];
      if (!isTech) {
        vals.push(
          s.avgStepCostVndM2 ?? 0,
          s.minStepCostVndM2 ?? 0,
          s.maxStepCostVndM2 ?? 0,
          s.costSharePercent ?? 0
        );
      }
      sheet.addRow(vals);
    }

    sheet.columns = headers.map(() => ({ width: 22 }));
  }

  // 6. AGGREGATED MULTI-PROJECT BOM FORECAST
  if (shouldInclude('BOM_FORECAST')) {
    const sheet = workbook.addWorksheet('6_BOM_Forecast');
    const headers = isTech
      ? [
          'Material Code / Mã VT',
          'Material Name / Tên Vật Tư Hóa Chất',
          'Packing / Quy Cách',
          'Nett (Kg/Ltr)',
          'Used in Revisions / Số Rev',
          'Customers / Số KH',
          'Projects / Danh Sách Dự Án',
          'Total Required (Kg/Ltr)',
          'Exact Packs / Số Thùng Lẻ',
          'Packs to Order / Thùng Đặt Hàng'
        ]
      : [
          'Material Code / Mã VT',
          'Material Name / Tên Vật Tư Hóa Chất',
          'Packing / Quy Cách',
          'Nett (Kg/Ltr)',
          'Used in Revisions / Số Rev',
          'Customers / Số KH',
          'Projects / Danh Sách Dự Án',
          'Total Required (Kg/Ltr)',
          'Exact Packs / Số Thùng Lẻ',
          'Packs to Order / Thùng Đặt Hàng',
          'Avg Unit Price (VND/Kg)',
          'Total Estimated Cost (VND)'
        ];

    styleSheetHeader(
      sheet,
      '6. AGGREGATED MULTI-PROJECT BOM FORECAST / DỰ BÁO NHU CẦU VẬT TƯ BOM TỔNG HỢP',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const m of overview.bomForecast.materials) {
      const vals: (string | number)[] = [
        m.materialCode,
        m.materialName,
        m.packingDesc || '-',
        m.nettWeight,
        m.usedInRevisionsCount,
        m.usedByCustomersCount,
        m.projectCodes.join(', '),
        m.totalRequiredKgOrLtr,
        m.totalPacksExact,
        m.totalPacksRounded
      ];
      if (!isTech) {
        vals.push(m.avgPriceUnitVnd ?? 0, m.totalEstimatedCostVnd ?? 0);
      }
      sheet.addRow(vals);
    }

    sheet.columns = headers.map(() => ({ width: 22 }));
  }

  // 7. SALESMAN & TECHNICAL ACTIVITY FUNNEL
  if (shouldInclude('ACTIVITY_FUNNEL')) {
    const sheet = workbook.addWorksheet('7_Sales_TA_Activity');
    const headers = isTech
      ? [
          'Salesman / Nhân Viên Kinh Doanh',
          'Total Customers / Tổng KH',
          'Active Customers / KH Có Dự Án',
          'Projects / Số Dự Án',
          'Total Revisions / Tổng Bản CS',
          'Approved / Đã Duyệt',
          'Draft / Bản Nháp',
          'Approval Rate (%)',
          'Avg Revs / Project'
        ]
      : [
          'Salesman / Nhân Viên Kinh Doanh',
          'Total Customers / Tổng KH',
          'Active Customers / KH Có Dự Án',
          'Projects / Số Dự Án',
          'Total Revisions / Tổng Bản CS',
          'Approved / Đã Duyệt',
          'Draft / Bản Nháp',
          'Approval Rate (%)',
          'Avg Revs / Project',
          'Avg Coating Cost (VND/m²)'
        ];

    styleSheetHeader(
      sheet,
      '7. SALESMAN & TECHNICAL TA ACTIVITY FUNNEL / BÁO CÁO HIỆU SUẤT KINH DOANH & KỸ THUẬT',
      subtitleCommon,
      headers.length
    );
    styleTableHeaders(sheet, 4, headers);

    for (const s of overview.activityFunnel.bySalesman) {
      const vals: (string | number)[] = [
        s.salesmanName,
        s.customerCount,
        s.activeCustomerCount,
        s.projectCount,
        s.totalRevisions,
        s.approvedRevisions,
        s.draftRevisions,
        s.approvalRatePercent,
        s.avgRevisionsPerProject
      ];
      if (!isTech) {
        vals.push(s.avgCoatingCostVndM2 ?? 0);
      }
      sheet.addRow(vals);
    }

    sheet.columns = headers.map(() => ({ width: 22 }));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

