import React from 'react';
import {
  Project,
  Customer,
  UserRole,
  formatVnd
} from '@cscc/shared';
import {
  FolderKanban,
  Search,
  FolderPlus,
  ExternalLink,
  Trash2,
  Lock,
  FileEdit,
  X
} from 'lucide-react';
import {
  SearchableCombobox,
  ComboboxOption
} from '../common/SearchableCombobox';

interface ProjectExplorerViewProps {
  projects: Project[];
  customers: Customer[];
  activeRevisionId?: string;
  role: UserRole;
  onSelectRevision: (revisionId: string) => Promise<void>;
  onCreateProject: (payload: {
    projectCode: string;
    customerId: string;
    productName: string;
    colorName: string;
    substrate: string;
    finishingSystem: string;
  }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onDeleteRevision: (revisionId: string) => Promise<void>;
}

export const ProjectExplorerView: React.FC<ProjectExplorerViewProps> = ({
  projects,
  customers,
  activeRevisionId,
  role,
  onSelectRevision,
  onCreateProject,
  onDeleteProject,
  onDeleteRevision
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [customerFilter, setCustomerFilter] = React.useState('ALL');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'DRAFT' | 'LOCKED'>('ALL');
  const [showNewModal, setShowNewModal] = React.useState(false);

  // New Project Form State (All empty by default so user never confuses pre-filled values)
  const [newCode, setNewCode] = React.useState('');
  const [newCustomerId, setNewCustomerId] = React.useState('');
  const [newProduct, setNewProduct] = React.useState('');
  const [newColor, setNewColor] = React.useState('');
  const [newSubstrate, setNewSubstrate] = React.useState('');
  const [newSystem, setNewSystem] = React.useState('');
  const [createErrors, setCreateErrors] = React.useState<string[]>([]);

  const canViewCost = role !== 'TECHNICAL';

  const customerFilterOptions = React.useMemo<ComboboxOption[]>(() => {
    const base: ComboboxOption[] = [
      {
        value: 'ALL',
        label: 'Tất cả Khách hàng (All Customers)',
        badge: `${customers.length} KH`,
        badgeColor: 'blue'
      }
    ];
    for (const c of customers) {
      base.push({
        value: c.customerId,
        label: c.shortName,
        sublabel: c.customerName,
        badge: c.customerId,
        badgeColor: c.shortName !== c.customerName ? 'emerald' : 'slate',
        keywords: `${c.customerId} ${c.shortName} ${c.customerName}`
      });
    }
    return base;
  }, [customers]);

  const customerCreateOptions = React.useMemo<ComboboxOption[]>(
    () => customerFilterOptions.filter((o) => o.value !== 'ALL'),
    [customerFilterOptions]
  );

  const filteredProjects = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return projects.filter((proj) => {
      if (customerFilter !== 'ALL' && proj.customer.customerId !== customerFilter) {
        return false;
      }
      if (statusFilter !== 'ALL') {
        const hasStatus = proj.revisions.some((r) => r.status === statusFilter);
        if (!hasStatus) return false;
      }
      if (!q) return true;
      const revText = proj.revisions
        .map(
          (r) =>
            `${r.productName} ${r.colorName} ${r.substrate || ''} ${r.finishingSystem || ''} Rev${r.revisionNo}`
        )
        .join(' ');
      const hay =
        `${proj.projectCode} ${proj.customer.shortName} ${proj.customer.customerName} ${proj.customer.customerId} ${revText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, searchQuery, customerFilter, statusFilter]);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newCustomerId.trim()) missing.push('Khách hàng (Customer)');
    if (!newCode.trim()) missing.push('Mã Hồ sơ (No.)');
    if (!newProduct.trim()) missing.push('Tên Sản phẩm (Product Item)');
    if (!newColor.trim()) missing.push('Màu sắc (Color)');
    if (!newSubstrate.trim()) missing.push('Loại gỗ (Substrate)');
    if (!newSystem.trim()) missing.push('Hệ sơn (System)');

    if (missing.length > 0) {
      setCreateErrors(missing);
      return;
    }

    setCreateErrors([]);
    await onCreateProject({
      projectCode: newCode.trim(),
      customerId: newCustomerId.trim(),
      productName: newProduct.trim(),
      colorName: newColor.trim(),
      substrate: newSubstrate.trim(),
      finishingSystem: newSystem.trim()
    });
    setShowNewModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Multi-dimensional Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase text-slate-900">
                QUẢN LÝ & TRA CỨU HỒ SƠ DỰ ÁN (PROJECT & REVISION DIRECTORY)
              </h2>
              <p className="text-xs text-slate-500">
                Tìm kiếm nhanh trong hàng nghìn hồ sơ theo Mã dự án, Khách hàng, Sản phẩm, Màu sắc, Loại gỗ hoặc Trạng thái chốt giá
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewCustomerId('');
              setNewCode('');
              setNewProduct('');
              setNewColor('');
              setNewSubstrate('');
              setNewSystem('');
              setCreateErrors([]);
              setShowNewModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <FolderPlus className="h-4 w-4" />
            Tạo Hồ sơ Dự án Mới
          </button>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-4 md:grid-cols-12">
          {/* Keyword Search */}
          <div className="relative md:col-span-5">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ Mã hồ sơ (NTR 001), Tên SP (Bàn), Màu (Hickory), Gỗ (Tần bì)..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-1.5 text-xs font-medium focus:border-blue-600 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Customer Searchable Combobox */}
          <div className="md:col-span-4">
            <SearchableCombobox
              compact
              value={customerFilter}
              options={customerFilterOptions}
              onChange={(val) => setCustomerFilter(val)}
              searchPlaceholder="Gõ tên KH hoặc mã SAP để lọc..."
              popoverWidthClass="w-96"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 md:col-span-3">
            {(['ALL', 'DRAFT', 'LOCKED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL'
                  ? `Tất cả (${projects.length})`
                  : st === 'DRAFT'
                    ? 'Đang soạn'
                    : '🔒 Đã khóa'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-800 text-white uppercase tracking-wider text-[11px]">
                <th className="border border-slate-700 px-3.5 py-2.5 w-32">
                  Mã Hồ Sơ
                </th>
                <th className="border border-slate-700 px-3.5 py-2.5 w-64">
                  Khách hàng (Customer)
                </th>
                <th className="border border-slate-700 px-3.5 py-2.5">
                  Sản phẩm / Màu sắc / Loại gỗ
                </th>
                <th className="border border-slate-700 px-3.5 py-2.5">
                  Các Phiên bản (Bấm vào Rev để mở)
                </th>
                {canViewCost && (
                  <th className="border border-slate-700 px-3.5 py-2.5 text-right w-40">
                    Tổng Giá (Rev Mới Nhất)
                  </th>
                )}
                <th className="border border-slate-700 px-3.5 py-2.5 text-center w-36">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={canViewCost ? 6 : 5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    Không tìm thấy hồ sơ dự án nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((proj) => {
                  const latestRev =
                    proj.revisions[proj.revisions.length - 1] ??
                    proj.revisions[0];
                  return (
                    <tr
                      key={proj.id}
                      className="hover:bg-blue-50/30 transition border-b border-slate-200"
                    >
                      <td className="border border-slate-200 px-3.5 py-3 font-mono font-extrabold text-blue-950 text-sm">
                        {proj.projectCode}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-3">
                        <div className="font-bold text-slate-900">
                          {proj.customer.shortName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[250px]">
                          SAP: {proj.customer.customerId} •{' '}
                          {proj.customer.customerName}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3.5 py-3">
                        {latestRev ? (
                          <div>
                            <div className="font-bold text-slate-900">
                              {latestRev.productName} —{' '}
                              <span className="text-blue-700">
                                {latestRev.colorName}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              Gỗ: <strong>{latestRev.substrate || '-'}</strong>{' '}
                              | Hệ sơn:{' '}
                              <strong>{latestRev.finishingSystem || '-'}</strong>{' '}
                              | Số bước sơn:{' '}
                              <strong>{latestRev.stepCount ?? '-'}</strong> |
                              Ngày: {latestRev.scheduleDate}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {proj.revisions.map((r) => {
                            const isCurrent = r.id === activeRevisionId;
                            const canDeleteRev =
                              proj.revisions.length > 1 &&
                              r.status !== 'LOCKED';
                            return (
                              <div
                                key={r.id}
                                className={`inline-flex items-center rounded-lg border text-xs font-bold transition ${
                                  isCurrent
                                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                                    : r.status === 'LOCKED'
                                      ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                      : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-blue-50 hover:border-blue-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelectRevision(r.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1"
                                >
                                  {r.status === 'LOCKED' ? (
                                    <Lock className="h-3 w-3" />
                                  ) : (
                                    <FileEdit className="h-3 w-3 opacity-70" />
                                  )}
                                  <span>
                                    Rev {String(r.revisionNo).padStart(2, '0')}
                                  </span>
                                </button>
                                {canDeleteRev && (
                                  <button
                                    type="button"
                                    title={`Xóa bản nháp Rev ${String(r.revisionNo).padStart(2, '0')}`}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          `Bạn có chắc muốn xóa phiên bản nháp Rev ${String(r.revisionNo).padStart(2, '0')} của hồ sơ ${proj.projectCode}?`
                                        )
                                      ) {
                                        await onDeleteRevision(r.id);
                                      }
                                    }}
                                    className="border-l border-current/20 px-1.5 py-1 hover:text-red-500"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      {canViewCost && (
                        <td className="border border-slate-200 px-3.5 py-3 text-right">
                          {latestRev?.totalCoatingCostDisplay !== undefined &&
                          latestRev?.totalCoatingCostDisplay !== null ? (
                            <span className="font-extrabold text-emerald-800 text-sm">
                              {formatVnd(latestRev.totalCoatingCostDisplay)}{' '}
                              <span className="text-[10px] font-normal text-slate-500">
                                đ/m²
                              </span>
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td className="border border-slate-200 px-3.5 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {latestRev && (
                            <button
                              type="button"
                              onClick={() => onSelectRevision(latestRev.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Mở
                            </button>
                          )}
                          {projects.length > 1 && (
                            <button
                              type="button"
                              title="Xóa toàn bộ Hồ sơ Dự án này"
                              onClick={async () => {
                                if (
                                  window.confirm(
                                    `Xác nhận xóa hồ sơ dự án "${proj.projectCode} — ${proj.customer.shortName}"?`
                                  )
                                ) {
                                  await onDeleteProject(proj.id);
                                }
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold uppercase text-slate-900">
                Tạo Hồ sơ Coating Schedule Mới (Rev 00)
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="mt-4 space-y-4">
              {createErrors.length > 0 && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-900">
                  <div className="font-bold text-red-800 mb-1">
                    ⚠️ Không thể tạo hồ sơ vì các mục sau còn đang để trống:
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 font-medium">
                    {createErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Chọn Khách hàng (Customer) <span className="text-red-500">*</span>
                </label>
                <SearchableCombobox
                  value={newCustomerId}
                  placeholder="-- Hãy chọn Khách hàng --"
                  options={customerCreateOptions}
                  onChange={(val) => setNewCustomerId(val)}
                  searchPlaceholder="Gõ tên KH (NITORI) hoặc mã SAP..."
                  popoverWidthClass="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Mã Hồ sơ (No.) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Hãy nhập mã hồ sơ (VD: NTR 002)..."
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-bold focus:outline-none ${
                      !newCode.trim()
                        ? 'border-amber-400 bg-amber-50/50 placeholder:italic placeholder:font-normal placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Tên Sản phẩm (Product Item) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Hãy nhập sản phẩm (VD: TABLE)..."
                    value={newProduct}
                    onChange={(e) => setNewProduct(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                      !newProduct.trim()
                        ? 'border-amber-400 bg-amber-50/50 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Màu sắc (Color) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Hãy nhập màu sắc..."
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                      !newColor.trim()
                        ? 'border-amber-400 bg-amber-50/50 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Loại gỗ (Substrate) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Hãy nhập loại gỗ..."
                    value={newSubstrate}
                    onChange={(e) => setNewSubstrate(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                      !newSubstrate.trim()
                        ? 'border-amber-400 bg-amber-50/50 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    Hệ sơn (System) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Hãy nhập hệ sơn..."
                    value={newSystem}
                    onChange={(e) => setNewSystem(e.target.value)}
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                      !newSystem.trim()
                        ? 'border-amber-400 bg-amber-50/50 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Khởi tạo Hồ sơ (Rev 00)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
