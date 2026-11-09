import React from 'react';
import {
  ProjectRevision,
  ScheduleStep,
  CoatingCostSummary,
  StepCostCalculation,
  UserRole,
  formatVnd,
  formatDecimal2,
  formatCoverage,
  paginateCsSteps,
  paginateCcSteps
} from '@cscc/shared';
import { Printer, X } from 'lucide-react';
import logoPropan from '../../assets/LOGO PROPAN.png';
import logoAlkana from '../../assets/LOGO_Alkana.png';

interface PrintableSheetA4Props {
  revision: ProjectRevision;
  costSummary: CoatingCostSummary | null;
  role: UserRole;
  initialMode?: 'CS' | 'CC';
  onClose: () => void;
}

/**
 * Numeric spans such as `40-45°C`, `100-120`, `#180-240`, `<80%` or `35 oC`
 * must never break across lines. The text is preserved verbatim; only the
 * matching spans are wrapped in a no-wrap container.
 */
const NUMERIC_SPAN = /([<>≤≥]?#?\d[\d.,]*(?:\s?[-–]\s?#?\d[\d.,]*)?(?:\s?(?:°\s?C|oC|%))?)/g;

const keepRangesTogether = (
  value: string | number | null | undefined
): React.ReactNode => {
  if (value === null || value === undefined || value === '') return '';
  return String(value).split(NUMERIC_SPAN).map((part, idx) =>
    idx % 2 === 1 ? (
      <span key={idx} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    )
  );
};

const CELL = 'border border-slate-900 py-[1pt] leading-[1.2]';
const CS_CELL = `${CELL} px-[2pt]`;
const CS_PRODUCT_CELL = `${CELL} px-[3pt]`;
const CS_TH =
  'border border-slate-900 px-[2pt] py-[1pt] text-center leading-[1.15]';
const CC_TH =
  'border border-slate-900 px-[1pt] py-[1pt] text-center leading-[1.15]';

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

  const csPages = React.useMemo(
    () => paginateCsSteps(revision.steps),
    [revision.steps]
  );

  const ccPages = React.useMemo(
    () =>
      costSummary
        ? paginateCcSteps(costSummary.steps, Boolean(revision.remark?.trim()))
        : [],
    [costSummary, revision.remark]
  );

  const totalPages =
    printMode === 'CS' ? csPages.length : Math.max(1, ccPages.length);

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

  const renderSheetHeader = (pageNumber: number, pageCount: number) => (
    <div className="flex items-center justify-between gap-2.5 border-b-2 border-slate-900 pb-2.5 print:pb-1">
      <div className="flex shrink-0 items-center justify-start">
        <img
          src={logoPropan}
          alt="Propan Logo"
          className="h-10 w-auto object-contain print:h-7"
        />
      </div>
      <div className="min-w-0 flex-1 px-1.5 text-center">
        <h1 className="text-[12pt] font-black uppercase leading-snug tracking-wide text-slate-900">
          {printMode === 'CS'
            ? 'COATING SCHEDULE / QUI TRÌNH SƠN'
            : 'COATING COST CALCULATION / BẢNG TÍNH TOÁN CHI PHÍ SƠN'}
        </h1>
        <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[8pt] font-semibold leading-tight text-slate-600">
          <span>
            No. / Mã: <strong className="text-slate-900">{revision.projectCode}</strong>
          </span>
          <span>|</span>
          <span>
            Rev. / Phiên bản: <strong className="text-slate-900">{revCode}</strong>
          </span>
          <span>|</span>
          <span>
            Date / Ngày: <strong className="text-slate-900">{revision.scheduleDate}</strong>
          </span>
          <span>|</span>
          <span>
            Status / Trạng thái:{' '}
            <strong className="text-slate-900">
              {revision.status === 'LOCKED' || revision.status === 'APPROVED'
                ? 'APPROVED / ĐÃ PHÊ DUYỆT'
                : revision.status === 'INACTIVE'
                  ? 'INACTIVE / ĐÃ DUYỆT - HẾT HIỆU LỰC'
                  : 'DRAFT / BẢN NHÁP'}
            </strong>
          </span>
          <span>|</span>
          <span>
            Page / Trang:{' '}
            <strong className="text-slate-900">
              {pageNumber} / {pageCount}
            </strong>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end">
        <img
          src={logoAlkana}
          alt="Alkana Logo"
          className="h-10 w-auto object-contain print:h-7"
        />
      </div>
    </div>
  );

  const renderMetadataGrid = () => (
    <div className="my-2.5 grid grid-cols-3 gap-x-3 gap-y-1 border-b border-slate-400 pb-2.5 text-[8.5pt] leading-snug print:my-1.5 print:gap-x-2 print:gap-y-0.5 print:pb-1.5">
      <div className="min-w-0 space-y-0.5 break-words">
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
      <div className="min-w-0 space-y-0.5 break-words">
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
      <div className="min-w-0 space-y-0.5 break-words">
        <div>
          <strong>Color / Màu sắc:</strong> {revision.colorName}
        </div>
        <div>
          <strong>MC Wood / Độ ẩm gỗ:</strong> {keepRangesTogether(revision.mcWood)} |{' '}
          <strong>Humidity / Độ ẩm:</strong> {keepRangesTogether(revision.roomHumidity)}
        </div>
        <div>
          <strong>Room Temp. / Nhiệt độ phòng:</strong>{' '}
          {keepRangesTogether(revision.roomTemp)}
        </div>
      </div>
    </div>
  );

  const renderCsTable = (stepsSlice: ScheduleStep[]) => (
    <table className="w-full table-fixed border-collapse border border-slate-900 text-[9pt] leading-[1.2]">
      <colgroup>
        <col style={{ width: '4%' }} />
        <col style={{ width: '15%' }} />
        <col style={{ width: '26%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '7%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr className="bg-slate-200 text-[7.5pt] font-bold print:bg-slate-100">
          <th className={CS_TH}>
            No.<br />STT
          </th>
          <th className={CS_TH}>
            Application Step<br />Bước thi công
          </th>
          <th className={`${CS_TH} !px-[3pt] !text-left`}>
            Product Name<br />Tên sản phẩm
          </th>
          <th className={CS_TH}>
            Ratio<br />Tỉ lệ pha
          </th>
          <th className={CS_TH}>
            Visco<br />Độ nhớt
          </th>
          <th className={CS_TH}>
            CA (g/m²)<br />Lượng sơn
          </th>
          <th className={CS_TH}>
            Method<br />PP thi công
          </th>
          <th className={CS_TH}>
            Drying Time<br />Thời gian khô
          </th>
        </tr>
      </thead>
      <tbody>
        {stepsSlice.map((step) => {
          if (step.rowType === 'SANDING') {
            const spec = (step.sandingSpec || '').trim();
            return (
              <tr key={step.id} className="bg-slate-100 text-[8.5pt] font-semibold italic">
                <td className={CS_CELL} />
                <td colSpan={7} className={`${CS_CELL} text-left break-words`}>
                  SANDING / CHÀ NHÁM
                  {spec && <> — {keepRangesTogether(spec)}</>}
                </td>
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
                    className={`${CS_CELL} text-center font-bold whitespace-nowrap tabular-nums`}
                  >
                    {step.stepNumber}
                  </td>
                  <td
                    rowSpan={rowSpan}
                    className={`${CS_CELL} text-center font-bold break-words`}
                  >
                    {step.stepName}
                  </td>
                </>
              )}
              <td className={`${CS_PRODUCT_CELL} font-sans font-semibold break-words`}>
                {item.materialName || item.materialCode}
              </td>
              <td className={`${CS_CELL} text-center whitespace-nowrap tabular-nums`}>
                {item.mixingRatio}
              </td>
              {idx === 0 && (
                <>
                  <td
                    rowSpan={rowSpan}
                    className={`${CS_CELL} text-center break-words`}
                  >
                    {keepRangesTogether(step.visco ?? item.visco ?? '')}
                  </td>
                  <td
                    rowSpan={rowSpan}
                    className={`${CS_CELL} text-center font-semibold whitespace-nowrap tabular-nums`}
                  >
                    {step.caInputRaw}
                  </td>
                  <td
                    rowSpan={rowSpan}
                    className={`${CS_CELL} text-center font-semibold break-words`}
                  >
                    {step.methodName}
                  </td>
                  <td
                    rowSpan={rowSpan}
                    className={`${CS_CELL} text-center break-words`}
                  >
                    {keepRangesTogether(step.dryingTime)}
                  </td>
                </>
              )}
            </tr>
          ));
        })}
      </tbody>
    </table>
  );

  const renderCsRemark = (hasTableAbove: boolean) => (
    <div
      className={`${
        hasTableAbove
          ? 'mt-2.5 border-t border-slate-900 pt-1.5 print:mt-1.5 print:pt-1'
          : 'mt-2 print:mt-1.5'
      } space-y-0.5 text-[8pt] leading-snug print:space-y-0`}
    >
      <div className="font-semibold">Remark / Ghi chú:</div>
      <div>
        ALKANA VIET NAM does not assure the quality of the final product if: /
        ALKANA VIỆT NAM không đảm bảo chất lượng của sản phẩm cuối cùng nếu:
      </div>
      <div>
        1. The production process does not use 100% ALKANA materials. / 1. Quy
        trình sản xuất không sử dụng 100% nguyên vật liệu của ALKANA.
      </div>
      <div>
        2. The production process does not follow the ALKANA coating schedule. /
        2. Quy trình sản xuất không tuân thủ theo qui trình sơn của ALKANA.
      </div>
    </div>
  );

  const renderCsSignatures = () => (
    <div className="mt-3 grid grid-cols-4 gap-0 border border-slate-900 text-center text-[8pt] leading-tight print:mt-1.5 print:break-inside-avoid">
      <div className="border-r border-slate-900 p-1.5 print:p-1">
        <div className="border-b border-slate-400 pb-1 font-bold uppercase print:pb-0.5">
          CUSTOMER / KHÁCH HÀNG
        </div>
        <div className="h-14 print:h-10" />
        <div className="text-[8.5pt] font-semibold">
          {revision.customerConfirmName || ''}
        </div>
      </div>
      <div className="border-r border-slate-900 p-1.5 print:p-1">
        <div className="border-b border-slate-400 pb-1 font-bold uppercase print:pb-0.5">
          PD/PM / PHÒNG DỰ ÁN
        </div>
        <div className="h-14 print:h-10" />
        <div className="text-[8.5pt] font-semibold">
          {revision.approvedByPdPm || ''}
        </div>
      </div>
      <div className="border-r border-slate-900 p-1.5 print:p-1">
        <div className="border-b border-slate-400 pb-1 font-bold uppercase print:pb-0.5">
          TA / KỸ THUẬT
        </div>
        <div className="h-14 print:h-10" />
        <div className="text-[8.5pt] font-semibold">
          {revision.preparedByTa || ''}
        </div>
      </div>
      <div className="p-1.5 print:p-1">
        <div className="border-b border-slate-400 pb-1 font-bold uppercase print:pb-0.5">
          PROJECT LEADER / TRƯỞNG DỰ ÁN
        </div>
        <div className="h-14 print:h-10" />
        <div className="text-[8.5pt] font-semibold">
          {revision.checkedByLeader || ''}
        </div>
      </div>
    </div>
  );

  const renderCcTable = (
    stepsSlice: StepCostCalculation[],
    showTotalFooter: boolean
  ) => {
    if (!costSummary) return null;
    const ccNum = `${CELL} px-[2pt]`;
    return (
      <table className="w-full table-fixed border-collapse border border-slate-900 text-[8pt] leading-[1.2]">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '21%' }} />
          <col style={{ width: '8.5%' }} />
          <col style={{ width: '5%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '7.5%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        {stepsSlice.length > 0 && (
          <thead>
            <tr className="bg-slate-200 text-[7pt] font-bold print:bg-slate-100">
              <th className={CC_TH}>
                Item<br />Bước thi công
              </th>
              <th className={`${CC_TH} !px-[3pt] !text-left`}>
                Product Name<br />Tên sản phẩm
              </th>
              <th className={CC_TH}>
                Price<br />Đơn giá<br />(VND/Ltr)
              </th>
              <th className={CC_TH}>
                Ratio<br />Tỉ lệ pha
              </th>
              <th className={CC_TH}>
                Mixed Price<br />Giá HH<br />(VND/Ltr)
              </th>
              <th className={CC_TH}>
                Method<br />PP thi công
              </th>
              <th className={CC_TH}>
                CA (g/m²)<br />Lượng sơn
              </th>
              <th className={CC_TH}>
                Efficiency<br />Hiệu suất
              </th>
              <th className={CC_TH}>
                CA + Loss<br />Gồm hao hụt<br />(g/m²)
              </th>
              <th className={CC_TH}>
                Coverage<br />Định mức phủ<br />(m²/Ltr)
              </th>
              <th className={CC_TH}>
                Coating Cost<br />Chi phí<br />(VND/m²)
              </th>
            </tr>
          </thead>
        )}
        {stepsSlice.length > 0 && (
          <tbody>
            {stepsSlice.map((sc) => {
              const rowSpan = Math.max(1, sc.items.length);
              return sc.items.map((it, idx) => (
                <tr key={it.itemId}>
                  {idx === 0 && (
                    <td
                      rowSpan={rowSpan}
                      className={`${ccNum} text-center font-bold break-words`}
                    >
                      {sc.stepName}
                    </td>
                  )}
                  <td className={`${CS_PRODUCT_CELL} font-sans font-semibold break-words`}>
                    {it.materialName || it.materialCode}
                  </td>
                  <td className={`${ccNum} text-right whitespace-nowrap tabular-nums`}>
                    {formatVnd(it.priceSnapshotVnd)}
                  </td>
                  <td className={`${ccNum} text-center whitespace-nowrap tabular-nums`}>
                    {it.mixingRatio}
                  </td>
                  {idx === 0 && (
                    <>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-right font-semibold whitespace-nowrap tabular-nums`}
                      >
                        {formatVnd(sc.mixedPriceDisplay)}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-center font-semibold break-words`}
                      >
                        {sc.methodName}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-center whitespace-nowrap tabular-nums`}
                      >
                        {sc.caAvg}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-center whitespace-nowrap tabular-nums`}
                      >
                        {sc.efficiencyPercentDisplay}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-right whitespace-nowrap tabular-nums`}
                      >
                        {formatDecimal2(sc.caPlusLossDisplay)}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-right whitespace-nowrap tabular-nums`}
                      >
                        {formatCoverage(sc.coverageDisplay)}
                      </td>
                      <td
                        rowSpan={rowSpan}
                        className={`${ccNum} text-right font-bold whitespace-nowrap tabular-nums`}
                      >
                        {formatDecimal2(sc.coatingCostDisplay)}
                      </td>
                    </>
                  )}
                </tr>
              ));
            })}
          </tbody>
        )}
        {showTotalFooter && (
          <tfoot>
            <tr className="bg-slate-200 text-[9pt] font-bold print:bg-slate-100">
              <td colSpan={10} className={`${CELL} px-2 text-center`}>
                TOTAL COATING COST / TỔNG CHI PHÍ SƠN (VND/m²)
              </td>
              <td className={`${ccNum} text-right whitespace-nowrap tabular-nums`}>
                {formatVnd(costSummary.totalCoatingCostDisplay)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    );
  };

  const renderCcNotes = () => (
    <div className="mt-2.5 space-y-0.5 border-t border-slate-900 pt-1.5 text-[8pt] leading-snug print:mt-1.5 print:space-y-0 print:pt-1">
      <div className="italic">
        Notes: The price above is not including VAT 8% and valid for 30 days /
        Ghi chú: Đơn giá trên chưa bao gồm thuế VAT 8% và có hiệu lực trong 30
        ngày.
      </div>
      {revision.remark && (
        <div>
          <strong>REMARK / GHI CHÚ:</strong> {revision.remark}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px] rounded-xl bg-white p-5 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPrintMode('CS')}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
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
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  printMode === 'CC'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Coating Cost (CC) / Chi phí sơn
              </button>
            )}
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
              A4 Portrait / Khổ dọc • Total / Tổng: <strong>{totalPages}</strong> trang
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-3.5 w-3.5" />
              Print A4 - Export PDF / In A4 - Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Close / Đóng
            </button>
          </div>
        </div>

        {/* PAGINATED A4 SHEETS */}
        {printMode === 'CS' ? (
          <div className="space-y-6 print:space-y-0">
            {csPages.map((page, pageIdx) => (
              <div
                key={`cs-page-${pageIdx + 1}`}
                className="a4-print-page border border-slate-900 p-4 print:p-[2mm]"
              >
                {renderSheetHeader(pageIdx + 1, csPages.length)}
                {page.showMetadata && renderMetadataGrid()}
                {page.steps.length > 0 && (
                  <div className={page.showMetadata ? '' : 'mt-2 print:mt-1.5'}>
                    {renderCsTable(page.steps)}
                  </div>
                )}
                {page.showRemark && renderCsRemark(page.steps.length > 0)}
                {page.showSignatures && renderCsSignatures()}
              </div>
            ))}
          </div>
        ) : costSummary ? (
          <div className="space-y-6 print:space-y-0">
            {ccPages.map((page, pageIdx) => (
              <div
                key={`cc-page-${pageIdx + 1}`}
                className="a4-print-page border border-slate-900 p-4 print:p-[2mm]"
              >
                {renderSheetHeader(pageIdx + 1, ccPages.length)}
                {page.showMetadata && renderMetadataGrid()}
                <div className={page.showMetadata ? '' : 'mt-2 print:mt-1.5'}>
                  {renderCcTable(page.steps, page.showTotalAndNotes)}
                </div>
                {page.showTotalAndNotes && renderCcNotes()}
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-slate-900 p-4 print:p-[2mm]">
            {renderSheetHeader(1, 1)}
            {renderMetadataGrid()}
            <div className="my-8 rounded-lg border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 italic">
              No Coating Cost data or unauthorized / Không có dữ liệu chi phí sơn
              hoặc không có quyền truy cập.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
