import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  ProjectRevision,
  UserRole,
  calculateCoatingCostTable,
  calculateBomSummary
} from '@cscc/shared';

function resolveLogoBuffer(): Buffer | null {
  const candidates = [
    path.resolve(process.cwd(), 'pic/LOGO_WEB.png'),
    path.resolve(process.cwd(), 'apps/backend/src/assets/logo_web.png'),
    path.resolve(process.cwd(), 'apps/frontend/public/logo_web.png'),
    path.resolve(__dirname, '../assets/logo_web.png'),
    path.resolve(__dirname, '../../../../pic/LOGO_WEB.png'),
    path.resolve(__dirname, '../../../pic/LOGO_WEB.png')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        return fs.readFileSync(c);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

/**
 * Generates an Excel (.xlsx) workbook with dynamic `mergeCells` and live Excel formulas.
 * - Includes `CS` (Coating Schedule) with Finishing Conditions & 4 Signature boxes.
 * - Includes `CC` (Coating Cost) ONLY when `role !== 'TECHNICAL'`.
 * - Includes `BOM Summary` (with pricing omitted when `role === 'TECHNICAL'`).
 */
export async function generateRevisionWorkbook(
  revision: ProjectRevision,
  role: UserRole,
  areaM2?: number
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ALKANA Coating System';
  workbook.created = new Date();

  const effectiveArea = areaM2 && areaM2 > 0 ? areaM2 : 1;
  const revCode = String(revision.revisionNo).padStart(2, '0');

  const logoBuffer = resolveLogoBuffer();
  const logoImageId = logoBuffer
    ? workbook.addImage({
      base64: logoBuffer.toString('base64'),
      extension: 'png'
    })
    : null;

  // =========================================================================
  // 1. SHEET: CS (COATING SCHEDULE)
  // =========================================================================
  const csSheet = workbook.addWorksheet('CS');
  csSheet.columns = [
    { key: 'stepNo', width: 9 },
    { key: 'stepName', width: 26 },
    { key: 'materialCode', width: 42 },
    { key: 'mixingRatio', width: 14 },
    { key: 'visco', width: 16 },
    { key: 'caInputRaw', width: 15 },
    { key: 'methodName', width: 24 },
    { key: 'dryingTime', width: 24 }
  ];

  // Title & Header Block
  csSheet.mergeCells('A1:H1');
  const csTitle = csSheet.getCell('A1');
  csTitle.value = 'COATING SCHEDULE / QUI TRÌNH SƠN';
  csTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  csTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  csTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  csSheet.getRow(1).height = 28;

  // Add Brand Logo to Top-Right Corner (Column I, Rows 1-3)
  if (logoImageId !== null) {
    csSheet.getColumn('I').width = 16;
    csSheet.addImage(logoImageId, {
      tl: { col: 8.1, row: 0.1 },
      ext: { width: 84, height: 57 },
      editAs: 'oneCell'
    });
  }

  const headerRows: Array<[string, string, string, string, string, string]> = [
    ['Customer / Khách hàng:', revision.customer.shortName, 'Substrate Type / Loại gỗ:', revision.substrate, 'No. / Mã:', revision.projectCode],
    ['Product Item / Tên sản phẩm:', revision.productName, 'Positioning / Vị trí:', revision.positioning, 'Date / Rev (Ngày / Phiên bản):', `${revision.scheduleDate} (Rev.${revCode})`],
    ['Color / Màu sắc:', revision.colorName, 'Finishing System / Hệ sơn:', revision.finishingSystem, 'MC Wood / Độ ẩm gỗ:', revision.mcWood],
    ['Gloss Level / Độ bóng:', revision.glossLevel, 'Reference / Tiêu chuẩn:', revision.referenceStandard, 'Humidity / Temp (Độ ẩm / Nhiệt độ):', `${revision.roomHumidity} / ${revision.roomTemp}`]
  ];

  headerRows.forEach((r, idx) => {
    const rowNum = idx + 2;
    csSheet.getCell(`A${rowNum}`).value = r[0];
    csSheet.getCell(`A${rowNum}`).font = { bold: true };
    csSheet.mergeCells(`B${rowNum}:C${rowNum}`);
    csSheet.getCell(`B${rowNum}`).value = r[1];

    csSheet.getCell(`D${rowNum}`).value = r[2];
    csSheet.getCell(`D${rowNum}`).font = { bold: true };
    csSheet.mergeCells(`E${rowNum}:F${rowNum}`);
    csSheet.getCell(`E${rowNum}`).value = r[3];

    csSheet.getCell(`G${rowNum}`).value = r[4];
    csSheet.getCell(`G${rowNum}`).font = { bold: true };
    csSheet.getCell(`H${rowNum}`).value = r[5];
  });

  // Table Header at Row 7
  const csHeaderRowNum = 7;
  const csHeaders = [
    'No. / STT',
    'Application Step / Bước thi công',
    'Product Name / Tên sản phẩm',
    'Mixing Ratio / Tỉ lệ pha',
    'Visco / Độ nhớt',
    'CA / Lượng sơn (g/m²)',
    'Application Method / Phương pháp thi công',
    'Drying Time Recommended / Thời gian khô đề xuất'
  ];
  const csHeaderRow = csSheet.getRow(csHeaderRowNum);
  csHeaders.forEach((h, i) => {
    const cell = csHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  csHeaderRow.height = 30;

  // Dynamic Step & Item Rows on CS
  let currentCsRow = csHeaderRowNum + 1;
  const orderedSteps = [...revision.steps].sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of orderedSteps) {
    if (step.rowType === 'SANDING') {
      const row = csSheet.getRow(currentCsRow);
      row.getCell(1).value = '';
      row.getCell(2).value = step.stepName ? `${step.stepName} / CHÀ NHÁM` : 'SANDING / CHÀ NHÁM';
      row.getCell(7).value = step.sandingSpec || 'SANDING PAPER';
      for (let c = 1; c <= 8; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        row.getCell(c).font = { italic: true, bold: c === 2 };
        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      currentCsRow += 1;
      continue;
    }

    const items = step.items.length > 0 ? step.items : [null];
    const rowSpan = items.length;
    const startRow = currentCsRow;
    const endRow = startRow + rowSpan - 1;

    items.forEach((item, idx) => {
      const rNum = startRow + idx;
      const row = csSheet.getRow(rNum);
      if (idx === 0) {
        row.getCell(1).value = step.stepNumber ?? '';
        row.getCell(2).value = step.stepName;
        row.getCell(5).value = step.visco ?? item?.visco ?? '';
        row.getCell(6).value = step.caInputRaw ?? '';
        row.getCell(7).value = step.methodName ?? '';
        row.getCell(8).value = step.dryingTime ?? '';
      }
      if (item) {
        row.getCell(3).value = item.materialName || item.materialCode;
        row.getCell(4).value = item.mixingRatio;
      }
    });

    // Dynamic vertical merge for step-level columns when rowSpan > 1
    if (rowSpan > 1) {
      csSheet.mergeCells(`A${startRow}:A${endRow}`);
      csSheet.mergeCells(`B${startRow}:B${endRow}`);
      csSheet.mergeCells(`E${startRow}:E${endRow}`);
      csSheet.mergeCells(`F${startRow}:F${endRow}`);
      csSheet.mergeCells(`G${startRow}:G${endRow}`);
      csSheet.mergeCells(`H${startRow}:H${endRow}`);
    }

    for (let r = startRow; r <= endRow; r++) {
      for (let c = 1; c <= 8; c++) {
        const cell = csSheet.getRow(r).getCell(c);
        cell.alignment = {
          vertical: 'middle',
          horizontal: c === 3 ? 'left' : 'center',
          wrapText: true
        };
      }
    }

    currentCsRow = endRow + 1;
  }

  // Remark & Signatures on CS
  currentCsRow += 1;
  csSheet.getCell(`A${currentCsRow}`).value = 'Remark / Ghi chú:';
  csSheet.getCell(`A${currentCsRow}`).font = { bold: true };
  csSheet.getCell(`B${currentCsRow}`).value =
    'ALKANA VIET NAM does not assure the quality of the final product if: 1. The production process does not use 100% ALKANA materials. 2. The production process does not follow the ALKANA coating schedule. / ALKANA VIỆT NAM không đảm bảo chất lượng của sản phẩm cuối cùng nếu: 1. Quy trình sản xuất không sử dụng 100% nguyên vật liệu của ALKANA. 2. Quy trình sản xuất không tuân thủ theo qui trình sơn của ALKANA.';
  csSheet.mergeCells(`B${currentCsRow}:H${currentCsRow}`);

  currentCsRow += 2;
  const sigBoxes: Array<[string, string, string]> = [
    ['A', 'B', `CUSTOMER / KHÁCH HÀNG\n${revision.customerConfirmName || ''}`],
    ['C', 'D', `PD/PM / PHÒNG DỰ ÁN\n${revision.approvedByPdPm || ''}`],
    ['E', 'F', `TA / KỸ THUẬT\n${revision.preparedByTa || ''}`],
    ['G', 'H', `PROJECT LEADER / TRƯỞNG DỰ ÁN\n${revision.checkedByLeader || ''}`]
  ];
  sigBoxes.forEach(([startCol, endCol, label]) => {
    csSheet.mergeCells(`${startCol}${currentCsRow}:${endCol}${currentCsRow + 2}`);
    const cell = csSheet.getCell(`${startCol}${currentCsRow}`);
    cell.value = label;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.font = { bold: true };
  });

  // =========================================================================
  // 2. SHEET: CC (COATING COST) — OMITTED FOR TECHNICAL ROLE
  // =========================================================================
  if (role !== 'TECHNICAL') {
    const ccSheet = workbook.addWorksheet('CC');
    ccSheet.columns = [
      { key: 'stepName', width: 22 },       // A: Item / Bước thi công
      { key: 'materialCode', width: 40 },   // B: Product Name / Tên sản phẩm
      { key: 'priceUnit', width: 16 },      // C: Price / Đơn giá (VND/Ltr)
      { key: 'mixingRatio', width: 12 },    // D: Mixing Ratio / Tỉ lệ pha
      { key: 'mixedPrice', width: 18 },     // E: Mixed Price / Giá hỗn hợp (VND/Ltr set)
      { key: 'methodName', width: 20 },     // F: Application / Phương pháp thi công
      { key: 'caAvg', width: 16 },          // G: Coating Amount / Lượng sơn (g/m²)
      { key: 'efficiency', width: 16 },     // H: Application Efficiency / Hiệu suất thi công
      { key: 'caPlusLoss', width: 16 },     // I: CA + Loss / Lượng gồm hao hụt (g/m²)
      { key: 'coverage', width: 16 },       // J: Coverage / Định mức phủ (m²/Ltr/kg)
      { key: 'coatingCost', width: 18 }     // K: Coating Cost / Chi phí sơn (vnd/m²)
    ];

    ccSheet.mergeCells('A1:K1');
    const ccTitle = ccSheet.getCell('A1');
    ccTitle.value = 'COATING COST CALCULATION / BẢNG TÍNH TOÁN CHI PHÍ SƠN';
    ccTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    ccTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    ccTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    ccSheet.getRow(1).height = 28;

    // Add Brand Logo to Top-Right Corner (Column L, Rows 1-3)
    if (logoImageId !== null) {
      ccSheet.getColumn('L').width = 16;
      ccSheet.addImage(logoImageId, {
        tl: { col: 11.1, row: 0.1 },
        ext: { width: 84, height: 57 },
        editAs: 'oneCell'
      });
    }

    headerRows.forEach((r, idx) => {
      const rowNum = idx + 2;
      ccSheet.getCell(`A${rowNum}`).value = `${r[0]} ${r[1]}`;
      ccSheet.mergeCells(`A${rowNum}:C${rowNum}`);
      ccSheet.getCell(`D${rowNum}`).value = `${r[2]} ${r[3]}`;
      ccSheet.mergeCells(`D${rowNum}:G${rowNum}`);
      ccSheet.getCell(`H${rowNum}`).value = `${r[4]} ${r[5]}`;
      ccSheet.mergeCells(`H${rowNum}:K${rowNum}`);
    });

    const ccHeaderRowNum = 6;
    const ccHeaders = [
      'Item / Bước thi công',
      'Product Name / Tên sản phẩm',
      'Price / Đơn giá (VND/Ltr)',
      'Mixing Ratio / Tỉ lệ pha',
      'Mixed Price / Giá hỗn hợp (VND/Ltr set)',
      'Application / Phương pháp thi công',
      'Coating Amount / Lượng sơn (g/m²)',
      'Application Efficiency / Hiệu suất thi công',
      'CA + Loss / Lượng gồm hao hụt (g/m²)',
      'Coverage / Định mức phủ (m²/Ltr/kg)',
      'Coating Cost / Chi phí sơn (vnd/m²)'
    ];
    const ccHeaderRow = ccSheet.getRow(ccHeaderRowNum);
    ccHeaders.forEach((h, i) => {
      const cell = ccHeaderRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ccHeaderRow.height = 30;

    const costSummary = calculateCoatingCostTable(revision.id, revision.steps);
    const firstDataRow = 7;
    let currentCcRow = firstDataRow;

    for (const stepCalc of costSummary.steps) {
      const rowSpan = Math.max(1, stepCalc.items.length);
      const startRow = currentCcRow;
      const endRow = startRow + rowSpan - 1;

      stepCalc.items.forEach((item, idx) => {
        const rNum = startRow + idx;
        const row = ccSheet.getRow(rNum);
        row.getCell(2).value = item.materialName || item.materialCode;
        row.getCell(3).value = item.priceSnapshotVnd;
        row.getCell(3).numFmt = '#,##0';
        row.getCell(4).value = item.mixingRatio;
      });

      // Top cell of merged step block holds live Excel formulas + exact unrounded IEEE-754 result
      const topRow = ccSheet.getRow(startRow);
      topRow.getCell(1).value = stepCalc.stepName;

      topRow.getCell(5).value = {
        formula: `IFERROR(SUMPRODUCT(C${startRow}:C${endRow},D${startRow}:D${endRow})/SUM(D${startRow}:D${endRow}),0)`,
        result: stepCalc.mixedPriceRaw
      };
      topRow.getCell(5).numFmt = '#,##0';

      topRow.getCell(6).value = stepCalc.methodName;
      topRow.getCell(7).value = stepCalc.caAvg;
      topRow.getCell(7).numFmt = '#,##0.##';

      topRow.getCell(8).value = stepCalc.efficiency;
      topRow.getCell(8).numFmt = '0%';

      topRow.getCell(9).value = {
        formula: `(1/H${startRow})*G${startRow}`,
        result: stepCalc.caPlusLossRaw
      };
      topRow.getCell(9).numFmt = '#,##0.00';

      topRow.getCell(10).value = {
        formula: `1000/I${startRow}`,
        result: stepCalc.coverageRaw
      };
      topRow.getCell(10).numFmt = '0.00';

      topRow.getCell(11).value = {
        formula: `I${startRow}*E${startRow}/1000`,
        result: stepCalc.coatingCostRaw
      };
      topRow.getCell(11).numFmt = '#,##0.00';

      // Dynamic vertical merge for step-level columns when rowSpan > 1
      if (rowSpan > 1) {
        ccSheet.mergeCells(`A${startRow}:A${endRow}`);
        ccSheet.mergeCells(`E${startRow}:E${endRow}`);
        ccSheet.mergeCells(`F${startRow}:F${endRow}`);
        ccSheet.mergeCells(`G${startRow}:G${endRow}`);
        ccSheet.mergeCells(`H${startRow}:H${endRow}`);
        ccSheet.mergeCells(`I${startRow}:I${endRow}`);
        ccSheet.mergeCells(`J${startRow}:J${endRow}`);
        ccSheet.mergeCells(`K${startRow}:K${endRow}`);
      }

      for (let r = startRow; r <= endRow; r++) {
        for (let c = 1; c <= 11; c++) {
          ccSheet.getRow(r).getCell(c).alignment = {
            vertical: 'middle',
            horizontal: [3, 5, 9, 10, 11].includes(c)
              ? 'right'
              : [1, 4, 6, 7, 8].includes(c)
                ? 'center'
                : 'left',
            wrapText: true
          };
        }
      }

      currentCcRow = endRow + 1;
    }

    const lastDataRow = Math.max(firstDataRow, currentCcRow - 1);
    const totalRowNum = currentCcRow;
    ccSheet.mergeCells(`A${totalRowNum}:J${totalRowNum}`);
    const totalLabelCell = ccSheet.getCell(`A${totalRowNum}`);
    totalLabelCell.value = 'TOTAL COATING COST / TỔNG CHI PHÍ SƠN (VND/m²)';
    totalLabelCell.font = { bold: true, size: 12 };
    totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const totalValCell = ccSheet.getCell(`K${totalRowNum}`);
    totalValCell.value = {
      formula: `SUM(K${firstDataRow}:K${lastDataRow})`,
      result: costSummary.totalCoatingCostRaw
    };
    totalValCell.numFmt = '#,##0';
    totalValCell.font = { bold: true, size: 12, color: { argb: 'FF065F46' } };
  }

  // =========================================================================
  // 3. SHEET: BOM SUMMARY
  // =========================================================================
  const bomSheet = workbook.addWorksheet('BOM Summary');
  const bomSummary = calculateBomSummary(revision.id, effectiveArea, revision.steps, role);

  bomSheet.columns = [
    { key: 'materialName', width: 40 },
    { key: 'totalCaPlusLoss', width: 28 },
    { key: 'requiredQty', width: 24 },
    { key: 'unitPrice', width: 20 },
    { key: 'totalCost', width: 22 }
  ];

  bomSheet.getCell('A1').value = `BOM SUMMARY / BẢNG DỰ TOÁN ĐỊNH MỨC VẬT TƯ — Project / Dự án: ${revision.projectCode} (Area / Diện tích: ${effectiveArea} m²)`;
  bomSheet.getCell('A1').font = { bold: true, size: 13 };
  bomSheet.mergeCells(role === 'TECHNICAL' ? 'A1:C1' : 'A1:E1');

  const bomHeaders =
    role === 'TECHNICAL'
      ? [
        'Product Name / Tên sản phẩm',
        'Total CA+Loss / Tổng lượng gồm hao hụt (g/m²)',
        'Required Qty / Số lượng cần (Kg/Ltr)'
      ]
      : [
        'Product Name / Tên sản phẩm',
        'Total CA+Loss / Tổng lượng gồm hao hụt (g/m²)',
        'Required Qty / Số lượng cần (Kg/Ltr)',
        'Unit Price / Đơn giá (VND)',
        'Total Cost / Thành tiền (VND)'
      ];

  const bomHeaderRow = bomSheet.getRow(3);
  bomHeaders.forEach((h, idx) => {
    const cell = bomHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
  });

  bomSummary.items.forEach((item, idx) => {
    const r = bomSheet.getRow(4 + idx);
    r.getCell(1).value = item.materialName || item.materialCode;
    r.getCell(2).value = item.totalCaPlusLossGramPerM2Display;
    r.getCell(3).value = item.totalRequiredKgOrLtrDisplay;
    if (role !== 'TECHNICAL') {
      r.getCell(4).value = item.priceUnitVnd ?? 0;
      r.getCell(4).numFmt = '#,##0';
      r.getCell(5).value = item.totalMaterialCostDisplay ?? 0;
      r.getCell(5).numFmt = '#,##0';
    }
  });

  if (role !== 'TECHNICAL' && bomSummary.items.length > 0) {
    const firstBomRow = 4;
    const lastBomRow = 3 + bomSummary.items.length;
    const totalRow = bomSheet.getRow(lastBomRow + 1);
    const redBold = { bold: true, color: { argb: 'FFFF0000' } };

    totalRow.getCell(2).value = 'Total / Tổng cộng';
    totalRow.getCell(2).font = redBold;
    totalRow.getCell(2).alignment = { horizontal: 'right' };

    totalRow.getCell(5).value = {
      formula: `SUM(E${firstBomRow}:E${lastBomRow})`,
      result: bomSummary.totalProjectMaterialCostDisplay ?? 0
    };
    totalRow.getCell(5).numFmt = '#,##0';
    totalRow.getCell(5).font = redBold;
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

