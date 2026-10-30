import React from 'react';
import {
  ProjectRevision,
  CoatingCostSummary,
  formatVnd,
  formatDecimal2,
  formatCoverage
} from '@cscc/shared';
import {
  ShieldCheck,
  Calculator,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface CoatingCostTableProps {
  revision: ProjectRevision;
  costSummary: CoatingCostSummary;
}

export const CoatingCostTable: React.FC<CoatingCostTableProps> = ({
  revision,
  costSummary
}) => {
  const revCode = String(revision.revisionNo).padStart(2, '0');

  const [hasHorizontalOverflow, setHasHorizontalOverflow] = React.useState(false);
  const [scrollMetrics, setScrollMetrics] = React.useState({
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 1000
  });

  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement>(null);
  const tableElRef = React.useRef<HTMLTableElement>(null);
  const isSyncingRef = React.useRef(false);

  const measureOverflow = React.useCallback(() => {
    const container = tableScrollRef.current;
    const tableEl = tableElRef.current;
    if (!container || !tableEl) return;
    const clientWidth = container.clientWidth;
    const scrollWidth = Math.max(tableEl.scrollWidth, tableEl.offsetWidth);
    const overflows = scrollWidth > clientWidth + 2;
    setHasHorizontalOverflow(overflows);
    setScrollMetrics({
      scrollLeft: overflows ? container.scrollLeft : 0,
      scrollWidth,
      clientWidth
    });
  }, []);

  React.useEffect(() => {
    measureOverflow();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureOverflow())
        : null;
    if (ro) {
      if (tableScrollRef.current) ro.observe(tableScrollRef.current);
      if (tableElRef.current) ro.observe(tableElRef.current);
    }
    window.addEventListener('resize', measureOverflow);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, [measureOverflow, costSummary.steps.length]);

  const syncScroll = (source: 'table' | 'bottom', left: number) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    if (source !== 'table' && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = left;
    }
    if (source !== 'bottom' && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = left;
    }
    setScrollMetrics((prev) =>
      Math.abs(prev.scrollLeft - left) > 1 ? { ...prev, scrollLeft: left } : prev
    );
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
  };

  const scrollHorizontallyBy = (delta: number) => {
    if (!tableScrollRef.current) return;
    const nextLeft = Math.max(
      0,
      Math.min(
        scrollMetrics.scrollWidth - scrollMetrics.clientWidth,
        tableScrollRef.current.scrollLeft + delta
      )
    );
    tableScrollRef.current.scrollTo({ left: nextLeft, behavior: 'smooth' });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-900 px-5 py-3 text-white rounded-t-xl">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold tracking-wide uppercase">
                COATING COST CALCULATION (CC — CHẾ ĐỘ CHỈ XEM / READ-ONLY)
              </h2>
              <p className="text-xs text-emerald-200">
                Tự động đồng bộ Header, Đơn giá, Hiệu suất & Công thức thời gian thực từ Coating Schedule (CS)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-800 border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              IEEE-754 Exact Intermediate Precision
            </span>
          </div>
        </div>

        {/* Synchronized Header Grid matching reference image */}
        <div className="grid grid-cols-2 gap-4 bg-emerald-50/40 p-4 text-xs md:grid-cols-4 border-b border-emerald-100">
          <div>
            <span className="text-slate-500 font-medium">Customer Name:</span>{' '}
            <strong className="text-slate-900">{revision.customer.shortName}</strong>
            <div className="text-[11px] text-slate-500">
              Date: {revision.scheduleDate}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Product Item:</span>{' '}
            <strong className="text-slate-900">{revision.productName}</strong>
            <div className="text-[11px] text-slate-500">
              Color: <strong>{revision.colorName}</strong> | Substrate:{' '}
              <strong>{revision.substrate}</strong>
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Finishing System:</span>{' '}
            <strong className="text-slate-900">{revision.finishingSystem}</strong>
            <div className="text-[11px] text-slate-500">
              Sheen: <strong>{revision.glossLevel}</strong>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase font-bold text-emerald-700">
              TOTAL COATING COST (VND/m²)
            </div>
            <div className="text-xl font-extrabold text-emerald-800">
              {formatVnd(costSummary.totalCoatingCostDisplay)} VND/m²
            </div>
            <div className="text-[10px] text-slate-500">
              No.: {revision.projectCode} | Rev.{revCode}
            </div>
          </div>
        </div>

        {/* 2. DYNAMIC MERGED COATING COST TABLE (11 Columns matching reference image, no Packing column) */}
        <div
          ref={tableScrollRef}
          onScroll={(e) => syncScroll('table', e.currentTarget.scrollLeft)}
          className={hasHorizontalOverflow ? 'overflow-x-auto' : 'overflow-visible'}
        >
          <table ref={tableElRef} className="w-full border-collapse text-xs">
            <thead
              className={!hasHorizontalOverflow ? 'sticky top-[57px] z-20 shadow-sm' : ''}
            >
              <tr className="bg-emerald-800 text-white uppercase tracking-wider text-[10px]">
                <th className="sticky left-0 z-20 bg-emerald-800 border border-emerald-700 px-2 py-2.5 text-center min-w-[115px]">
                  Item
                </th>
                <th className="border border-emerald-700 px-2.5 py-2.5 text-left min-w-[175px]">
                  Product type
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-right min-w-[85px]">
                  Price (VND/Ltr)
                </th>
                <th className="border border-emerald-700 px-1.5 py-2.5 text-center min-w-[58px]">
                  Mixing Ratio
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-right min-w-[90px] bg-emerald-900/60">
                  Mixed Price (VND/Ltr set)
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-center min-w-[76px]">
                  Application
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-center min-w-[74px]">
                  Coating Amount (g/m²)
                </th>
                <th className="border border-emerald-700 px-1.5 py-2.5 text-center min-w-[68px]">
                  Application Efficiency
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-right min-w-[78px] bg-emerald-900/60">
                  CA + Loss (g/m²)
                </th>
                <th className="border border-emerald-700 px-2 py-2.5 text-right min-w-[78px] bg-emerald-900/60">
                  Coverage (m²/Ltr/kg)
                </th>
                <th className="sticky right-0 z-20 border border-emerald-700 px-2.5 py-2.5 text-right min-w-[110px] bg-emerald-950 shadow-[-4px_0_8px_rgba(0,0,0,0.15)]">
                  Coating Cost (vnd/m²)
                </th>
              </tr>
            </thead>
            <tbody>
              {costSummary.steps.map((stepCalc) => {
                const rowSpan = Math.max(1, stepCalc.items.length);

                return stepCalc.items.map((item, itemIdx) => {
                  const isFirstRow = itemIdx === 0;
                  return (
                    <tr
                      key={item.itemId}
                      className="hover:bg-emerald-50/40 transition border-b border-slate-200"
                    >
                      {/* Col 1: Item / Application Step (Merged via rowSpan & Sticky Left) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-2 py-2 text-center align-middle font-bold text-slate-900"
                        >
                          {stepCalc.stepName}
                        </td>
                      )}

                      {/* Col 2: Product type (Clean materialCode ONLY — no packing info) */}
                      <td className="border border-slate-200 px-2.5 py-1.5 font-mono font-semibold text-slate-900">
                        {item.materialCode}
                      </td>

                      {/* Col 3: Price (VND/Ltr) */}
                      <td className="border border-slate-200 px-2 py-1.5 text-right font-semibold text-slate-800">
                        {formatVnd(item.priceSnapshotVnd)}
                      </td>

                      {/* Col 4: Mixing Ratio */}
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center font-semibold text-slate-900">
                        {item.mixingRatio}
                      </td>

                      {/* Col 5: Mixed Price (VND/Ltr set) (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          title={`Unrounded: ${stepCalc.mixedPriceRaw}`}
                          className="border border-slate-300 bg-emerald-50/30 px-2 py-2 text-right align-middle font-bold text-slate-900"
                        >
                          {formatVnd(stepCalc.mixedPriceDisplay)}
                        </td>
                      )}

                      {/* Col 6: Application Method (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/60 px-2 py-2 text-center align-middle font-bold text-slate-800"
                        >
                          {stepCalc.methodName}
                        </td>
                      )}

                      {/* Col 7: Coating Amount (g/m²) (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/60 px-2 py-2 text-center align-middle font-bold text-slate-900"
                        >
                          {stepCalc.caAvg}
                        </td>
                      )}

                      {/* Col 8: Application Efficiency (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/60 px-1.5 py-2 text-center align-middle font-bold text-slate-800"
                        >
                          {stepCalc.efficiencyPercentDisplay}
                        </td>
                      )}

                      {/* Col 9: CA + Loss (g/m²) (2 decimals: 314.29 / 183.33) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          title={`Unrounded: ${stepCalc.caPlusLossRaw}`}
                          className="border border-slate-300 bg-emerald-50/30 px-2 py-2 text-right align-middle font-bold text-slate-900"
                        >
                          {formatDecimal2(stepCalc.caPlusLossDisplay)}
                        </td>
                      )}

                      {/* Col 10: Coverage (m²/Ltr/kg) (2 decimals: 3.18 / 5.45) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          title={`Unrounded: ${stepCalc.coverageRaw}`}
                          className="border border-slate-300 bg-emerald-50/30 px-2 py-2 text-right align-middle font-bold text-slate-900"
                        >
                          {formatCoverage(stepCalc.coverageDisplay)}
                        </td>
                      )}

                      {/* Col 11: Step Coating Cost (vnd/m²) (2 decimals: 119,219.05 / 69,544.44) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          title={`Unrounded: ${stepCalc.coatingCostRaw}`}
                          className="sticky right-0 z-10 border border-slate-300 bg-emerald-100 px-2.5 py-2 text-right align-middle font-extrabold text-emerald-950 text-sm shadow-[-4px_0_8px_rgba(0,0,0,0.06)]"
                        >
                          {formatDecimal2(stepCalc.coatingCostDisplay)}
                        </td>
                      )}
                    </tr>
                  );
                });
              })}
            </tbody>

            {/* TOTAL COATING COST FOOTER */}
            <tfoot>
              <tr className="bg-emerald-950 text-white font-bold">
                <td
                  colSpan={10}
                  className="border border-emerald-800 px-4 py-3 text-center text-sm uppercase tracking-wider"
                >
                  TOTAL COATING COST (VND/m²)
                </td>
                <td
                  title={`Exact IEEE-754 Sum: ${costSummary.totalCoatingCostRaw}`}
                  className="sticky right-0 z-10 border border-emerald-800 bg-emerald-950 px-2.5 py-3 text-right text-base font-extrabold text-emerald-300 shadow-[-4px_0_8px_rgba(0,0,0,0.2)]"
                >
                  {formatVnd(costSummary.totalCoatingCostDisplay)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* FLOATING STICKY BOTTOM HORIZONTAL SCROLLBAR FOR COATING COST TABLE */}
        {hasHorizontalOverflow && (
          <div className="sticky bottom-0 z-30 flex items-center gap-2 border-t border-emerald-300 bg-emerald-950/95 px-3 py-2 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] backdrop-blur">
            <span className="text-[11px] font-bold text-emerald-300 shrink-0">
              Thanh cuộn ngang nổi:
            </span>
            <button
              type="button"
              onClick={() =>
                tableScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
              }
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center rounded bg-emerald-900 px-1.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-800 disabled:opacity-40"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontallyBy(-220)}
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center gap-0.5 rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Trái
            </button>

            <div
              ref={bottomScrollRef}
              onScroll={(e) => syncScroll('bottom', e.currentTarget.scrollLeft)}
              className="flex-1 overflow-x-auto overflow-y-hidden h-4 rounded bg-emerald-800"
            >
              <div
                style={{
                  width: `${scrollMetrics.scrollWidth}px`,
                  height: '1px'
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => scrollHorizontallyBy(220)}
              disabled={
                scrollMetrics.scrollLeft + scrollMetrics.clientWidth >=
                scrollMetrics.scrollWidth - 2
              }
              className="inline-flex items-center gap-0.5 rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-800 disabled:opacity-40"
            >
              Phải
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                tableScrollRef.current?.scrollTo({
                  left: scrollMetrics.scrollWidth - scrollMetrics.clientWidth,
                  behavior: 'smooth'
                })
              }
              disabled={
                scrollMetrics.scrollLeft + scrollMetrics.clientWidth >=
                scrollMetrics.scrollWidth - 2
              }
              className="inline-flex items-center rounded bg-emerald-900 px-1.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-800 disabled:opacity-40"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Notes & Remark Footer matching reference image */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 space-y-1">
          <div className="italic text-slate-600">
            Notes: The price above is not including VAT 8% and valid for 30 days
          </div>
          {revision.remark && (
            <div>
              <strong>REMARK:</strong> {revision.remark}
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
            <Info className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
            <span>
              Giữ nguyên độ chính xác số thực IEEE-754 ở các bước trung gian, chỉ làm tròn ở bước hiển thị cuối cùng.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
