import React from 'react';
import {
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  PackingMapping,
  UserRole,
  formatVnd
} from '@cscc/shared';
import { apiClient } from '../../api/client';
import {
  Database,
  Users,
  FileSpreadsheet,
  ListChecks,
  Gauge,
  Package,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X
} from 'lucide-react';

interface MasterDataManagerProps {
  role: UserRole;
  customers: Customer[];
  quotations: QuotationItem[];
  stepsMaster: ApplicationStepMaster[];
  methodsMaster: ApplicationMethod[];
  packingsMaster: PackingMapping[];
  onReloadMasterData: () => Promise<void>;
}

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({
  role,
  customers,
  quotations,
  stepsMaster,
  methodsMaster,
  packingsMaster,
  onReloadMasterData
}) => {
  const [subTab, setSubTab] = React.useState<
    'CUSTOMERS' | 'QUOTATIONS' | 'STEPS' | 'METHODS' | 'PACKINGS'
  >('CUSTOMERS');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [importing, setImporting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Server-side pagination state for Customers
  const [pagedCustomers, setPagedCustomers] = React.useState<Customer[]>([]);
  const [custPage, setCustPage] = React.useState(1);
  const [custPageSize, setCustPageSize] = React.useState(50);
  const [custTotal, setCustTotal] = React.useState(customers.length);
  const [custTotalPages, setCustTotalPages] = React.useState(1);
  const [loadingCustPaged, setLoadingCustPaged] = React.useState(false);

  // Server-side pagination & filter state for Quotations
  const [pagedQuotations, setPagedQuotations] = React.useState<QuotationItem[]>([]);
  const [quotCustomerFilter, setQuotCustomerFilter] = React.useState('');
  const [quotPage, setQuotPage] = React.useState(1);
  const [quotPageSize, setQuotPageSize] = React.useState(50);
  const [quotTotal, setQuotTotal] = React.useState(quotations.length);
  const [quotTotalPages, setQuotTotalPages] = React.useState(1);
  const [loadingQuotPaged, setLoadingQuotPaged] = React.useState(false);

  // New Customer Form (All empty by default)
  const [newCustId, setNewCustId] = React.useState('');
  const [newCustShort, setNewCustShort] = React.useState('');
  const [newCustName, setNewCustName] = React.useState('');

  // New Quotation Form (All empty by default)
  const [newQuotCustCode, setNewQuotCustCode] = React.useState('');
  const [newQuotMatCode, setNewQuotMatCode] = React.useState('');
  const [newQuotMatName, setNewQuotMatName] = React.useState('');
  const [newQuotPacking, setNewQuotPacking] = React.useState('');
  const [newQuotNett, setNewQuotNett] = React.useState('');
  const [newQuotPrice, setNewQuotPrice] = React.useState('');

  // New Step Form (Empty by default)
  const [newStepName, setNewStepName] = React.useState('');

  // New Method Form (All empty by default)
  const [newMethodName, setNewMethodName] = React.useState('');
  const [newMethodEff, setNewMethodEff] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const canEditPrice = role !== 'TECHNICAL';

  // Debounce search query (220ms) and reset page to 1 when search changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setCustPage(1);
      setQuotPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch server-side paginated Customers from PostgreSQL
  const fetchCustomersPage = React.useCallback(async () => {
    setLoadingCustPaged(true);
    try {
      const res = await apiClient.getCustomersPaged(
        role,
        debouncedQuery,
        custPage,
        custPageSize
      );
      setPagedCustomers(res.items);
      setCustTotal(res.total);
      setCustTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to fetch paged customers:', err);
    } finally {
      setLoadingCustPaged(false);
    }
  }, [role, debouncedQuery, custPage, custPageSize]);

  // Fetch server-side paginated Quotations from PostgreSQL
  const fetchQuotationsPage = React.useCallback(async () => {
    setLoadingQuotPaged(true);
    try {
      const res = await apiClient.getQuotationsPaged(
        role,
        quotCustomerFilter,
        debouncedQuery,
        quotPage,
        quotPageSize
      );
      setPagedQuotations(res.items);
      setQuotTotal(res.total);
      setQuotTotalPages(res.totalPages);
    } catch (err) {
      console.error('Failed to fetch paged quotations:', err);
    } finally {
      setLoadingQuotPaged(false);
    }
  }, [role, quotCustomerFilter, debouncedQuery, quotPage, quotPageSize]);

  React.useEffect(() => {
    fetchCustomersPage();
  }, [fetchCustomersPage, customers.length]);

  React.useEffect(() => {
    fetchQuotationsPage();
  }, [fetchQuotationsPage, quotations.length]);

  const handleReimportDefaultExcel = async () => {
    setImporting(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.importExcelMaster(role, { resetGoldenProject: false });
      await onReloadMasterData();
      await Promise.all([fetchCustomersPage(), fetchQuotationsPage()]);
      setStatusMessage(
        `Đã đồng bộ từ docs/Form CS Industry.xlsx: ${res.counts.customers} Khách hàng, ${res.counts.quotations} Báo giá vật tư, ${res.counts.applicationSteps} Bước, ${res.counts.applicationMethods} Phương pháp.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi đồng bộ Excel: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleUploadExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setStatusMessage(null);
    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const res = await apiClient.importExcelMaster(role, { fileBase64: base64 });
      await onReloadMasterData();
      await Promise.all([fetchCustomersPage(), fetchQuotationsPage()]);
      setStatusMessage(
        `Đã import thành công file ${file.name}: ${res.counts.customers} Khách hàng, ${res.counts.quotations} Báo giá.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi import file: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newCustId.trim()) missing.push('Customer ID');
    if (!newCustShort.trim()) missing.push('Short Name');
    if (!newCustName.trim()) missing.push('Customer Full Name');
    if (missing.length > 0) {
      setFormError(`Không thể lưu Khách hàng. Phần còn trống: ${missing.join(', ')}`);
      return;
    }
    setFormError(null);
    await apiClient.saveCustomer(role, {
      customerId: newCustId.trim(),
      shortName: newCustShort.trim(),
      customerName: newCustName.trim()
    });
    setNewCustId('');
    setNewCustShort('');
    setNewCustName('');
    await onReloadMasterData();
    await fetchCustomersPage();
  };

  const handleAddQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newQuotCustCode.trim()) missing.push('SAP Cust ID');
    if (!newQuotMatCode.trim()) missing.push('Material Code');
    if (!newQuotPacking.trim()) missing.push('Packing');
    if (!newQuotNett.trim() || !(parseFloat(newQuotNett) > 0)) missing.push('Nett (> 0)');
    if (!newQuotPrice.trim() || !(parseFloat(newQuotPrice) > 0))
      missing.push('Price/nett (VND > 0)');
    if (missing.length > 0) {
      setFormError(`Không thể lưu Báo giá. Phần còn trống: ${missing.join(', ')}`);
      return;
    }
    setFormError(null);
    await apiClient.saveQuotation(role, {
      sapCustomerCode: newQuotCustCode.trim(),
      materialCode: newQuotMatCode.trim(),
      materialName: newQuotMatName.trim() || newQuotMatCode.trim(),
      packingDesc: newQuotPacking.trim(),
      nett: parseFloat(newQuotNett),
      priceUnitVnd: parseFloat(newQuotPrice)
    });
    setNewQuotCustCode('');
    setNewQuotMatCode('');
    setNewQuotMatName('');
    setNewQuotPacking('');
    setNewQuotNett('');
    setNewQuotPrice('');
    await onReloadMasterData();
    await fetchQuotationsPage();
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepName.trim()) {
      setFormError(
        'Không thể thêm bước. Phần còn trống: Tên bước thi công (Application Step Name)'
      );
      return;
    }
    setFormError(null);
    await apiClient.saveStepMaster(role, {
      stepName: newStepName.trim().toUpperCase(),
      sortOrder: stepsMaster.length + 1
    });
    setNewStepName('');
    await onReloadMasterData();
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newMethodName.trim()) missing.push('Tên phương pháp (Application Method)');
    if (
      !newMethodEff.trim() ||
      !(parseFloat(newMethodEff) > 0 && parseFloat(newMethodEff) <= 1)
    ) {
      missing.push('Hiệu suất (0 < Efficiency <= 1)');
    }
    if (missing.length > 0) {
      setFormError(`Không thể lưu Phương pháp. Phần còn trống: ${missing.join(', ')}`);
      return;
    }
    setFormError(null);
    await apiClient.saveMethodMaster(role, {
      methodName: newMethodName.trim().toUpperCase(),
      efficiency: parseFloat(newMethodEff)
    });
    setNewMethodName('');
    setNewMethodEff('');
    await onReloadMasterData();
  };

  const custStartIdx = custTotal === 0 ? 0 : (custPage - 1) * custPageSize + 1;
  const custEndIdx = Math.min(custPage * custPageSize, custTotal);

  const quotStartIdx = quotTotal === 0 ? 0 : (quotPage - 1) * quotPageSize + 1;
  const quotEndIdx = Math.min(quotPage * quotPageSize, quotTotal);

  return (
    <div className="space-y-5">
      {/* Header & Excel Sync Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase text-slate-900">
                5.1 MODULE QUẢN TRỊ DỮ LIỆU GỐC (MASTER DATA CRUD & EXCEL SYNC)
              </h2>
              <p className="text-xs text-slate-500">
                Quản lý tập trung 5 bảng Master Data trên PostgreSQL: Customer, Quotation, Application Step, App-method & Packing Mapping
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={importing}
              onClick={handleReimportDefaultExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${importing ? 'animate-spin' : ''}`} />
              Đồng bộ từ docs/Form CS Industry.xlsx
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              Import File .xlsx mới
              <input
                type="file"
                accept=".xlsx"
                onChange={handleUploadExcelFile}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-900">
            {statusMessage}
          </div>
        )}

        {formError && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800">
            ⚠️ {formError}
          </div>
        )}

        {/* Sub-navigation Tabs */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSubTab('CUSTOMERS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === 'CUSTOMERS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Customer ({custTotal || customers.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('QUOTATIONS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === 'QUOTATIONS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Quotation ({quotTotal || quotations.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('STEPS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === 'STEPS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Application Step ({stepsMaster.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('METHODS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === 'METHODS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              App-method ({methodsMaster.length})
            </button>

            <button
              type="button"
              onClick={() => setSubTab('PACKINGS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                subTab === 'PACKINGS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Packing Mapping ({packingsMaster.length})
            </button>
          </div>

          <div className="relative w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm mã KH, tên VT, mã sơn (Server-side)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-8 pr-7 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB 1: CUSTOMERS (Server-Side Paginated) */}
      {subTab === 'CUSTOMERS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <form
            onSubmit={handleAddCustomer}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
          >
            <input
              type="text"
              placeholder="Customer ID (VD: 1200001169)"
              value={newCustId}
              onChange={(e) => setNewCustId(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              placeholder="Short Name (VD: NITORI-HO CHI MINH)"
              value={newCustShort}
              onChange={(e) => setNewCustShort(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              placeholder="Customer Full Name"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm / Cập nhật Khách hàng
            </button>
          </form>

          {/* Pagination & Status Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div>
              Hiển thị <strong>{custStartIdx}–{custEndIdx}</strong> trên tổng số{' '}
              <strong>{custTotal}</strong> khách hàng (PostgreSQL Server-Side)
              {loadingCustPaged && (
                <span className="ml-2 text-blue-600 font-semibold">Đang tải...</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <span>Số dòng:</span>
                <select
                  value={custPageSize}
                  onChange={(e) => {
                    setCustPageSize(Number(e.target.value));
                    setCustPage(1);
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </label>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={custPage <= 1 || loadingCustPaged}
                  onClick={() => setCustPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Trang {custPage} / {custTotalPages}
                </span>
                <button
                  type="button"
                  disabled={custPage >= custTotalPages || loadingCustPaged}
                  onClick={() => setCustPage((p) => Math.min(custTotalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-800 text-white">
                <tr>
                  <th className="border border-slate-700 px-3 py-2 text-left w-36">
                    Customer ID
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left w-60">
                    Short Name
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Customer Name
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-center w-20">
                    Xóa
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 border-b border-slate-200">
                    <td className="border border-slate-200 px-3 py-1.5 font-mono font-bold text-blue-900">
                      {c.customerId}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 font-semibold">
                      {c.shortName}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-700">
                      {c.customerName}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiClient.deleteCustomer(role, c.id);
                          await onReloadMasterData();
                          await fetchCustomersPage();
                        }}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: QUOTATIONS (Server-Side Filtered & Paginated) */}
      {subTab === 'QUOTATIONS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {canEditPrice ? (
            <form
              onSubmit={handleAddQuotation}
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-6 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
            >
              <input
                type="text"
                placeholder="SAP Cust ID (1200001169)"
                value={newQuotCustCode}
                onChange={(e) => setNewQuotCustCode(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                placeholder="Material Code (PSV-76000...)"
                value={newQuotMatCode}
                onChange={(e) => setNewQuotMatCode(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                placeholder="Material Description"
                value={newQuotMatName}
                onChange={(e) => setNewQuotMatName(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Packing (20 Kg)"
                  value={newQuotPacking}
                  onChange={(e) => setNewQuotPacking(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  placeholder="Nett (20)"
                  value={newQuotNett}
                  onChange={(e) => setNewQuotNett(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                />
              </div>
              <input
                type="number"
                placeholder="Price/nett (VND)"
                value={newQuotPrice}
                onChange={(e) => setNewQuotPrice(e.target.value)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-semibold"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Lưu Báo Giá
              </button>
            </form>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
              Tài khoản <strong>TECHNICAL</strong> chỉ xem được danh mục vật tư kỹ thuật; cột đơn giá (Price/nett) đã được ẩn theo phân quyền bảo mật.
            </div>
          )}

          {/* Server-Side Filter & Pagination Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-semibold">Lọc theo Khách hàng:</span>
                <select
                  value={quotCustomerFilter}
                  onChange={(e) => {
                    setQuotCustomerFilter(e.target.value);
                    setQuotPage(1);
                  }}
                  className="max-w-xs rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="">-- Tất cả Khách hàng --</option>
                  {customers.slice(0, 200).map((c) => (
                    <option key={c.id} value={c.customerId}>
                      {c.customerId} — {c.shortName}
                    </option>
                  ))}
                </select>
                {quotCustomerFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuotCustomerFilter('');
                      setQuotPage(1);
                    }}
                    className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-slate-300"
                  >
                    Bỏ lọc
                  </button>
                )}
              </div>

              <span className="text-slate-500">
                Hiển thị <strong>{quotStartIdx}–{quotEndIdx}</strong> /{' '}
                <strong>{quotTotal}</strong> báo giá (PostgreSQL)
                {loadingQuotPaged && (
                  <span className="ml-2 text-blue-600 font-semibold">Đang tải...</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <span>Số dòng:</span>
                <select
                  value={quotPageSize}
                  onChange={(e) => {
                    setQuotPageSize(Number(e.target.value));
                    setQuotPage(1);
                  }}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </label>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={quotPage <= 1 || loadingQuotPaged}
                  onClick={() => setQuotPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="px-2 font-bold text-slate-800">
                  Trang {quotPage} / {quotTotalPages}
                </span>
                <button
                  type="button"
                  disabled={quotPage >= quotTotalPages || loadingQuotPaged}
                  onClick={() => setQuotPage((p) => Math.min(quotTotalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  Sau
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-800 text-white">
                <tr>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    SAP Cust ID
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Material Code
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Description
                  </th>
                  <th className="border border-slate-700 px-2.5 py-2 text-center">
                    Packing
                  </th>
                  <th className="border border-slate-700 px-2.5 py-2 text-right">Nett</th>
                  <th className="border border-slate-700 px-3 py-2 text-right">
                    Price/nett (VND)
                  </th>
                  {canEditPrice && (
                    <th className="border border-slate-700 px-2.5 py-2 text-center w-16">
                      Xóa
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 border-b border-slate-200">
                    <td className="border border-slate-200 px-3 py-1.5 font-mono text-slate-600">
                      {q.sapCustomerCode}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 font-mono font-bold text-blue-950">
                      {q.materialCode}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-800">
                      {q.materialName}
                    </td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-center">
                      {q.packingDesc}
                    </td>
                    <td className="border border-slate-200 px-2.5 py-1.5 text-right">
                      {q.nett}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-right font-bold text-emerald-800">
                      {canEditPrice ? formatVnd(q.priceUnitVnd) : '🔒 Ẩn (RBAC)'}
                    </td>
                    {canEditPrice && (
                      <td className="border border-slate-200 px-2.5 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiClient.deleteQuotation(role, q.id);
                            await onReloadMasterData();
                            await fetchQuotationsPage();
                          }}
                          className="rounded p-1 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: APPLICATION STEPS */}
      {subTab === 'STEPS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <form
            onSubmit={handleAddStep}
            className="flex gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
          >
            <input
              type="text"
              placeholder="Tên bước chuẩn mới (VD: ISOLATOR, STAIN, TOP COAT...)"
              value={newStepName}
              onChange={(e) => setNewStepName(e.target.value)}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm Bước Thi Công
            </button>
          </form>

          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="border border-slate-700 px-3 py-2 text-center w-20">
                  Thứ tự
                </th>
                <th className="border border-slate-700 px-3 py-2 text-left">
                  Application Step Name
                </th>
                <th className="border border-slate-700 px-3 py-2 text-center w-24">
                  Xóa
                </th>
              </tr>
            </thead>
            <tbody>
              {stepsMaster.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="border border-slate-200 px-3 py-2 text-center font-semibold">
                    {s.sortOrder}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 font-bold text-slate-900">
                    {s.stepName}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiClient.deleteStepMaster(role, s.id);
                        await onReloadMasterData();
                      }}
                      className="rounded p-1 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: APPLICATION METHODS */}
      {subTab === 'METHODS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <form
            onSubmit={handleAddMethod}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
          >
            <input
              type="text"
              placeholder="Tên phương pháp (VD: SPRAY, WIPING, ROLLER)"
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              type="number"
              step="0.05"
              min="0.05"
              max="1"
              placeholder="Hiệu suất 0..1 (VD: 0.60 = 60%)"
              value={newMethodEff}
              onChange={(e) => setNewMethodEff(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Lưu Phương Pháp & Hiệu Suất
            </button>
          </form>

          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="border border-slate-700 px-3 py-2 text-left">
                  Application Method
                </th>
                <th className="border border-slate-700 px-3 py-2 text-center">
                  Efficiency (Decimal)
                </th>
                <th className="border border-slate-700 px-3 py-2 text-center">
                  Efficiency (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {methodsMaster.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="border border-slate-200 px-3 py-2 font-bold text-slate-900">
                    {m.methodName}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-mono">
                    {m.efficiency}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-emerald-700">
                    {Math.round(m.efficiency * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: PACKING MAPPING */}
      {subTab === 'PACKINGS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="border border-slate-700 px-3 py-2 text-left">Packing Code</th>
                <th className="border border-slate-700 px-3 py-2 text-left">Description</th>
                <th className="border border-slate-700 px-3 py-2 text-center">Unit Type</th>
                <th className="border border-slate-700 px-3 py-2 text-right">Nett Weight</th>
              </tr>
            </thead>
            <tbody>
              {packingsMaster.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-200">
                  <td className="border border-slate-200 px-3 py-1.5 font-mono font-bold text-blue-900">
                    {p.code}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5">{p.description}</td>
                  <td className="border border-slate-200 px-3 py-1.5 text-center font-semibold">
                    {p.unitType}
                  </td>
                  <td className="border border-slate-200 px-3 py-1.5 text-right font-bold">
                    {p.nettWeight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
