import React from 'react';
import {
  ProjectRevision,
  BomSummary,
  UserRole,
  formatVnd
} from '@cscc/shared';
import { PackageCheck, Boxes } from 'lucide-react';

interface BomSummaryViewProps {
  revision: ProjectRevision;
  bomSummary: BomSummary;
  areaM2: number;
  role: UserRole;
  onChangeAreaM2: (area: number) => void;
}

export const BomSummaryView: React.FC<BomSummaryViewProps> = ({
  revision,
  bomSummary,
  areaM2,
  role,
  onChangeAreaM2
}) => {
  const showPrice = role !== 'TECHNICAL';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2.5">
            <Boxes className="h-5 w-5 text-blue-400" />
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide">
                BOM SUMMARY — BẢNG DỰ TOÁN ĐỊNH MỨC VẬT TƯ & SỐ THÙNG ĐẶT HÀNG
              </h2>
              <p className="text-xs text-slate-300">
                Gộp tự động các mã vật tư trùng nhau qua tất cả các bước trong Coating Schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-slate-800 px-3.5 py-2 border border-slate-700">
            <label className="text-xs font-semibold uppercase text-slate-300">
              Diện tích cần sơn (m²):
            </label>
            <input
              type="number"
              min="1"
              step="10"
              value={areaM2}
              onChange={(e) => onChangeAreaM2(Math.max(1, parseFloat(e.target.value) || 100))}
              className="w-28 rounded border border-blue-400 bg-slate-950 px-2.5 py-1 text-right text-sm font-bold text-white focus:outline-none"
            />
            <span className="text-xs font-bold text-blue-300">m²</span>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="text-xs font-medium text-slate-500">Tổng số Mã Hóa Chất (Unique)</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              {bomSummary.items.length} <span className="text-sm font-normal text-slate-500">mã</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3.5">
            <div className="text-xs font-medium text-slate-500">
              Tổng Khối lượng Sơn cần dùng (cho {areaM2.toLocaleString()} m²)
            </div>
            <div className="mt-1 text-2xl font-extrabold text-blue-700">
              {bomSummary.totalRequiredKgOrLtrDisplay.toLocaleString('en-US')}{' '}
              <span className="text-sm font-normal text-slate-500">Kg / Ltr</span>
            </div>
          </div>

          {showPrice ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5">
              <div className="text-xs font-semibold text-emerald-800">
                Tổng Chi phí Vật tư Dự kiến ({areaM2.toLocaleString()} m²)
              </div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-800">
                {formatVnd(bomSummary.totalProjectMaterialCostDisplay)}{' '}
                <span className="text-sm font-normal">VND</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
              <div className="text-xs font-semibold text-amber-800">Chế độ Kỹ thuật viên</div>
              <div className="mt-1 text-xs text-amber-900">
                Hiển thị định mức kỹ thuật (g/m², Kg/Ltr, số thùng). Đơn giá được ẩn theo phân quyền.
              </div>
            </div>
          )}
        </div>

        {/* BOM Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider text-[11px]">
                <th className="border border-slate-700 px-3 py-2.5 text-center w-12">#</th>
                <th className="border border-slate-700 px-3 py-2.5 text-left">Product Code</th>
                <th className="border border-slate-700 px-2.5 py-2.5 text-center">Packing</th>
                <th className="border border-slate-700 px-2.5 py-2.5 text-right">Nett (Kg/Ltr)</th>
                <th className="border border-slate-700 px-3 py-2.5 text-right">
                  Tổng CA + Loss (g/m²)
                </th>
                <th className="border border-slate-700 px-3 py-2.5 text-right bg-blue-900/50">
                  Lượng cần ({areaM2} m²)
                </th>
                <th className="border border-slate-700 px-3 py-2.5 text-center bg-blue-950">
                  Số thùng cần đặt (Làm tròn lên)
                </th>
                {showPrice && (
                  <>
                    <th className="border border-slate-700 px-3 py-2.5 text-right">
                      Đơn giá (VND/Kg)
                    </th>
                    <th className="border border-slate-700 px-3 py-2.5 text-right bg-emerald-950">
                      Thành tiền (VND)
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {bomSummary.items.map((item, idx) => (
                <tr
                  key={item.materialCode}
                  className="hover:bg-slate-50 transition border-b border-slate-200"
                >
                  <td className="border border-slate-200 px-3 py-2 text-center font-semibold text-slate-600">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 font-mono font-bold text-blue-950">
                    {item.materialCode}
                  </td>
                  <td className="border border-slate-200 px-2.5 py-2 text-center text-slate-600">
                    {item.packingDesc || '-'}
                  </td>
                  <td className="border border-slate-200 px-2.5 py-2 text-right font-medium text-slate-700">
                    {item.nettWeight}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-semibold text-slate-800">
                    {item.totalCaPlusLossGramPerM2Display.toFixed(2)} g/m²
                  </td>
                  <td className="border border-slate-200 bg-blue-50/40 px-3 py-2 text-right font-bold text-blue-900">
                    {item.totalRequiredKgOrLtrDisplay.toFixed(2)} Kg
                  </td>
                  <td className="border border-slate-200 bg-blue-100/50 px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-700 px-2.5 py-0.5 text-xs font-bold text-white">
                      <PackageCheck className="h-3.5 w-3.5" />
                      {item.packsToOrderRounded} thùng
                    </span>
                    <span className="ml-1.5 text-[10px] text-slate-500">
                      ({item.packsRequiredExact.toFixed(2)})
                    </span>
                  </td>
                  {showPrice && (
                    <>
                      <td className="border border-slate-200 px-3 py-2 text-right font-medium text-slate-700">
                        {formatVnd(item.priceUnitVnd)}
                      </td>
                      <td className="border border-slate-200 bg-emerald-50/40 px-3 py-2 text-right font-extrabold text-emerald-900">
                        {formatVnd(item.totalMaterialCostDisplay)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

