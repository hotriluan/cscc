import React from 'react';
import {
  AggregatedBomForecastReport,
  BomForecastInputAllocation,
  Project,
  ReportFilterQuery,
  ReportsOverviewResponse,
  ReportSubTab,
  RevisionScopeFilter,
  UserAccount,
  UserRole,
  formatDecimal2,
  formatVnd
} from '@cscc/shared';
import { apiClient } from '../../api/client';
import {
  ComboboxOption,
  SearchableCombobox
} from '../common/SearchableCombobox';
import {
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  FlaskConical,
  GitCompare,
  Layers,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  X
} from 'lucide-react';

interface ReportsAnalyticsViewProps {
  role: UserRole;
  currentUser?: UserAccount | null;
  projects: Project[];
  activeReportTab: ReportSubTab;
  onChangeReportTab: (tab: ReportSubTab) => void;
  onSelectRevision: (revisionId: string) => Promise<void>;
}

const REPORT_TABS: Array<{
  id: ReportSubTab;
  shortTitleEn: string;
  shortTitleVi: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'PRODUCT_USAGE',
    shortTitleEn: '1. Product Usage',
    shortTitleVi: 'Theo Sản phẩm Sơn',
    icon: FlaskConical
  },
  {
    id: 'CUSTOMER_PORTFOLIO',
    shortTitleEn: '2. Customer Portfolio',
    shortTitleVi: 'Theo Khách hàng',
    icon: Building2
  },
  {
    id: 'REVISION_VARIANCE',
    shortTitleEn: '3. Revision Variance',
    shortTitleVi: 'Biến động Revision',
    icon: GitCompare
  },
  {
    id: 'PRICE_DRIFT',
    shortTitleEn: '4. Price & Quotation Alert',
    shortTitleVi: 'Chênh lệch Giá & Báo giá',
    icon: ShieldAlert
  },
  {
    id: 'STEP_BENCHMARK',
    shortTitleEn: '5. Step & System Benchmark',
    shortTitleVi: 'Cơ cấu Công đoạn & Hệ sơn',
    icon: Layers
  },
  {
    id: 'BOM_FORECAST',
    shortTitleEn: '6. Multi-BOM Forecast',
    shortTitleVi: 'Dự báo BOM Tổng hợp',
    icon: Boxes
  },
  {
    id: 'ACTIVITY_FUNNEL',
    shortTitleEn: '7. Sales & TA Funnel',
    shortTitleVi: 'Hiệu suất Sales & TA',
    icon: Users
  }
];

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({
  role,
  currentUser,
  projects,
  activeReportTab,
  onChangeReportTab,
  onSelectRevision
}) => {
  const canViewCost = role !== 'TECHNICAL';

  const isLockedToSalesman =
    (role === 'SALES' || role === 'TECHNICAL') &&
    Boolean(currentUser?.salesmanName && currentUser.salesmanName.trim() !== '');

  const enforcedSalesman = isLockedToSalesman
    ? currentUser!.salesmanName!.trim()
    : null;

  // Global Filter States
  const [revisionScope, setRevisionScope] =
    React.useState<RevisionScopeFilter>('ALL');
  const [salesmanFilter, setSalesmanFilter] = React.useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = React.useState<string>('ALL');
  const [systemFilter, setSystemFilter] = React.useState<string>('ALL');
  const [keyword, setKeyword] = React.useState<string>('');

  // Tab 1 specific filters
  const [selectedMaterialCode, setSelectedMaterialCode] =
    React.useState<string>('ALL');
  const [selectedFurnitureProduct, setSelectedFurnitureProduct] =
    React.useState<string>('ALL');

  // Tab 2 specific expand state
  const [expandedCustomerIds, setExpandedCustomerIds] = React.useState<
    Record<string, boolean>
  >({});
  const [onlyCustomersWithCs, setOnlyCustomersWithCs] =
    React.useState<boolean>(true);

  // Tab 3 specific project comparison selector
  const [compareProjectId, setCompareProjectId] = React.useState<string>('');
  const [baseRevId, setBaseRevId] = React.useState<string>('');
  const [targetRevId, setTargetRevId] = React.useState<string>('');

  // Tab 4 specific status filter
  const [driftStatusFilter, setDriftStatusFilter] = React.useState<
    'ALL' | 'ALERTS_ONLY' | 'PRICE_DRIFT' | 'EXPIRED' | 'MISSING_QUOTATION'
  >('ALL');

  // Tab 6 custom BOM allocations state
  const [customBomAllocations, setCustomBomAllocations] = React.useState<
    Record<string, { areaM2: number; selected: boolean }>
  >({});
  const [bomForecastOverride, setBomForecastOverride] =
    React.useState<AggregatedBomForecastReport | null>(null);
  const [recalculatingBom, setRecalculatingBom] = React.useState<boolean>(false);

  const [overview, setOverview] =
    React.useState<ReportsOverviewResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [exporting, setExporting] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const activeQuery = React.useMemo<ReportFilterQuery>(
    () => ({
      revisionScope,
      salesmanName: isLockedToSalesman
        ? enforcedSalesman || undefined
        : salesmanFilter !== 'ALL'
          ? salesmanFilter
          : undefined,
      customerId: customerFilter !== 'ALL' ? customerFilter : undefined,
      materialCode:
        selectedMaterialCode !== 'ALL' ? selectedMaterialCode : undefined,
      productName:
        selectedFurnitureProduct !== 'ALL'
          ? selectedFurnitureProduct
          : undefined,
      finishingSystem: systemFilter !== 'ALL' ? systemFilter : undefined,
      q: keyword.trim() || undefined,
      compareProjectId: compareProjectId || undefined,
      baseRevId: baseRevId || undefined,
      targetRevId: targetRevId || undefined
    }),
    [
      revisionScope,
      isLockedToSalesman,
      enforcedSalesman,
      salesmanFilter,
      customerFilter,
      selectedMaterialCode,
      selectedFurnitureProduct,
      systemFilter,
      keyword,
      compareProjectId,
      baseRevId,
      targetRevId
    ]
  );

  const fetchOverview = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiClient.getReportsOverview(
        role,
        activeQuery,
        enforcedSalesman
      );
      setOverview(data);
      setBomForecastOverride(null);

      // Initialize custom BOM allocations from server response
      const nextAlloc: Record<string, { areaM2: number; selected: boolean }> =
        {};
      for (const a of data.bomForecast.allocations) {
        nextAlloc[a.revisionId] = {
          areaM2: a.areaM2,
          selected: a.selected
        };
      }
      setCustomBomAllocations(nextAlloc);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [role, activeQuery, enforcedSalesman]);

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleRecalculateBomForecast = async (
    nextState: Record<string, { areaM2: number; selected: boolean }>
  ) => {
    setRecalculatingBom(true);
    try {
      const allocations: BomForecastInputAllocation[] = Object.entries(
        nextState
      ).map(([revisionId, val]) => ({
        revisionId,
        areaM2: val.areaM2,
        selected: val.selected
      }));
      const res = await apiClient.calculateAggregatedBomForecast(
        role,
        {
          query: activeQuery,
          allocations
        },
        enforcedSalesman
      );
      setBomForecastOverride(res);
    } catch (err) {
      console.error('Failed to recalculate BOM forecast:', err);
    } finally {
      setRecalculatingBom(false);
    }
  };

  const handleExportExcel = async (target: ReportSubTab | 'ALL') => {
    setExporting(true);
    try {
      await apiClient.downloadReportExcel(
        role,
        activeQuery,
        target,
        enforcedSalesman
      );
    } catch (err) {
      alert(
        `Export failed / Lỗi xuất Excel: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setExporting(false);
    }
  };

  // Combobox options for Customer filter
  const customerComboboxOptions = React.useMemo<ComboboxOption[]>(() => {
    const list = overview?.meta.availableCustomers || [];
    const opts: ComboboxOption[] = [
      {
        value: 'ALL',
        label: 'All Customers / Tất cả Khách hàng',
        badge: `${list.length} KH`,
        badgeColor: 'blue'
      }
    ];
    for (const c of list) {
      opts.push({
        value: c.customerId,
        label: c.shortName,
        sublabel: c.salesmanName
          ? `${c.customerName} • Sales: ${c.salesmanName}`
          : c.customerName,
        badge: c.customerId,
        badgeColor: 'emerald',
        keywords: `${c.customerId} ${c.shortName} ${c.customerName} ${c.salesmanName || ''}`
      });
    }
    return opts;
  }, [overview?.meta.availableCustomers]);

  // Combobox options for Chemical Material (Tab 1)
  const materialComboboxOptions = React.useMemo<ComboboxOption[]>(() => {
    const catalog = overview?.productUsage.productCatalog || [];
    const opts: ComboboxOption[] = [
      {
        value: 'ALL',
        label:
          'All Chemical Products / Tất cả Sản phẩm Sơn đang dùng trong CS',
        badge: `${catalog.length} mã`,
        badgeColor: 'blue'
      }
    ];
    for (const item of catalog) {
      opts.push({
        value: item.materialCode,
        label: `${item.materialCode} — ${item.materialName}`,
        sublabel: `Packing: ${item.packingDesc || '-'} (${item.nettWeight} Kg/Ltr) • Used in ${item.usageRevisionCount} Rev(s), ${item.customerCount} Customer(s)`,
        badge: `${item.usageRevisionCount} Rev`,
        badgeColor: 'emerald',
        keywords: `${item.materialCode} ${item.materialName}`
      });
    }
    return opts;
  }, [overview?.productUsage.productCatalog]);

  const activeBomData = bomForecastOverride ?? overview?.bomForecast ?? null;

  return (
    <div className="space-y-5">
      {/* =====================================================================
          1. TOP HEADER & GLOBAL FILTER BAR (EN / VI)
         ===================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                REPORTS & ANALYTICS CENTER / TRUNG TÂM BÁO CÁO & PHÂN TÍCH DỮ LIỆU
              </h2>
              <p className="text-xs text-slate-500">
                Multi-dimensional CS, CC & BOM Analytics with Role-based Cost Redaction & Salesman Isolation / Phân tích đa chiều CS, CC, BOM theo phân quyền Role & Salesman
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isLockedToSalesman ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
                    <Lock className="h-3.5 w-3.5 text-amber-700" />
                    Salesman Scope / Phạm vi dữ liệu: {enforcedSalesman} ({role})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-700" />
                    Full Data Access / Toàn quyền truy cập dữ liệu ({role})
                  </span>
                )}

                {!canViewCost && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    🔒 Technical Mode: All Prices & Coating Costs Redacted / Chế độ Kỹ thuật TA: Đã ẩn toàn bộ Đơn giá & Chi phí (VND/m²)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Export Excel Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOverview()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`}
              />
              Refresh / Làm mới
            </button>

            <button
              type="button"
              disabled={exporting || loading}
              onClick={() => handleExportExcel(activeReportTab)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Active Tab (.xlsx) / Xuất Tab hiện tại
            </button>

            <button
              type="button"
              disabled={exporting || loading}
              onClick={() => handleExportExcel('ALL')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export All 7 Reports (.xlsx) / Xuất Trọn bộ 7 Báo cáo
            </button>
          </div>
        </div>

        {/* Revision Scope Filter Bar + Multi-dimensional Filters */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 lg:grid-cols-12">
          {/* Revision Scope Switcher (ALL | LATEST | APPROVED) */}
          <div className="lg:col-span-5">
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Revision Scope / Phạm vi Phiên bản (Rev):
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
              {(
                [
                  {
                    val: 'ALL' as RevisionScopeFilter,
                    en: 'All Revisions',
                    vi: 'Tất cả Rev'
                  },
                  {
                    val: 'LATEST' as RevisionScopeFilter,
                    en: 'Latest Rev Only',
                    vi: 'Chỉ Rev mới nhất'
                  },
                  {
                    val: 'APPROVED' as RevisionScopeFilter,
                    en: 'Approved Only',
                    vi: 'Chỉ bản Đã duyệt'
                  }
                ] as const
              ).map((opt) => {
                const active = revisionScope === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setRevisionScope(opt.val)}
                    className={`rounded-md px-2 py-1.5 text-center transition ${
                      active
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'text-slate-700 hover:bg-white font-semibold'
                    }`}
                  >
                    <div className="text-[11px] leading-tight">{opt.en}</div>
                    <div
                      className={`text-[10px] leading-tight ${
                        active ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {opt.vi}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Salesman Filter (Editable for ADMIN/PROJECT_LEADER, Locked for SALES/TECHNICAL) */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Salesman / Nhân viên Kinh doanh:
            </label>
            {isLockedToSalesman ? (
              <div className="flex h-[38px] items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900">
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                <span className="truncate">{enforcedSalesman}</span>
              </div>
            ) : (
              <select
                value={salesmanFilter}
                onChange={(e) => setSalesmanFilter(e.target.value)}
                className="h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
              >
                <option value="ALL">
                  All Salesmen / Tất cả Salesman (
                  {overview?.meta.availableSalesmen.length || 0})
                </option>
                <option value="__UNASSIGNED__">
                  Unassigned / Chưa gán Salesman
                </option>
                {(overview?.meta.availableSalesmen || []).map((s) => (
                  <option key={s} value={s}>
                    💼 {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Customer Filter */}
          <div className="lg:col-span-4">
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Customer / Khách hàng:
            </label>
            <SearchableCombobox
              compact
              value={customerFilter}
              options={customerComboboxOptions}
              onChange={(val) => setCustomerFilter(val || 'ALL')}
              placeholder="Select customer / Chọn khách hàng..."
            />
          </div>

          {/* Keyword Search */}
          <div className="lg:col-span-6">
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Quick Search / Tìm kiếm nhanh (Mã dự án, SP, màu, mã hóa chất, TA):
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search project NTR 001, customer, furniture item, chemical code, TA..."
                className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-xs font-medium focus:border-blue-600 focus:outline-none"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Finishing System Filter */}
          <div className="lg:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
              Finishing System / Hệ sơn:
            </label>
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="ALL">All Systems / Tất cả Hệ sơn</option>
              {(overview?.meta.availableFinishingSystems || []).map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
            </select>
          </div>

          {/* Reset All Filters Button */}
          <div className="lg:col-span-3 flex items-end">
            <button
              type="button"
              onClick={() => {
                setRevisionScope('ALL');
                setSalesmanFilter('ALL');
                setCustomerFilter('ALL');
                setSystemFilter('ALL');
                setSelectedMaterialCode('ALL');
                setSelectedFurnitureProduct('ALL');
                setKeyword('');
                setCompareProjectId('');
                setBaseRevId('');
                setTargetRevId('');
              }}
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
            >
              Reset Filters / Đặt lại bộ lọc mặc định
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. 7 SUB-TABS NAVIGATION BAR (EN / VI)
         ===================================================================== */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeReportTab(tab.id)}
              className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition ${
                isActive
                  ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-blue-600'
                  }`}
                />
                {tab.id === 'PRICE_DRIFT' &&
                  overview &&
                  overview.priceDrift.summary.priceDriftCount +
                    overview.priceDrift.summary.expiredQuotationCount +
                    overview.priceDrift.summary.missingQuotationCount >
                    0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-amber-300 text-slate-950'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {overview.priceDrift.summary.priceDriftCount +
                        overview.priceDrift.summary.expiredQuotationCount +
                        overview.priceDrift.summary.missingQuotationCount}
                    </span>
                  )}
              </div>
              <div className="mt-2">
                <div className="text-xs font-extrabold leading-tight">
                  {tab.shortTitleEn}
                </div>
                <div
                  className={`mt-0.5 text-[11px] font-medium leading-tight ${
                    isActive ? 'text-blue-100' : 'text-slate-500'
                  }`}
                >
                  {tab.shortTitleVi}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-800">
          ⚠️ Error loading reports / Lỗi tải báo cáo: {errorMsg}
        </div>
      )}

      {loading && !overview ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-500">
          Loading analytics data / Đang tổng hợp dữ liệu phân tích...
        </div>
      ) : overview ? (
        <>
          {/* =================================================================
              REPORT 1: PRODUCT USAGE & WHERE-USED REPORT
             ================================================================= */}
          {activeReportTab === 'PRODUCT_USAGE' && (
            <div className="space-y-4">
              {/* Product Selection Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-900">
                      1. Product Usage & Where-Used Report / Báo cáo Tần suất & Chi phí theo Sản phẩm Sơn
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select a chemical material or furniture item to inspect every Coating Schedule (CS) & Coating Cost (CC) where it is applied / Chọn mã sơn hoặc sản phẩm gỗ để thống kê chi tiết số lượng CS/CC, khách hàng, số Rev, định mức g/m² và chi phí VND/m²
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-8">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Select Chemical Product (Material Code / Name) / Chọn Mã Vật tư Sơn:
                    </label>
                    <SearchableCombobox
                      value={selectedMaterialCode}
                      options={materialComboboxOptions}
                      onChange={(val) => setSelectedMaterialCode(val || 'ALL')}
                      placeholder="Search chemical code (e.g., PSV-76000, NC, PU...) / Tìm mã vật tư sơn..."
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      Furniture Item Filter / Lọc theo Sản phẩm Nội thất:
                    </label>
                    <select
                      value={selectedFurnitureProduct}
                      onChange={(e) =>
                        setSelectedFurnitureProduct(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="ALL">
                        All Furniture Items / Tất cả Sản phẩm Nội thất
                      </option>
                      {overview.productUsage.furnitureProducts.map((fp) => (
                        <option key={fp} value={fp}>
                          {fp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div
                  className={`grid grid-cols-2 gap-3 pt-2 ${
                    canViewCost ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Customers / Khách hàng sử dụng
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {overview.productUsage.summary.totalCustomers}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Across {overview.productUsage.summary.totalProjects}{' '}
                      Project(s) / Dự án
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                    <div className="text-[11px] font-bold text-blue-800">
                      CS/CC Revisions / Số bản CS sử dụng
                    </div>
                    <div className="mt-1 text-xl font-black text-blue-950">
                      {overview.productUsage.summary.totalRevisions}
                    </div>
                    <div className="text-[10px] font-semibold text-blue-700">
                      ✅ {overview.productUsage.summary.approvedRevisions}{' '}
                      Approved • 📝{' '}
                      {overview.productUsage.summary.draftRevisions} Draft
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Step Occurrences / Tổng số Bước sơn
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {overview.productUsage.summary.totalOccurrences}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Application step lines / Dòng công đoạn
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Avg Consumption / Định mức TB (CA+Loss)
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {formatDecimal2(
                        overview.productUsage.summary.avgCaPlusLossGramM2
                      )}{' '}
                      <span className="text-xs font-semibold text-slate-500">
                        g/m²
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Weighted by mixing ratio / Theo tỷ lệ pha
                    </div>
                  </div>

                  {canViewCost && (
                    <>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="text-[11px] font-bold text-emerald-800">
                          Avg Item Cost / Chi phí VT Trung bình
                        </div>
                        <div className="mt-1 text-xl font-black text-emerald-950">
                          {formatDecimal2(
                            overview.productUsage.summary.avgItemCostVndM2
                          )}{' '}
                          <span className="text-xs font-semibold text-emerald-700">
                            đ/m²
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          Material contribution / Đóng góp vào CC
                        </div>
                      </div>

                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="text-[11px] font-bold text-emerald-800">
                          Min – Max Item Cost (VND/m²)
                        </div>
                        <div className="mt-1 text-sm font-black text-emerald-950">
                          {formatDecimal2(
                            overview.productUsage.summary.minItemCostVndM2
                          )}{' '}
                          –{' '}
                          {formatDecimal2(
                            overview.productUsage.summary.maxItemCostVndM2
                          )}
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          Cost range across steps / Biên độ chi phí
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Where-Used Detail Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-bold uppercase text-slate-800">
                    Where-Used Detail Table / Bảng chi tiết các bản CS/CC sử dụng ({overview.productUsage.usages.length} dòng)
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Material / Sản phẩm Sơn
                        </th>
                        <th className="px-3 py-2.5">
                          Customer & Salesman / Khách hàng
                        </th>
                        <th className="px-3 py-2.5">
                          Project & Rev / Hồ sơ & Rev
                        </th>
                        <th className="px-3 py-2.5">
                          Furniture & System / SP Gỗ & Hệ sơn
                        </th>
                        <th className="px-3 py-2.5">
                          Step & Method / Công đoạn & PP
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Ratio / Tỷ lệ pha
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Item CA+Loss (g/m²)
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Price Snapshot (VND/Kg)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Item Cost (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Total Rev CC (VND/m²)
                            </th>
                          </>
                        )}
                        <th className="px-3 py-2.5 text-center">
                          Action / Mở
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.productUsage.usages.length === 0 ? (
                        <tr>
                          <td
                            colSpan={canViewCost ? 11 : 8}
                            className="px-4 py-8 text-center text-xs font-semibold text-slate-400"
                          >
                            No matching usage records found / Không có bản CS/CC nào sử dụng vật tư trong phạm vi lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        overview.productUsage.usages.map((u, idx) => (
                          <tr
                            key={`${u.revisionId}-${u.stepId}-${u.materialCode}-${idx}`}
                            className="hover:bg-blue-50/40"
                          >
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900">
                                {u.materialCode}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {u.materialName}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900">
                                {u.customerShortName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ID: {u.customerId}
                                {u.salesmanName
                                  ? ` • Sales: ${u.salesmanName}`
                                  : ''}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-blue-700">
                                  {u.projectCode}
                                </span>
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  Rev {String(u.revisionNo).padStart(2, '0')}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    u.status === 'APPROVED' ||
                                    u.status === 'LOCKED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : u.status === 'INACTIVE'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {u.scheduleDate}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-800">
                                {u.productName} • {u.colorName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {u.finishingSystem} • {u.substrate}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-800">
                                {u.stepNumber ? `#${u.stepNumber} ` : ''}
                                {u.stepName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {u.methodName} ({u.efficiencyPercent})
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              <div className="font-bold text-slate-900">
                                {u.mixingRatio}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                ({u.ratioSharePercent}%)
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-blue-900">
                              {formatDecimal2(u.itemCaPlusLossGramM2)}
                            </td>
                            {canViewCost && (
                              <>
                                <td className="px-3 py-2 text-right font-mono text-slate-700 bg-emerald-50/30">
                                  {formatVnd(u.priceSnapshotVnd)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                                  {formatDecimal2(u.itemCoatingCostVndM2)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 bg-emerald-50/30">
                                  {formatVnd(u.revisionTotalCostVndM2)}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => onSelectRevision(u.revisionId)}
                                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Open
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              REPORT 2: CUSTOMER CS/CC PORTFOLIO REPORT
             ================================================================= */}
          {activeReportTab === 'CUSTOMER_PORTFOLIO' && (
            <div className="space-y-4">
              {/* Customer Portfolio Summary Header */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-900">
                      2. Customer CS/CC Portfolio Report / Báo cáo Thống kê Hồ sơ & Chi phí theo Khách hàng
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customer-level aggregation of Projects, CS/CC Revisions (Approved vs Draft), Distinct Chemicals, Consumption (g/m²) & Coating Cost (VND/m²) / Thống kê chi tiết số lượng CS/CC và biên độ giá theo từng Khách hàng
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyCustomersWithCs}
                      onChange={(e) => setOnlyCustomersWithCs(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span>
                      Show only customers with CS projects / Chỉ hiện KH đã có hồ sơ CS ({overview.customerPortfolio.summary.activeCustomersWithProjects}/{overview.customerPortfolio.summary.totalCustomers})
                    </span>
                  </label>
                </div>

                <div
                  className={`grid grid-cols-2 gap-3 ${
                    canViewCost ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Scoped Customers / Tổng Khách hàng
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {overview.customerPortfolio.summary.totalCustomers}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Active with CS:{' '}
                      {
                        overview.customerPortfolio.summary
                          .activeCustomersWithProjects
                      }
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Total Projects / Tổng số Dự án
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {overview.customerPortfolio.summary.totalProjects}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <div className="text-[11px] font-bold text-blue-800">
                      Total CS/CC Revisions / Tổng số Bản CS
                    </div>
                    <div className="mt-1 text-xl font-black text-blue-950">
                      {overview.customerPortfolio.summary.totalRevisions}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Approved vs Draft / Duyệt vs Nháp
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-900">
                      ✅ {overview.customerPortfolio.summary.approvedRevisions}{' '}
                      Approved • 📝{' '}
                      {overview.customerPortfolio.summary.draftRevisions} Draft
                    </div>
                  </div>

                  {canViewCost && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                      <div className="text-[11px] font-bold text-emerald-800">
                        Portfolio Avg CC / Chi phí Sơn TB
                      </div>
                      <div className="mt-1 text-xl font-black text-emerald-950">
                        {formatVnd(
                          overview.customerPortfolio.summary.avgRevisionCostVndM2
                        )}{' '}
                        <span className="text-xs font-normal text-emerald-700">
                          VND/m²
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Master & Expandable Revisions Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5 w-8"></th>
                        <th className="px-3 py-2.5">
                          SAP ID & Customer / Khách hàng
                        </th>
                        <th className="px-3 py-2.5">
                          Salesman / NV Kinh doanh
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Projects / Dự án
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          CS/CC Count (Approved / Draft)
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Chemicals / Số Mã Sơn
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg CA+Loss (g/m²)
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Min CC (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Avg CC (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Max CC (VND/m²)
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.customerPortfolio.customers
                        .filter((c) =>
                          onlyCustomersWithCs ? c.projectCount > 0 : true
                        )
                        .map((c) => {
                          const isExpanded =
                            expandedCustomerIds[c.customerId] ??
                            c.totalRevisionCount > 0;
                          return (
                            <React.Fragment key={c.customerId}>
                              <tr
                                onClick={() =>
                                  setExpandedCustomerIds((prev) => ({
                                    ...prev,
                                    [c.customerId]: !isExpanded
                                  }))
                                }
                                className="cursor-pointer bg-white hover:bg-blue-50/40 transition"
                              >
                                <td className="px-3 py-2.5 text-center">
                                  {c.revisions.length > 0 ? (
                                    isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-blue-600" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-slate-400" />
                                    )
                                  ) : null}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                                      {c.customerId}
                                    </span>
                                    <span className="font-extrabold text-slate-900">
                                      {c.shortName}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {c.customerName}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  {c.salesmanName ? (
                                    <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                      💼 {c.salesmanName}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                                  {c.projectCount}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className="font-extrabold text-blue-700">
                                    {c.totalRevisionCount} Rev
                                  </span>{' '}
                                  <span className="text-[11px] text-slate-500">
                                    (✅ {c.approvedRevisionCount} / 📝{' '}
                                    {c.draftRevisionCount})
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-slate-700">
                                  {c.distinctMaterialCount} mã
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                                  {c.totalRevisionCount > 0
                                    ? formatDecimal2(
                                        c.totalConsumptionGramM2Avg
                                      )
                                    : '-'}
                                </td>
                                {canViewCost && (
                                  <>
                                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 bg-emerald-50/30">
                                      {formatVnd(c.minCoatingCostVndM2)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30">
                                      {formatVnd(c.avgCoatingCostVndM2)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono text-slate-700 bg-emerald-50/30">
                                      {formatVnd(c.maxCoatingCostVndM2)}
                                    </td>
                                  </>
                                )}
                              </tr>

                              {/* Drill-down Revisions Sub-table */}
                              {isExpanded && c.revisions.length > 0 && (
                                <tr className="bg-slate-50/90">
                                  <td colSpan={canViewCost ? 10 : 7} className="px-6 py-3">
                                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                      <div className="bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700">
                                        CS/CC Revisions of {c.shortName} / Danh sách hồ sơ CS/CC của khách hàng ({c.revisions.length} bản):
                                      </div>
                                      <table className="w-full text-[11px]">
                                        <thead>
                                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                                            <th className="px-3 py-1.5">
                                              Project Code / Mã HS
                                            </th>
                                            <th className="px-3 py-1.5">
                                              Rev & Status
                                            </th>
                                            <th className="px-3 py-1.5">
                                              Product & Color / Sản phẩm & Màu
                                            </th>
                                            <th className="px-3 py-1.5">
                                              System & Wood / Hệ sơn & Gỗ
                                            </th>
                                            <th className="px-3 py-1.5 text-center">
                                              Steps / Số bước
                                            </th>
                                            <th className="px-3 py-1.5 text-right">
                                              Total CA+Loss (g/m²)
                                            </th>
                                            {canViewCost && (
                                              <th className="px-3 py-1.5 text-right text-emerald-800">
                                                Total Coating Cost (VND/m²)
                                              </th>
                                            )}
                                            <th className="px-3 py-1.5 text-center">
                                              Open CS/CC
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                          {c.revisions.map((r) => (
                                            <tr
                                              key={r.revisionId}
                                              className="hover:bg-blue-50/40"
                                            >
                                              <td className="px-3 py-1.5 font-bold text-blue-700">
                                                {r.projectCode}
                                              </td>
                                              <td className="px-3 py-1.5">
                                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-white mr-1.5">
                                                  Rev{' '}
                                                  {String(r.revisionNo).padStart(
                                                    2,
                                                    '0'
                                                  )}
                                                </span>
                                                <span
                                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                    r.status === 'APPROVED' ||
                                                    r.status === 'LOCKED'
                                                      ? 'bg-emerald-100 text-emerald-800'
                                                      : r.status === 'INACTIVE'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-slate-200 text-slate-700'
                                                  }`}
                                                >
                                                  {r.status}
                                                </span>
                                              </td>
                                              <td className="px-3 py-1.5 font-semibold text-slate-800">
                                                {r.productName} • {r.colorName}
                                              </td>
                                              <td className="px-3 py-1.5 text-slate-600">
                                                {r.finishingSystem} •{' '}
                                                {r.substrate}
                                              </td>
                                              <td className="px-3 py-1.5 text-center font-mono">
                                                {r.stepCount} bước (
                                                {r.distinctMaterialCount} VT)
                                              </td>
                                              <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800">
                                                {formatDecimal2(
                                                  r.totalCaPlusLossGramM2
                                                )}
                                              </td>
                                              {canViewCost && (
                                                <td className="px-3 py-1.5 text-right font-mono font-extrabold text-emerald-700">
                                                  {formatVnd(
                                                    r.totalCoatingCostVndM2
                                                  )}
                                                </td>
                                              )}
                                              <td className="px-3 py-1.5 text-center">
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectRevision(
                                                      r.revisionId
                                                    );
                                                  }}
                                                  className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                  Open
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              REPORT 3: REVISION COST & SPEC VARIANCE REPORT
             ================================================================= */}
          {activeReportTab === 'REVISION_VARIANCE' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-extrabold uppercase text-slate-900">
                  3. Revision Cost & Spec Variance Report / Báo cáo So sánh Biến động giữa các Revision (Rev A vs Rev B)
                </h3>
                <p className="text-xs text-slate-500">
                  Compare Base Revision vs Target Revision to track changes in steps, consumption (g/m²), added/removed chemicals, and Coating Cost (VND/m²) / Đối chiếu sự thay đổi định mức, vật tư và chi phí giữa các phiên bản
                </p>

                {/* Optional Interactive Project Pair Selector */}
                <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-700">
                      Select Project to Custom-Compare / Chọn Dự án cần đối chiếu:
                    </label>
                    <select
                      value={compareProjectId}
                      onChange={(e) => {
                        const pid = e.target.value;
                        setCompareProjectId(pid);
                        const found = projects.find((p) => p.id === pid);
                        if (found && found.revisions.length > 0) {
                          setBaseRevId(found.revisions[0].id);
                          setTargetRevId(
                            found.revisions[found.revisions.length - 1].id
                          );
                        } else {
                          setBaseRevId('');
                          setTargetRevId('');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="">
                        All Scoped Projects (Auto: Earliest vs Latest Rev)
                      </option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.projectCode} — {p.customer.shortName} (
                          {p.revisions.length} Revs)
                        </option>
                      ))}
                    </select>
                  </div>

                  {compareProjectId && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-700">
                          Base Revision (Rev A / Bản gốc):
                        </label>
                        <select
                          value={baseRevId}
                          onChange={(e) => setBaseRevId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                        >
                          {(
                            projects.find((p) => p.id === compareProjectId)
                              ?.revisions || []
                          ).map((r) => (
                            <option key={r.id} value={r.id}>
                              Rev {String(r.revisionNo).padStart(2, '0')} (
                              {r.status}) — {r.productName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-700">
                          Target Revision (Rev B / Bản đối chiếu):
                        </label>
                        <select
                          value={targetRevId}
                          onChange={(e) => setTargetRevId(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                        >
                          {(
                            projects.find((p) => p.id === compareProjectId)
                              ?.revisions || []
                          ).map((r) => (
                            <option key={r.id} value={r.id}>
                              Rev {String(r.revisionNo).padStart(2, '0')} (
                              {r.status}) — {r.productName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {overview.revisionVariance.projectComparisons.map((comp) => (
                <div
                  key={comp.projectId}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-extrabold">
                        <span className="text-blue-300">{comp.projectCode}</span>
                        <span>— {comp.customerShortName}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px]">
                          {comp.totalRevisionsCount} Rev(s)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {comp.productName} • {comp.colorName} •{' '}
                        {comp.finishingSystem} | Comparing{' '}
                        <b>
                          Rev {String(comp.baseRevisionNo).padStart(2, '0')} (
                          {comp.baseStatus})
                        </b>{' '}
                        →{' '}
                        <b>
                          Rev {String(comp.targetRevisionNo).padStart(2, '0')} (
                          {comp.targetStatus})
                        </b>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="rounded bg-slate-800 px-2.5 py-1">
                        Steps: {comp.baseStepCount} → {comp.targetStepCount} (
                        <span
                          className={
                            comp.deltaStepCount > 0
                              ? 'text-amber-300 font-bold'
                              : comp.deltaStepCount < 0
                                ? 'text-emerald-300 font-bold'
                                : 'text-slate-300'
                          }
                        >
                          {comp.deltaStepCount > 0
                            ? `+${comp.deltaStepCount}`
                            : comp.deltaStepCount}
                        </span>
                        )
                      </div>

                      <div className="rounded bg-slate-800 px-2.5 py-1">
                        CA+Loss: {formatDecimal2(comp.baseTotalGramM2)} →{' '}
                        {formatDecimal2(comp.targetTotalGramM2)} g/m² (
                        <span
                          className={
                            comp.deltaTotalGramM2 > 0
                              ? 'text-amber-300 font-bold'
                              : comp.deltaTotalGramM2 < 0
                                ? 'text-emerald-300 font-bold'
                                : 'text-slate-300'
                          }
                        >
                          {comp.deltaTotalGramM2 > 0
                            ? `+${formatDecimal2(comp.deltaTotalGramM2)}`
                            : formatDecimal2(comp.deltaTotalGramM2)}{' '}
                          g/m²
                        </span>
                        )
                      </div>

                      {canViewCost && (
                        <div className="rounded bg-emerald-950 border border-emerald-700 px-2.5 py-1">
                          CC: {formatVnd(comp.baseCostVndM2)} →{' '}
                          {formatVnd(comp.targetCostVndM2)} đ/m² (
                          <span
                            className={
                              (comp.deltaCostVndM2 || 0) > 0
                                ? 'text-red-300 font-bold'
                                : (comp.deltaCostVndM2 || 0) < 0
                                  ? 'text-emerald-300 font-bold'
                                  : 'text-slate-300'
                            }
                          >
                            {(comp.deltaCostVndM2 || 0) > 0 ? '+' : ''}
                            {formatVnd(comp.deltaCostVndM2)} đ/m² /{' '}
                            {comp.deltaCostPercent}%
                          </span>
                          )
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Material Diff Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-700">
                          <th className="px-3 py-2">Change / Biến động</th>
                          <th className="px-3 py-2">
                            Material Code & Name / Vật tư Sơn
                          </th>
                          <th className="px-3 py-2 text-right">
                            Base (g/m²)
                          </th>
                          <th className="px-3 py-2 text-right">
                            Target (g/m²)
                          </th>
                          <th className="px-3 py-2 text-right">
                            Δ Consumption (g/m²)
                          </th>
                          {canViewCost && (
                            <>
                              <th className="px-3 py-2 text-right">
                                Base Price (VND/Kg)
                              </th>
                              <th className="px-3 py-2 text-right">
                                Target Price (VND/Kg)
                              </th>
                              <th className="px-3 py-2 text-right">
                                Base Cost (VND/m²)
                              </th>
                              <th className="px-3 py-2 text-right">
                                Target Cost (VND/m²)
                              </th>
                              <th className="px-3 py-2 text-right">
                                Δ Cost (VND/m²)
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comp.itemDiffs.map((diff) => (
                          <tr key={diff.materialCode} className="hover:bg-slate-50">
                            <td className="px-3 py-1.5">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                  diff.changeType === 'ADDED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : diff.changeType === 'REMOVED'
                                      ? 'bg-red-100 text-red-800'
                                      : diff.changeType === 'MODIFIED'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {diff.changeType}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="font-bold text-slate-900">
                                {diff.materialCode}
                              </span>{' '}
                              <span className="text-slate-500">
                                — {diff.materialName}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatDecimal2(diff.baseGramM2)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {formatDecimal2(diff.targetGramM2)}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right font-mono font-bold ${
                                diff.deltaGramM2 > 0
                                  ? 'text-amber-700'
                                  : diff.deltaGramM2 < 0
                                    ? 'text-emerald-700'
                                    : 'text-slate-400'
                              }`}
                            >
                              {diff.deltaGramM2 > 0 ? '+' : ''}
                              {formatDecimal2(diff.deltaGramM2)}
                            </td>
                            {canViewCost && (
                              <>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                                  {formatVnd(diff.basePriceVnd)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                                  {formatVnd(diff.targetPriceVnd)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {formatDecimal2(diff.baseCostVndM2)}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono">
                                  {formatDecimal2(diff.targetCostVndM2)}
                                </td>
                                <td
                                  className={`px-3 py-1.5 text-right font-mono font-bold ${
                                    (diff.deltaCostVndM2 || 0) > 0
                                      ? 'text-red-700'
                                      : (diff.deltaCostVndM2 || 0) < 0
                                        ? 'text-emerald-700'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {(diff.deltaCostVndM2 || 0) > 0 ? '+' : ''}
                                  {formatDecimal2(diff.deltaCostVndM2)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* =================================================================
              REPORT 4: PRICE DRIFT & QUOTATION ALERT REPORT
             ================================================================= */}
          {activeReportTab === 'PRICE_DRIFT' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-900">
                      4. Price Drift & Quotation Alert Report / Báo cáo Chênh lệch Giá Snapshot & Cảnh báo Báo giá
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cross-checks CS/CC snapshot prices against live SAP Customer Quotations and validity dates / Đối chiếu đơn giá Snapshot trong CS/CC với bảng báo giá Quotation mới nhất và kiểm tra hạn hiệu lực
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'ALL', label: 'All Items / Tất cả' },
                        {
                          id: 'ALERTS_ONLY',
                          label: 'Alerts Only / Chỉ dòng Cảnh báo'
                        },
                        { id: 'PRICE_DRIFT', label: 'Price Drift / Lệch giá' },
                        { id: 'EXPIRED', label: 'Expired / Hết hạn' },
                        {
                          id: 'MISSING_QUOTATION',
                          label: 'Missing / Chưa có BG'
                        }
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setDriftStatusFilter(f.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                          driftStatusFilter === f.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`grid grid-cols-2 gap-3 ${
                    canViewCost ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Checked Step Items / Tổng dòng kiểm tra
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {overview.priceDrift.summary.totalCheckedItems}
                    </div>
                  </div>

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                    <div className="text-[11px] font-bold text-emerald-800">
                      Matched Quotations / Khớp báo giá
                    </div>
                    <div className="mt-1 text-xl font-black text-emerald-950">
                      {overview.priceDrift.summary.matchedCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                    <div className="text-[11px] font-bold text-amber-800">
                      Price Drift / Lệch đơn giá Snapshot
                    </div>
                    <div className="mt-1 text-xl font-black text-amber-950">
                      {overview.priceDrift.summary.priceDriftCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
                    <div className="text-[11px] font-bold text-red-800">
                      Expired or Missing / Hết hạn hoặc Thiếu BG
                    </div>
                    <div className="mt-1 text-xl font-black text-red-950">
                      {overview.priceDrift.summary.expiredQuotationCount +
                        overview.priceDrift.summary.missingQuotationCount}
                    </div>
                  </div>

                  {canViewCost && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3">
                      <div className="text-[11px] font-bold text-blue-800">
                        Net Drift Impact / Tổng lệch CC (VND/m²)
                      </div>
                      <div className="mt-1 text-xl font-black text-blue-950">
                        {formatDecimal2(
                          overview.priceDrift.summary.totalDriftImpactVndM2
                        )}{' '}
                        <span className="text-xs font-normal">đ/m²</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">Status / Cảnh báo</th>
                        <th className="px-3 py-2.5">Project & Rev</th>
                        <th className="px-3 py-2.5">Customer / Khách hàng</th>
                        <th className="px-3 py-2.5">Step / Công đoạn</th>
                        <th className="px-3 py-2.5">Material / Vật tư</th>
                        <th className="px-3 py-2.5 text-right">
                          CA+Loss (g/m²)
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              CS Snapshot (VND/Kg)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Live Quotation (VND/Kg)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Δ Price (VND/Kg)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              CC Impact (VND/m²)
                            </th>
                          </>
                        )}
                        <th className="px-3 py-2.5 text-center">
                          Validity / Hiệu lực
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.priceDrift.items
                        .filter((item) => {
                          if (driftStatusFilter === 'ALL') return true;
                          if (driftStatusFilter === 'ALERTS_ONLY')
                            return item.alertStatus !== 'MATCHED';
                          return item.alertStatus === driftStatusFilter;
                        })
                        .map((item, idx) => (
                          <tr
                            key={`${item.revisionId}-${item.materialCode}-${idx}`}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                  item.alertStatus === 'MATCHED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.alertStatus === 'PRICE_DRIFT'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {item.alertStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  onSelectRevision(item.revisionId)
                                }
                                className="font-bold text-blue-700 hover:underline"
                              >
                                {item.projectCode} (Rev{' '}
                                {String(item.revisionNo).padStart(2, '0')})
                              </button>
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-slate-900">
                                {item.customerShortName}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.salesmanName || '-'}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {item.stepName}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900">
                                {item.materialCode}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.materialName}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">
                              {formatDecimal2(item.itemCaPlusLossGramM2)}
                            </td>
                            {canViewCost && (
                              <>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatVnd(item.snapshotPriceVnd)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold">
                                  {formatVnd(item.latestQuotationPriceVnd)}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-mono font-bold ${
                                    (item.deltaPriceVnd || 0) > 0
                                      ? 'text-red-700'
                                      : (item.deltaPriceVnd || 0) < 0
                                        ? 'text-emerald-700'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {item.deltaPriceVnd !== null
                                    ? `${item.deltaPriceVnd > 0 ? '+' : ''}${formatVnd(item.deltaPriceVnd)}`
                                    : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold">
                                  {formatDecimal2(item.costImpactVndM2)}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-center text-[11px] text-slate-500">
                              {item.validFrom || item.validTo
                                ? `${item.validFrom || '...'} → ${item.validTo || '...'}`
                                : 'No expiry / Không thời hạn'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              REPORT 5: STEP & FINISHING SYSTEM BENCHMARK REPORT
             ================================================================= */}
          {activeReportTab === 'STEP_BENCHMARK' && (
            <div className="space-y-5">
              {/* Table 1: By Application Step */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-extrabold uppercase text-slate-900">
                    5A. Application Step Breakdown / Cơ cấu Định mức & Tỷ trọng Chi phí theo Công đoạn Sơn
                  </h3>
                  <p className="text-xs text-slate-500">
                    Identifies which coating steps (Stain, Sealer, Topcoat...) consume the most material and budget / Phân tích công đoạn chiếm tỷ trọng định mức và chi phí cao nhất
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Application Step / Công đoạn
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Occurrences / Số lần xuất hiện
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Distinct Chemicals / Số mã sơn
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg CA (g/m²)
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg CA+Loss (g/m²)
                        </th>
                        <th className="px-3 py-2.5 w-48">
                          Consumption Share / Tỷ trọng g/m²
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Avg Step Cost (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 w-48 bg-emerald-950">
                              Cost Share (%) / Tỷ trọng Chi phí
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.stepBenchmark.byStep.map((st) => (
                        <tr key={st.stepName} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-extrabold text-slate-900">
                            {st.stepName}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold">
                            {st.occurrenceCount} ({st.revisionCount} Rev)
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {st.distinctMaterialCount} mã
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {formatDecimal2(st.avgCaGramM2)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-900">
                            {formatDecimal2(st.avgCaPlusLossGramM2)}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-blue-600"
                                  style={{
                                    width: `${Math.min(100, st.gramSharePercent)}%`
                                  }}
                                />
                              </div>
                              <span className="w-11 text-right font-mono text-[11px] font-bold text-slate-700">
                                {st.gramSharePercent}%
                              </span>
                            </div>
                          </td>
                          {canViewCost && (
                            <>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30">
                                {formatDecimal2(st.avgStepCostVndM2)}
                              </td>
                              <td className="px-3 py-2.5 bg-emerald-50/30">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 rounded-full bg-emerald-200 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-600"
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          st.costSharePercent || 0
                                        )}%`
                                      }}
                                    />
                                  </div>
                                  <span className="w-11 text-right font-mono text-[11px] font-bold text-emerald-900">
                                    {st.costSharePercent ?? 0}%
                                  </span>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: By Finishing System & Substrate */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-extrabold uppercase text-slate-900">
                    5B. Finishing System & Substrate Benchmark / So sánh Chuẩn Định mức & Chi phí theo Hệ sơn & Loại gỗ
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Finishing System / Hệ sơn
                        </th>
                        <th className="px-3 py-2.5">Substrate / Loại gỗ</th>
                        <th className="px-3 py-2.5 text-center">
                          Revisions / Số bản CS
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Customers / Số KH
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Avg Steps / Số bước TB
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg Total CA+Loss (g/m²)
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Min CC (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Avg CC (VND/m²)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Max CC (VND/m²)
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.stepBenchmark.bySystem.map((sys, idx) => (
                        <tr
                          key={`${sys.finishingSystem}-${sys.substrate}-${idx}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-3 py-2.5 font-extrabold text-blue-900">
                            {sys.finishingSystem}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-800">
                            {sys.substrate}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold">
                            {sys.revisionCount}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {sys.customerCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono">
                            {sys.avgStepCount}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {formatDecimal2(sys.avgTotalCaPlusLossGramM2)}
                          </td>
                          {canViewCost && (
                            <>
                              <td className="px-3 py-2.5 text-right font-mono bg-emerald-50/30">
                                {formatVnd(sys.minCostVndM2)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30">
                                {formatVnd(sys.avgCostVndM2)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono bg-emerald-50/30">
                                {formatVnd(sys.maxCostVndM2)}
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
          )}

          {/* =================================================================
              REPORT 6: AGGREGATED MULTI-PROJECT BOM FORECAST
             ================================================================= */}
          {activeReportTab === 'BOM_FORECAST' && activeBomData && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase text-slate-900">
                      6. Aggregated Multi-Project BOM Forecast / Dự báo Nhu cầu Vật tư BOM Tổng hợp Nhiều Dự án
                    </h3>
                    <p className="text-xs text-slate-500">
                      Select multiple CS revisions and customize production area (m²) to consolidate total required Kg/Ltr, Packs to Order, and Estimated Budget / Gộp nhu cầu đặt hàng vật tư hóa chất của nhiều dự án cùng lúc
                    </p>
                  </div>

                  {recalculatingBom && (
                    <span className="text-xs font-bold text-blue-600">
                      Recalculating BOM... / Đang tính lại BOM...
                    </span>
                  )}
                </div>

                {/* BOM KPI Cards */}
                <div
                  className={`grid grid-cols-2 gap-3 ${
                    canViewCost ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
                  }`}
                >
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Selected Revisions / Số bản CS gộp
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {activeBomData.summary.selectedRevisionsCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <div className="text-[11px] font-bold text-blue-800">
                      Total Area / Tổng diện tích SX
                    </div>
                    <div className="mt-1 text-xl font-black text-blue-950">
                      {formatVnd(activeBomData.summary.totalAreaM2)}{' '}
                      <span className="text-xs font-normal">m²</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Distinct Materials / Số mã hóa chất
                    </div>
                    <div className="mt-1 text-xl font-black text-slate-900">
                      {activeBomData.summary.distinctMaterialsCount}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-bold text-slate-500">
                      Total Weight & Packs / Tổng khối lượng & Thùng
                    </div>
                    <div className="mt-1 text-base font-black text-slate-900">
                      {formatDecimal2(activeBomData.summary.totalRequiredKgOrLtr)}{' '}
                      Kg/Ltr ({activeBomData.summary.totalPacksRounded} Packs)
                    </div>
                  </div>

                  {canViewCost && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                      <div className="text-[11px] font-bold text-emerald-800">
                        Total Estimated Cost / Tổng Ngân sách VT
                      </div>
                      <div className="mt-1 text-lg font-black text-emerald-950">
                        {formatVnd(activeBomData.summary.totalEstimatedCostVnd)}{' '}
                        <span className="text-xs font-normal">VND</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Revisions Area Allocation Selector */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800">
                    Production Schedule Allocations / Chọn bản CS và nhập diện tích sản xuất dự kiến (m²):
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                          <th className="px-3 py-1.5 w-10 text-center">Include</th>
                          <th className="px-3 py-1.5">Project & Rev</th>
                          <th className="px-3 py-1.5">Customer / Khách hàng</th>
                          <th className="px-3 py-1.5">Product & Color</th>
                          <th className="px-3 py-1.5 w-36 text-right">
                            Area (m²) / Diện tích
                          </th>
                          {canViewCost && (
                            <th className="px-3 py-1.5 text-right">
                              Est. Project Cost (VND)
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeBomData.allocations.map((alloc) => {
                          const localState = customBomAllocations[
                            alloc.revisionId
                          ] ?? {
                            areaM2: alloc.areaM2,
                            selected: alloc.selected
                          };
                          return (
                            <tr
                              key={alloc.revisionId}
                              className="hover:bg-blue-50/30"
                            >
                              <td className="px-3 py-1.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={localState.selected}
                                  onChange={(e) => {
                                    const next = {
                                      ...customBomAllocations,
                                      [alloc.revisionId]: {
                                        ...localState,
                                        selected: e.target.checked
                                      }
                                    };
                                    setCustomBomAllocations(next);
                                    handleRecalculateBomForecast(next);
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                />
                              </td>
                              <td className="px-3 py-1.5 font-bold text-blue-700">
                                {alloc.projectCode} (Rev{' '}
                                {String(alloc.revisionNo).padStart(2, '0')} -{' '}
                                {alloc.status})
                              </td>
                              <td className="px-3 py-1.5">
                                {alloc.customerShortName}
                              </td>
                              <td className="px-3 py-1.5 text-slate-600">
                                {alloc.productName} • {alloc.colorName}
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <input
                                  type="number"
                                  min={1}
                                  value={localState.areaM2}
                                  onChange={(e) => {
                                    const val = Math.max(
                                      1,
                                      Number(e.target.value) || 1
                                    );
                                    const next = {
                                      ...customBomAllocations,
                                      [alloc.revisionId]: {
                                        ...localState,
                                        areaM2: val
                                      }
                                    };
                                    setCustomBomAllocations(next);
                                    handleRecalculateBomForecast(next);
                                  }}
                                  className="w-28 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs font-bold focus:border-blue-600 focus:outline-none"
                                />
                              </td>
                              {canViewCost && (
                                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-800">
                                  {formatVnd(alloc.estimatedProjectCostVnd)}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Consolidated Material Requirements Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-800">
                  Consolidated Chemical BOM Table / Bảng Tổng hợp Vật tư Hóa chất Cần Đặt ({activeBomData.materials.length} mã)
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Material Code & Name / Mã & Tên Hóa chất
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Packing / Quy cách
                        </th>
                        <th className="px-3 py-2.5">
                          Used in Projects / Dự án sử dụng
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Total Required (Kg/Ltr)
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Exact Packs / Số thùng lẻ
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Packs to Order / Thùng làm tròn
                        </th>
                        {canViewCost && (
                          <>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Avg Price (VND/Kg)
                            </th>
                            <th className="px-3 py-2.5 text-right bg-emerald-950">
                              Estimated Cost (VND)
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeBomData.materials.map((m) => (
                        <tr key={m.materialCode} className="hover:bg-slate-50">
                          <td className="px-3 py-2">
                            <div className="font-bold text-slate-900">
                              {m.materialCode}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {m.materialName}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {m.packingDesc || `${m.nettWeight} Kg`}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-800">
                              {m.projectCodes.join(', ')}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {m.usedInRevisionsCount} Rev(s) •{' '}
                              {m.usedByCustomersCount} KH
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-blue-900">
                            {formatDecimal2(m.totalRequiredKgOrLtr)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">
                            {formatDecimal2(m.totalPacksExact)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-900">
                            {m.totalPacksRounded}
                          </td>
                          {canViewCost && (
                            <>
                              <td className="px-3 py-2 text-right font-mono bg-emerald-50/30">
                                {formatVnd(m.avgPriceUnitVnd)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30">
                                {formatVnd(m.totalEstimatedCostVnd)}
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
          )}

          {/* =================================================================
              REPORT 7: SALESMAN & TECHNICAL ACTIVITY FUNNEL
             ================================================================= */}
          {activeReportTab === 'ACTIVITY_FUNNEL' && (
            <div className="space-y-5">
              {/* By Salesman Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-extrabold uppercase text-slate-900">
                    7A. Salesman Activity & Approval Funnel / Báo cáo Hiệu suất Hoạt động theo Nhân viên Kinh doanh (Salesman)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tracks assigned customers, active projects, CS/CC revision output, approval conversion rate (%), and average coating cost / Thống kê số lượng khách hàng, dự án, tỷ lệ duyệt CS/CC theo từng Salesman
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Salesman / Nhân viên Kinh doanh
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Total Customers / Tổng KH
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Active with CS / KH có Hồ sơ
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Projects / Số Dự án
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Total Revisions / Tổng Bản CS
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Approved / Đã duyệt
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Draft / Bản nháp
                        </th>
                        <th className="px-3 py-2.5 w-44">
                          Approval Rate (%) / Tỷ lệ duyệt
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg Revs / Project
                        </th>
                        {canViewCost && (
                          <th className="px-3 py-2.5 text-right bg-emerald-950">
                            Avg Coating Cost (VND/m²)
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.activityFunnel.bySalesman.map((s) => (
                        <tr key={s.salesmanName} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-extrabold text-slate-900">
                            💼 {s.salesmanName}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold">
                            {s.customerCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-blue-700">
                            {s.activeCustomerCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold">
                            {s.projectCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">
                            {s.totalRevisions}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                            {s.approvedRevisions}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-amber-700">
                            {s.draftRevisions}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      s.approvalRatePercent
                                    )}%`
                                  }}
                                />
                              </div>
                              <span className="w-11 text-right font-mono text-[11px] font-bold">
                                {s.approvalRatePercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {s.avgRevisionsPerProject}
                          </td>
                          {canViewCost && (
                            <td className="px-3 py-2.5 text-right font-mono font-extrabold text-emerald-800 bg-emerald-50/30">
                              {formatVnd(s.avgCoatingCostVndM2)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Technical TA Table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-extrabold uppercase text-slate-900">
                    7B. Technical TA Workload & Spec Complexity / Hiệu suất Lập Qui trình của Kỹ thuật viên (Prepared By TA)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-900 text-[11px] font-bold uppercase text-white">
                        <th className="px-3 py-2.5">
                          Technical TA (Prepared By) / Kỹ thuật viên
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Customers / Số KH
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Projects / Số Dự án
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Total Revisions / Tổng Bản CS
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Approved / Đã duyệt
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Approval Rate (%)
                        </th>
                        <th className="px-3 py-2.5 text-center">
                          Systems / Số Hệ sơn
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg Steps / Số bước TB
                        </th>
                        <th className="px-3 py-2.5 text-right">
                          Avg CA+Loss (g/m²)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {overview.activityFunnel.byTechnicalTa.map((ta) => (
                        <tr key={ta.preparedByTa} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-extrabold text-slate-900">
                            🛠️ {ta.preparedByTa}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {ta.customerCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold">
                            {ta.projectCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-extrabold text-blue-700">
                            {ta.totalRevisions}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-emerald-700">
                            {ta.approvedRevisions}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono font-bold">
                            {ta.approvalRatePercent}%
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {ta.distinctSystemsCount}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {ta.avgStepCount}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold">
                            {formatDecimal2(ta.avgConsumptionGramM2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

