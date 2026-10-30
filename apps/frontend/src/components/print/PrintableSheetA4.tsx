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

interface PrintableSheetA4Props {
  revision: ProjectRevision;
  costSummary: CoatingCostSummary | null;
  role: UserRole;
  onClose: () => void;
}

export const PrintableSheetA4: React.FC<PrintableSheetA4Props> = ({
  revision,
  costSummary,
  role,
  onClose
}) => {
  const [printMode, setPrintMode] = React.useState<'CS' | 'CC'>('CS');
  const revCode = String(revision.revisionNo).padStart(2, '0');
  const canViewCost = role !== 'TECHNICAL' && costSummary !== null;

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
              Bản in Coating Schedule (CS)
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
                Bản in Coating Cost Calculation (CC)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              In A4 / Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Đóng
            </button>
          </div>
        </div>

        {/* A4 SHEET HEADER */}
        <div className="border-2 border-slate-900 p-4">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div>
              <div className="text-lg font-black tracking-wider text-blue-900">
                ALKANA
              </div>
              <div className="text-[11px] font-semibold italic text-slate-600">
                Performance Coatings
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">
                {printMode === 'CS'
                  ? 'COATING SCHEDULE'
                  : 'COATING COST CALCULATION'}
              </h1>
              <div className="text-xs font-semibold text-slate-600">
                No.: {revision.projectCode} | Rev.: {revCode} | Date:{' '}
                {revision.scheduleDate}
              </div>
            </div>
            <div className="text-right text-xs">
              <div>
                <strong>Status:</strong> {revision.status}
              </div>
              <div>
                <strong>Page:</strong> 1 / 1
              </div>
            </div>
          </div>

          {/* Synchronized Metadata Grid */}
          <div className="my-3 grid grid-cols-3 gap-2 border-b border-slate-400 pb-3 text-xs">
            <div>
              <div>
                <strong>Customer:</strong> {revision.customer.shortName}
              </div>
              <div>
                <strong>Substrate Type:</strong> {revision.substrate}
              </div>
              <div>
                <strong>Product Item:</strong> {revision.productName}
              </div>
            </div>
            <div>
              <div>
                <strong>Positioning:</strong> {revision.positioning}
              </div>
              <div>
                <strong>Finishing System:</strong> {revision.finishingSystem}
              </div>
              <div>
                <strong>Gloss Level:</strong> {revision.glossLevel}
              </div>
            </div>
            <div>
              <div>
                <strong>Color:</strong> {revision.colorName}
              </div>
              <div>
                <strong>MC wood:</strong> {revision.mcWood} |{' '}
                <strong>Humidity:</strong> {revision.roomHumidity}
              </div>
              <div>
                <strong>Room temp.:</strong> {revision.roomTemp}
              </div>
            </div>
          </div>

          {/* TABLE CONTENT: CS OR CC (Clean Product Code only, no Packing info) */}
          {printMode === 'CS' ? (
            <table className="w-full border-collapse border border-slate-900 text-[11px]">
              <thead>
                <tr className="bg-slate-200 font-bold uppercase">
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    No.
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    Application Step
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-left">
                    Product Code
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    Mixing Ratio
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    Visco
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    CA (g/m²)
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    Application Method
                  </th>
                  <th className="border border-slate-900 px-2 py-1 text-center">
                    Drying Time Recommended
                  </th>
                </tr>
              </thead>
              <tbody>
                {revision.steps.map((step) => {
                  if (step.rowType === 'SANDING') {
                    return (
                      <tr key={step.id} className="italic">
                        <td className="border border-slate-900 px-2 py-1 text-center" />
                        <td className="border border-slate-900 px-2 py-1 text-center font-semibold">
                          SANDING
                        </td>
                        <td className="border border-slate-900 px-2 py-1" />
                        <td className="border border-slate-900 px-2 py-1" />
                        <td className="border border-slate-900 px-2 py-1" />
                        <td className="border border-slate-900 px-2 py-1" />
                        <td className="border border-slate-900 px-2 py-1 text-center font-semibold">
                          {step.sandingSpec}
                        </td>
                        <td className="border border-slate-900 px-2 py-1" />
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
                            className="border border-slate-900 px-2 py-1 text-center font-bold"
                          >
                            {step.stepNumber}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-2 py-1 text-center font-bold"
                          >
                            {step.stepName}
                          </td>
                        </>
                      )}
                      <td className="border border-slate-900 px-2 py-1 font-mono font-semibold">
                        {item.materialCode}
                      </td>
                      <td className="border border-slate-900 px-2 py-1 text-center">
                        {item.mixingRatio}
                      </td>
                      {idx === 0 && (
                        <>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-2 py-1 text-center"
                          >
                            {item.visco ? `${item.visco}" DIN4` : ''}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-2 py-1 text-center font-semibold"
                          >
                            {step.caInputRaw}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-2 py-1 text-center font-semibold"
                          >
                            {step.methodName}
                          </td>
                          <td
                            rowSpan={rowSpan}
                            className="border border-slate-900 px-2 py-1 text-center"
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
          ) : (
            costSummary && (
              <table className="w-full border-collapse border border-slate-900 text-[11px]">
                <thead>
                  <tr className="bg-slate-200 font-bold uppercase">
                    <th className="border border-slate-900 px-2 py-1 text-center">
                      Item
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-left">
                      Product type
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-right">
                      Price (VND/Ltr)
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-center">
                      Mixing Ratio
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-right">
                      Mixed Price (VND/Ltr set)
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-center">
                      Application
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-center">
                      Coating Amount (g/m²)
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-center">
                      Application Efficiency
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-right">
                      CA + Loss (g/m²)
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-right">
                      Coverage (m²/Ltr/kg)
                    </th>
                    <th className="border border-slate-900 px-2 py-1 text-right">
                      Coating Cost (vnd/m²)
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
                            className="border border-slate-900 px-2 py-1 text-center font-bold"
                          >
                            {sc.stepName}
                          </td>
                        )}
                        <td className="border border-slate-900 px-2 py-1 font-mono">
                          {it.materialCode}
                        </td>
                        <td className="border border-slate-900 px-2 py-1 text-right">
                          {formatVnd(it.priceSnapshotVnd)}
                        </td>
                        <td className="border border-slate-900 px-2 py-1 text-center">
                          {it.mixingRatio}
                        </td>
                        {idx === 0 && (
                          <>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-right font-semibold"
                            >
                              {formatVnd(sc.mixedPriceDisplay)}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-center font-semibold"
                            >
                              {sc.methodName}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-center"
                            >
                              {sc.caAvg}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-center"
                            >
                              {sc.efficiencyPercentDisplay}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-right"
                            >
                              {formatDecimal2(sc.caPlusLossDisplay)}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-right"
                            >
                              {formatCoverage(sc.coverageDisplay)}
                            </td>
                            <td
                              rowSpan={rowSpan}
                              className="border border-slate-900 px-2 py-1 text-right font-bold"
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
                  <tr className="bg-slate-200 font-bold">
                    <td
                      colSpan={10}
                      className="border border-slate-900 px-2 py-1.5 text-center"
                    >
                      TOTAL COATING COST (VND/m²)
                    </td>
                    <td className="border border-slate-900 px-2 py-1.5 text-right text-sm">
                      {formatVnd(costSummary.totalCoatingCostDisplay)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )
          )}

          {/* REMARK & 4 SIGNATURE BOXES */}
          <div className="mt-3 border-t border-slate-900 pt-2 text-[11px] space-y-0.5">
            {printMode === 'CS' ? (
              <>
                <div className="font-semibold">Remark</div>
                <div>
                  ALKANA VIET NAM does not assure the quality of the final
                  product if:
                </div>
                <div>
                  1. The production process does not use 100% ALKANA materials.
                </div>
                <div>
                  2. The production process does not follow the ALKANA coating
                  schedule.
                </div>
              </>
            ) : (
              <>
                <div className="italic">
                  Notes: The price above is not including VAT 8% and valid for
                  30 days
                </div>
                {revision.remark && (
                  <div>
                    <strong>REMARK:</strong> {revision.remark}
                  </div>
                )}
              </>
            )}
          </div>

          {printMode === 'CS' && (
            <div className="mt-4 grid grid-cols-4 gap-0 border border-slate-900 text-center text-xs">
              <div className="border-r border-slate-900 p-2">
                <div className="font-bold uppercase border-b border-slate-400 pb-1">
                  CUSTOMER
                </div>
                <div className="h-16" />
                <div className="font-semibold">
                  {revision.customerConfirmName || ''}
                </div>
              </div>
              <div className="border-r border-slate-900 p-2">
                <div className="font-bold uppercase border-b border-slate-400 pb-1">
                  PD/PM
                </div>
                <div className="h-16" />
                <div className="font-semibold">
                  {revision.approvedByPdPm || ''}
                </div>
              </div>
              <div className="border-r border-slate-900 p-2">
                <div className="font-bold uppercase border-b border-slate-400 pb-1">
                  TA
                </div>
                <div className="h-16" />
                <div className="font-semibold">
                  {revision.preparedByTa || ''}
                </div>
              </div>
              <div className="p-2">
                <div className="font-bold uppercase border-b border-slate-400 pb-1">
                  PROJECT LEADER
                </div>
                <div className="h-16" />
                <div className="font-semibold">
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
