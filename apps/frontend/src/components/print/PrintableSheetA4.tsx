import React from 'react';
import {
  ProjectRevision,
  CoatingCostSummary,
  UserRole,
  formatVnd,
  formatDecimal2,
  formatCoverage
} from '@cscc/shared';
import { Printer, X } from 'lucide-react';
import logoWeb from '../../assets/logo_web.png';

interface PrintableSheetA4Props {
  revision: ProjectRevision;
  costSummary: CoatingCostSummary | null;
  role: UserRole;
  initialMode?: 'CS' | 'CC';
  onClose: () => void;
}

export const PrintableSheetA4: React.FC<PrintableSheetA4Props> = ({
  revision,
  costSummary,
  role,
  initialMode = 'CS',
  onClose
}) => {
  const canViewCost = role !== 'TECHNICAL' && costSummary !== null;
  const [printMode, setPrintMode] = React.useState<'CS' | 'CC'>(
    initialMode === 'CC' && canViewCost ? 'CC' : 'CS'
  );
  const revCode = String(revision.revisionNo).padStart(2, '0');

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `ALKANA_${printMode}_${revision.projectCode}_Rev${revCode}`;
    const restoreTitle = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
    setTimeout(restoreTitle, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrintMode('CS')}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                printMode === 'CS'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Coating Schedule (CS) / Qui Trình Sơn
            </button>
            {canViewCost && (
              <button
                type="button"
                onClick={() => setPrintMode('CC')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  printMode === 'CC'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Coating Cost (CC) / Chi phí sơn
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print A4 - Export PDF / In A4 - Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Close / Đóng
            </button>
          </div>
        </div>

        {/* A4 SHEET HEADER */}
        <div className="border-2 border-slate-900 p-4 print:p-2.5">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 print:pb-1">
            <div className="flex items-center">
              <img
                src={logoWeb}
                alt="Alkana Logo"
                className="h-12 w-auto object-contain print:h-8"
              />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black uppercase tracking-widest text-slate-900 print:text-base print:tracking-wider">
                {printMode === 'CS'
                  ? 'COATING SCHEDULE / QUI TRÌNH SƠN'
                  : 'COATING COST CALCULATION / BẢNG TÍNH TOÁN CHI PHÍ SƠN'}
              </h1>
              <div className="text-xs font-semibold text-slate-600 print:text-[10px]">
                No. / Mã: {revision.projectCode} | Rev. / Phiên bản: {revCode} | Date / Ngày:{' '}
                {revision.scheduleDate}
              </div>
            </div>
            <div className="text-right text-xs print:text-[10px]">
              <div>
                <strong>Status / Trạng thái:</strong>{' '}
                {revision.status === 'LOCKED' || revision.status === 'APPROVED'
                  ? 'APPROVED / ĐÃ PHÊ DUYỆT'
                  : 'DRAFT / BẢN NHÁP'}
              </div>
              <div>
                <strong>Page / Trang:</strong> 1 / 1
              </div>
            </div>
          </div>

          {/* Synchronized Metadata Grid */}
          <div className="my-3 grid grid-cols-3 gap-2 border-b border-slate-400 pb-3 text-xs print:my-1.5 print:gap-1 print:pb-1.5 print:text-[10px] print:leading-tight">
            <div>
              <div>
                <strong>Customer / Khách hàng:</strong> {revision.customer.shortName}
              </div>
              <div>
                <strong>Substrate Type / Loại gỗ:</strong> {revision.substrate}
              </div>
              <div>
                <strong>Product Item / Tên sản phẩm:</strong> {revision.productName}
              </div>
            </div>
            <div>
              <div>
                <strong>Positioning / Vị trí:</strong> {revision.positioning}
              </div>
              <div>
                <strong>Finishing System / Hệ sơn:</strong> {revision.finishingSystem}
              </div>
              <div>
                <strong>Gloss Level / Độ bóng:</strong> {revision.glossLevel}
              </div>
            </div>
            <div>
              <div>
                <strong>Color / Màu sắc:</strong> {revision.colorName}
              </div>
              <div>
                <strong>MC Wood / Độ ẩm gỗ:</strong> {revision.mcWood} |{' '}
                <strong>Humidity / Độ ẩm:</strong> {revision.roomHumidity}
              </div>
              <div>
                <strong>Room Temp. / Nhiệt độ phòng:</strong> {revision.roomTemp}
              </div>
            </div>
          </div>

          {/* TABLE CONTENT: CS OR CC (Clean Product Code only, no Packing info) */}
          {printMode === 'CS' ? (
            <table className="w-full table-fixed border-collapse border border-slate-900 text-[11px] print:text-[9.5px]">
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-200 font-bold uppercase print:bg-slate-100">
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    No.<br />STT
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Application Step<br />Bước thi công
                  </th>
                  <th className="border border-slate-900 px-2 py-1 print:py-0.5 text-left leading-tight">
                    Product Name<br />Tên sản phẩm
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Mixing Ratio<br />Tỉ lệ pha
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Visco<br />Độ nhớt
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    CA (g/m²)<br />Lượng sơn
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Application Method<br />Phương pháp thi công
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Drying Time Recommended<br />Thời gian khô đề xuất
                  </th>
                </tr>
              </thead>
              <tbody>
                {revision.steps.map((step) => {
                  if (step.rowType === 'SANDING') {
                    return (
                      <tr key={step.id} className="italic">
                        <td className="border border-slate-900 px-1 py-1 print:py-0.5 text-center" />
                        <td className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center font-semibold">
                          SANDING / CHÀ NHÁM
                        </td>
                        <td className="border border-slate-900 px-2 py-1 print:py-0.5" />
                        <td className="border border-slate-900 px-1 py-1 print:py-0.5" />
                        <td className="border border-slate-900 px-1 py-1 print:py-0.5" />
                        <td className="border border-slate-900 px-1 py-1 print:py-0.5" />
                        <td className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center font-semibold">
                          {step.sandingSpec}
                        </td>
                        <td className="border border-slate-900 px-1.5 py-1 print:py-0.5" />
                      </tr>
                    );
                  }
                  const rowSpan = Math.max(1, step.items.length);
                  return step.items.map((item, idx) => (
                    <tr key={item.id}>
                      {idx === 0 && (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center font-bold"
                          >
                            {step.stepNumber}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center font-bold"
                          >
                            {step.stepName}
                          </td>
                        </>
                      )}
                      <td className="border border-slate-900 px-2 py-1 print:py-0.5 font-mono font-semibold break-words">
                        {item.materialName || item.materialCode}
                      </td>
                      <td className="border border-slate-900 px-1 py-1 print:py-0.5 text-center">
                        {item.mixingRatio}
                      </td>
                      {idx === 0 && (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center"
                          >
                            {step.visco ?? item.visco ?? ''}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center font-semibold"
                          >
                            {step.caInputRaw}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center font-semibold"
                          >
                            {step.methodName}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center"
                          >
                            {step.dryingTime}
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          ) : costSummary ? (
            <table className="w-full table-fixed border-collapse border border-slate-900 text-[10.5px] print:text-[9px]">
              <colgroup>
                <col style={{ width: '7%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '8.5%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7.5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8.5%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-200 font-bold uppercase print:bg-slate-100">
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Item<br />Bước thi công
                  </th>
                  <th className="border border-slate-900 px-2 py-1 print:py-0.5 text-left leading-tight">
                    Product Name<br />Tên sản phẩm
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Price<br />Đơn giá (VND/Ltr)
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Mixing Ratio<br />Tỉ lệ pha
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Mixed Price<br />Giá hỗn hợp (VND/Ltr set)
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Application<br />Phương pháp thi công
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Coating Amount<br />Lượng sơn (g/m²)
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Application Efficiency<br />Hiệu suất thi công
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    CA + Loss<br />Lượng gồm hao hụt (g/m²)
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Coverage<br />Định mức phủ (m²/Ltr/kg)
                  </th>
                  <th className="border border-slate-900 px-1 py-1 print:py-0.5 text-center leading-tight">
                    Coating Cost<br />Chi phí sơn (VND/m²)
                  </th>
                </tr>
              </thead>
              <tbody>
                {costSummary.steps.map((sc) => {
                  const rowSpan = Math.max(1, sc.items.length);
                  return sc.items.map((it, idx) => (
                    <tr key={it.itemId}>
                      {idx === 0 && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-900 px-1.5 py-1 print:py-0.5 text-center font-bold"
                        >
                          {sc.stepName}
                        </td>
                      )}
                      <td className="border border-slate-900 px-2 py-1 print:py-0.5 font-mono font-semibold break-words">
                        {it.materialName || it.materialCode}
                      </td>
                      <td className="border border-slate-900 px-1 py-1 print:py-0.5 text-right">
                        {formatVnd(it.priceSnapshotVnd)}
                      </td>
                      <td className="border border-slate-900 px-1 py-1 print:py-0.5 text-center">
                        {it.mixingRatio}
                      </td>
                      {idx === 0 && (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-right font-semibold"
                          >
                            {formatVnd(sc.mixedPriceDisplay)}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center font-semibold"
                          >
                            {sc.methodName}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center"
                          >
                            {sc.caAvg}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-center"
                          >
                            {sc.efficiencyPercentDisplay}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-right"
                          >
                            {formatDecimal2(sc.caPlusLossDisplay)}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-right"
                          >
                            {formatCoverage(sc.coverageDisplay)}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-1 py-1 print:py-0.5 text-right font-bold"
                          >
                            {formatDecimal2(sc.coatingCostDisplay)}
                          </td>
                        </>
                      )}
                    </tr>
                  ));
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 font-bold print:bg-slate-100">
                  <td
                    colSpan={10}
                    className="border border-slate-900 px-2 py-1.5 print:py-0.5 text-center"
                  >
                    TOTAL COATING COST / TỔNG CHI PHÍ SƠN (VND/m²)
                  </td>
                  <td className="border border-slate-900 px-1.5 py-1.5 print:py-0.5 text-right text-xs print:text-[9.5px]">
                    {formatVnd(costSummary.totalCoatingCostDisplay)}
                  </td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="my-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 italic">
              No Coating Cost data or unauthorized / Không có dữ liệu chi phí sơn hoặc không có quyền truy cập.
            </div>
          )}

          {/* REMARK & 4 SIGNATURE BOXES */}
          <div className="mt-3 border-t border-slate-900 pt-2 text-[11px] space-y-0.5 print:mt-1.5 print:pt-1 print:text-[9.5px] print:space-y-0 print:leading-tight">
            {printMode === 'CS' ? (
              <>
                <div className="font-semibold">Remark / Ghi chú:</div>
                <div>
                  ALKANA VIET NAM does not assure the quality of the final
                  product if: / ALKANA VIỆT NAM không đảm bảo chất lượng của sản phẩm cuối cùng nếu:
                </div>
                <div>
                  1. The production process does not use 100% ALKANA materials. /
                  1. Quy trình sản xuất không sử dụng 100% nguyên vật liệu của ALKANA.
                </div>
                <div>
                  2. The production process does not follow the ALKANA coating
                  schedule. / 2. Quy trình sản xuất không tuân thủ theo qui trình sơn của ALKANA.
                </div>
              </>
            ) : (
              <>
                <div className="italic">
                  Notes: The price above is not including VAT 8% and valid for
                  30 days / Ghi chú: Đơn giá trên chưa bao gồm thuế VAT 8% và có hiệu lực trong 30 ngày.
                </div>
                {revision.remark && (
                  <div>
                    <strong>REMARK / GHI CHÚ:</strong> {revision.remark}
                  </div>
                )}
              </>
            )}
          </div>

          {printMode === 'CS' && (
            <div className="mt-4 grid grid-cols-4 gap-0 border border-slate-900 text-center text-xs print:mt-1.5 print:text-[10px] print:break-inside-avoid">
              <div className="border-r border-slate-900 p-2 print:p-1">
                <div className="font-bold uppercase border-b border-slate-400 pb-1 print:pb-0.5">
                  CUSTOMER / KHÁCH HÀNG
                </div>
                <div className="h-16 print:h-8" />
                <div className="font-semibold print:text-[10px]">
                  {revision.customerConfirmName || ''}
                </div>
              </div>
              <div className="border-r border-slate-900 p-2 print:p-1">
                <div className="font-bold uppercase border-b border-slate-400 pb-1 print:pb-0.5">
                  PD/PM / PHÒNG DỰ ÁN
                </div>
                <div className="h-16 print:h-8" />
                <div className="font-semibold print:text-[10px]">
                  {revision.approvedByPdPm || ''}
                </div>
              </div>
              <div className="border-r border-slate-900 p-2 print:p-1">
                <div className="font-bold uppercase border-b border-slate-400 pb-1 print:pb-0.5">
                  TA / KỸ THUẬT
                </div>
                <div className="h-16 print:h-8" />
                <div className="font-semibold print:text-[10px]">
                  {revision.preparedByTa || ''}
                </div>
              </div>
              <div className="p-2 print:p-1">
                <div className="font-bold uppercase border-b border-slate-400 pb-1 print:pb-0.5">
                  PROJECT LEADER / TRƯỞNG DỰ ÁN
                </div>
                <div className="h-16 print:h-8" />
                <div className="font-semibold print:text-[10px]">
                  {revision.checkedByLeader || ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
