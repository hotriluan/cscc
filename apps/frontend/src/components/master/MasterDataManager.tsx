import React from 'react';
import {
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  PackingMapping,
  UserRole,
  UserAccount,
  formatVnd
} from '@cscc/shared';
import { apiClient } from '../../api/client';
import { SearchableCombobox, ComboboxOption } from '../common/SearchableCombobox';
import {
  Pencil,
  Upload,
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
  X,
  ShieldCheck,
  UserPlus,
  CheckCircle2
} from 'lucide-react';

export type MasterSubTab =
  | 'CUSTOMERS'
  | 'QUOTATIONS'
  | 'STEPS'
  | 'METHODS'
  | 'PACKINGS'
  | 'USERS';

interface MasterDataManagerProps {
  role: UserRole;
  customers: Customer[];
  quotations: QuotationItem[];
  stepsMaster: ApplicationStepMaster[];
  methodsMaster: ApplicationMethod[];
  packingsMaster: PackingMapping[];
  activeSubTab?: MasterSubTab;
  onChangeSubTab?: (tab: MasterSubTab) => void;
  onReloadMasterData: () => Promise<void>;
}

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({
  role,
  customers,
  quotations,
  stepsMaster,
  methodsMaster,
  packingsMaster,
  activeSubTab,
  onChangeSubTab,
  onReloadMasterData
}) => {
  const [internalSubTab, setInternalSubTab] = React.useState<MasterSubTab>(
    activeSubTab || 'CUSTOMERS'
  );

  const rawSubTab = activeSubTab ?? internalSubTab;
  const subTab: MasterSubTab = rawSubTab === 'USERS' && role !== 'ADMIN' ? 'CUSTOMERS' : rawSubTab;

  const handleSelectSubTab = React.useCallback(
    (tab: MasterSubTab) => {
      setInternalSubTab(tab);
      onChangeSubTab?.(tab);
    },
    [onChangeSubTab]
  );
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
  const [newCustSalesman, setNewCustSalesman] = React.useState('');
  const [editingCustId, setEditingCustId] = React.useState<string | null>(null);

  // New Quotation Form (All empty by default)
  const [newQuotCustCode, setNewQuotCustCode] = React.useState('');
  const [newQuotMatCode, setNewQuotMatCode] = React.useState('');
  const [newQuotMatName, setNewQuotMatName] = React.useState('');
  const [newQuotPacking, setNewQuotPacking] = React.useState('');
  const [newQuotNett, setNewQuotNett] = React.useState('');
  const [newQuotPrice, setNewQuotPrice] = React.useState('');
  const [editingQuotId, setEditingQuotId] = React.useState<string | null>(null);

  // New Step Form (Empty by default)
  const [newStepName, setNewStepName] = React.useState('');
  const [newStepOrder, setNewStepOrder] = React.useState('');
  const [editingStepId, setEditingStepId] = React.useState<string | null>(null);

  // New Method Form (All empty by default)
  const [newMethodName, setNewMethodName] = React.useState('');
  const [newMethodEff, setNewMethodEff] = React.useState('');
  const [editingMethodId, setEditingMethodId] = React.useState<string | null>(null);

  // Packing Mapping Form
  const [packCode, setPackCode] = React.useState('');
  const [packDesc, setPackDesc] = React.useState('');
  const [packUnit, setPackUnit] = React.useState<'KG' | 'LTR' | 'SET'>('KG');
  const [packNett, setPackNett] = React.useState('');
  const [editingPackId, setEditingPackId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  const canEditPrice = role !== 'TECHNICAL';

  const customerNameByCode = React.useMemo(
    () => new Map(customers.map((c) => [c.customerId, c.customerName || c.shortName])),
    [customers]
  );
  const customerOptions = React.useMemo<ComboboxOption[]>(
    () =>
      customers.map((c) => ({
        value: c.customerId,
        label: `${c.customerId} — ${c.shortName}`,
        sublabel: c.salesmanName
          ? `${c.customerName} (Sales: ${c.salesmanName})`
          : c.customerName
      })),
    [customers]
  );
  const filterCustomerOptions = React.useMemo<ComboboxOption[]>(
    () => [{ value: '', label: '-- Tất cả Khách hàng --' }, ...customerOptions],
    [customerOptions]
  );

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
    try {
      await apiClient.saveCustomer(role, {
        ...(editingCustId ? { id: editingCustId } : {}),
        customerId: newCustId.trim(),
        shortName: newCustShort.trim(),
        customerName: newCustName.trim(),
        salesmanName: newCustSalesman.trim() || null
      });
    } catch (err) {
      setFormError(
        `Không thể lưu Khách hàng: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    resetCustomerForm();
    await onReloadMasterData();
    await fetchCustomersPage();
  };

  const resetCustomerForm = () => {
    setEditingCustId(null);
    setNewCustId('');
    setNewCustShort('');
    setNewCustName('');
    setNewCustSalesman('');
  };

  const startEditCustomer = (c: Customer) => {
    setFormError(null);
    setEditingCustId(c.id);
    setNewCustId(c.customerId);
    setNewCustShort(c.shortName);
    setNewCustName(c.customerName);
    setNewCustSalesman(c.salesmanName || '');
  };

  const handleUploadCustomerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setStatusMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await apiClient.importCustomersFile(role, btoa(binary));
      await onReloadMasterData();
      await fetchCustomersPage();
      setStatusMessage(
        `Upload ${file.name}: thêm mới ${res.created}, cập nhật ${res.updated}, bỏ qua (không đổi) ${res.skipped} / ${res.total} dòng.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi upload Customer: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
      input.value = '';
    }
  };

  const handleClearAllCustomers = async () => {
    if (custTotal === 0 && customers.length === 0) {
      setStatusMessage('Hiện tại không có dữ liệu khách hàng nào để xóa.');
      return;
    }
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn làm sạch toàn bộ dữ liệu Customer (${custTotal || customers.length} khách hàng)?\n\nTất cả khách hàng sẽ bị xóa khỏi cơ sở dữ liệu để bạn tải lên danh sách mới. Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setImporting(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.clearAllCustomers(role);
      await onReloadMasterData();
      await fetchCustomersPage();
      setStatusMessage(
        `Đã làm sạch thành công toàn bộ ${res.count} khách hàng trong database. Bạn có thể dùng nút 'Upload Customer' để tải lên danh sách mới.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi làm sạch database customer: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAddQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!newQuotCustCode.trim()) missing.push('Khách hàng');
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
    try {
      await apiClient.saveQuotation(role, {
        ...(editingQuotId ? { id: editingQuotId } : {}),
        sapCustomerCode: newQuotCustCode.trim(),
        customerName: customerNameByCode.get(newQuotCustCode.trim()) || undefined,
        materialCode: newQuotMatCode.trim(),
        materialName: newQuotMatName.trim() || newQuotMatCode.trim(),
        packingDesc: newQuotPacking.trim(),
        nett: parseFloat(newQuotNett),
        priceUnitVnd: parseFloat(newQuotPrice)
      });
    } catch (err) {
      setFormError(
        `Không thể lưu Báo giá: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    resetQuotationForm();
    await onReloadMasterData();
    await fetchQuotationsPage();
  };

  const resetQuotationForm = () => {
    setEditingQuotId(null);
    setNewQuotCustCode('');
    setNewQuotMatCode('');
    setNewQuotMatName('');
    setNewQuotPacking('');
    setNewQuotNett('');
    setNewQuotPrice('');
  };

  const startEditQuotation = (q: QuotationItem) => {
    setFormError(null);
    setEditingQuotId(q.id);
    setNewQuotCustCode(q.sapCustomerCode);
    setNewQuotMatCode(q.materialCode);
    setNewQuotMatName(q.materialName);
    setNewQuotPacking(q.packingDesc);
    setNewQuotNett(String(q.nett));
    setNewQuotPrice(q.priceUnitVnd == null ? '' : String(q.priceUnitVnd));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUploadQuotationFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setImporting(true);
    setStatusMessage(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const res = await apiClient.importQuotationsFile(role, btoa(binary));
      await onReloadMasterData();
      await fetchQuotationsPage();
      setStatusMessage(
        `Upload ${file.name}: thêm mới ${res.created}, cập nhật ${res.updated}, bỏ qua (không đổi) ${res.skipped} / ${res.total} dòng.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi upload Quotation: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
      input.value = '';
    }
  };

  const handleClearAllQuotations = async () => {
    if (quotTotal === 0 && quotations.length === 0) {
      setStatusMessage('Hiện tại không có dữ liệu báo giá nào để xóa.');
      return;
    }
    const confirmed = window.confirm(
      `CẢNH BÁO: Bạn có chắc chắn muốn làm sạch toàn bộ dữ liệu Quotation (${quotTotal || quotations.length} dòng)?\n\nTất cả báo giá vật tư sẽ bị xóa khỏi cơ sở dữ liệu để bạn tải lên danh sách mới. Hành động này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setImporting(true);
    setStatusMessage(null);
    try {
      const res = await apiClient.clearAllQuotations(role);
      await onReloadMasterData();
      await fetchQuotationsPage();
      setStatusMessage(
        `Đã làm sạch thành công toàn bộ ${res.count} báo giá vật tư trong database. Bạn có thể dùng nút 'Upload Quotation' để thêm báo giá mới.`
      );
    } catch (err) {
      setStatusMessage(
        `Lỗi làm sạch database quotation: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleAddStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepName.trim()) {
      setFormError(
        'Không thể thêm bước. Phần còn trống: Tên bước thi công (Application Step Name)'
      );
      return;
    }
    const order = parseInt(newStepOrder, 10);
    if (editingStepId && !(order >= 1)) {
      setFormError('Không thể lưu bước. Thứ tự phải là số nguyên >= 1');
      return;
    }
    setFormError(null);
    try {
      await apiClient.saveStepMaster(role, {
        ...(editingStepId ? { id: editingStepId } : {}),
        stepName: newStepName.trim().toUpperCase(),
        sortOrder: editingStepId ? order : stepsMaster.length + 1
      });
    } catch (err) {
      setFormError(
        `Không thể lưu bước: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    resetStepForm();
    await onReloadMasterData();
  };

  const resetStepForm = () => {
    setEditingStepId(null);
    setNewStepName('');
    setNewStepOrder('');
  };

  const startEditStep = (s: ApplicationStepMaster) => {
    setFormError(null);
    setEditingStepId(s.id);
    setNewStepName(s.stepName);
    setNewStepOrder(String(s.sortOrder));
  };

  const resetPackingForm = () => {
    setEditingPackId(null);
    setPackCode('');
    setPackDesc('');
    setPackUnit('KG');
    setPackNett('');
  };

  const startEditPacking = (p: PackingMapping) => {
    setFormError(null);
    setEditingPackId(p.id);
    setPackCode(p.code);
    setPackDesc(p.description);
    setPackUnit(p.unitType);
    setPackNett(String(p.nettWeight));
  };

  const handleSavePacking = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!packCode.trim()) missing.push('Packing Code');
    if (!packNett.trim() || !(parseFloat(packNett) > 0)) missing.push('Nett Weight (> 0)');
    if (missing.length > 0) {
      setFormError(`Không thể lưu Packing. Phần còn trống: ${missing.join(', ')}`);
      return;
    }
    setFormError(null);
    try {
      await apiClient.savePackingMaster(role, {
        ...(editingPackId ? { id: editingPackId } : {}),
        code: packCode.trim(),
        description: packDesc.trim() || packCode.trim(),
        unitType: packUnit,
        nettWeight: parseFloat(packNett)
      });
    } catch (err) {
      setFormError(
        `Không thể lưu Packing: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    resetPackingForm();
    await onReloadMasterData();
  };

  const resetMethodForm = () => {
    setEditingMethodId(null);
    setNewMethodName('');
    setNewMethodEff('');
  };

  const startEditMethod = (m: ApplicationMethod) => {
    setFormError(null);
    setEditingMethodId(m.id);
    setNewMethodName(m.methodName);
    setNewMethodEff(String(m.efficiency));
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
    try {
      await apiClient.saveMethodMaster(role, {
        ...(editingMethodId ? { id: editingMethodId } : {}),
        methodName: newMethodName.trim().toUpperCase(),
        efficiency: parseFloat(newMethodEff)
      });
    } catch (err) {
      setFormError(
        `Không thể lưu Phương pháp: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }
    resetMethodForm();
    await onReloadMasterData();
  };

  // =========================================================================
  // 6. USERS MANAGEMENT (Admin Only)
  // =========================================================================
  const [usersList, setUsersList] = React.useState<UserAccount[]>([]);
  const [salesmenList, setSalesmenList] = React.useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  // User form state
  const [editingUserId, setEditingUserId] = React.useState<string | null>(null);
  const [userEmail, setUserEmail] = React.useState('');
  const [userFullName, setUserFullName] = React.useState('');
  const [userPassword, setUserPassword] = React.useState('');
  const [userRole, setUserRole] = React.useState<UserRole>('TECHNICAL');
  const [userSalesman, setUserSalesman] = React.useState('');
  const [userFormError, setUserFormError] = React.useState<string | null>(null);
  const [userFormSuccess, setUserFormSuccess] = React.useState<string | null>(null);
  const [savingUser, setSavingUser] = React.useState(false);

  const loadUsersAndSalesmen = React.useCallback(async () => {
    if (role !== 'ADMIN') return;
    setLoadingUsers(true);
    try {
      const [users, salesmen] = await Promise.all([
        apiClient.getUsers(role),
        apiClient.getSalesmen(role)
      ]);
      setUsersList(users);
      setSalesmenList(salesmen);
    } catch (err) {
      console.error('Failed to load users or salesmen:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [role]);

  React.useEffect(() => {
    if (role === 'ADMIN') {
      loadUsersAndSalesmen();
    }
  }, [role, loadUsersAndSalesmen]);

  const resetUserForm = () => {
    setEditingUserId(null);
    setUserEmail('');
    setUserFullName('');
    setUserPassword('');
    setUserRole('TECHNICAL');
    setUserSalesman(salesmenList[0] || '');
    setUserFormError(null);
    setUserFormSuccess(null);
  };

  const startEditUser = (u: UserAccount) => {
    setEditingUserId(u.id);
    setUserEmail(u.email);
    setUserFullName(u.fullName);
    setUserPassword('');
    setUserRole(u.role);
    setUserSalesman(u.salesmanName || salesmenList[0] || '');
    setUserFormError(null);
    setUserFormSuccess(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError(null);
    setUserFormSuccess(null);

    const emailTrim = userEmail.trim().toLowerCase();
    const nameTrim = userFullName.trim();
    if (!emailTrim || !nameTrim) {
      setUserFormError('Email and Full Name are required / Email và Họ tên là bắt buộc.');
      return;
    }

    if ((userRole === 'SALES' || userRole === 'TECHNICAL') && !userSalesman.trim()) {
      setUserFormError('Please select an assigned Salesman / Vui lòng chọn Sales man phụ trách.');
      return;
    }

    setSavingUser(true);
    try {
      const payload = {
        email: emailTrim,
        fullName: nameTrim,
        role: userRole,
        salesmanName:
          userRole === 'SALES' || userRole === 'TECHNICAL' ? userSalesman.trim() : null,
        ...(userPassword.trim() ? { password: userPassword.trim() } : {})
      };

      if (editingUserId) {
        await apiClient.updateUser(role, editingUserId, payload);
        setUserFormSuccess('User updated successfully / Cập nhật tài khoản thành công.');
      } else {
        await apiClient.saveUser(role, {
          ...payload,
          password: userPassword.trim() || '123456'
        });
        setUserFormSuccess('User created successfully / Tạo tài khoản mới thành công.');
      }

      resetUserForm();
      await loadUsersAndSalesmen();
    } catch (err) {
      setUserFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (u: UserAccount) => {
    if (
      !window.confirm(
        `Are you sure you want to delete user "${u.fullName}" (${u.email})? / Bạn có chắc muốn xóa tài khoản này?`
      )
    ) {
      return;
    }
    try {
      await apiClient.deleteUser(role, u.id);
      if (editingUserId === u.id) resetUserForm();
      await loadUsersAndSalesmen();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const formatUserCreatedDate = (isoStr: string): string => {
    try {
      const d = new Date(isoStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return isoStr;
    }
  };

  const renderRoleBadge = (roleName: UserRole) => {
    switch (roleName) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
            🛡️ Admin
          </span>
        );
      case 'PROJECT_LEADER':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
            👔 Project Leader
          </span>
        );
      case 'SALES':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            💼 Sales
          </span>
        );
      case 'TECHNICAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            🛠️ Technical TA
          </span>
        );
    }
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
              Sync from Excel / Đồng bộ từ Form CS Industry.xlsx
            </button>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              Import .xlsx / Nhập File Excel
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
              onClick={() => handleSelectSubTab('CUSTOMERS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${subTab === 'CUSTOMERS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Users className="h-3.5 w-3.5" />
              Customer / Khách hàng ({custTotal || customers.length})
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubTab('QUOTATIONS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${subTab === 'QUOTATIONS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Quotation / Báo giá ({quotTotal || quotations.length})
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubTab('STEPS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${subTab === 'STEPS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              Application Step / Bước thi công ({stepsMaster.length})
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubTab('METHODS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${subTab === 'METHODS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              Application Method / Phương pháp ({methodsMaster.length})
            </button>

            <button
              type="button"
              onClick={() => handleSelectSubTab('PACKINGS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${subTab === 'PACKINGS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Package className="h-3.5 w-3.5" />
              Packing Mapping / Quy cách ({packingsMaster.length})
            </button>

            {role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => handleSelectSubTab('USERS')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                  subTab === 'USERS'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                User Accounts / Quản lý Tài khoản ({usersList.length})
              </button>
            )}
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3.5 py-2 text-xs text-slate-700">
            <span>
              Upload file .xlsx (sheet <strong>Customer</strong>): trùng Customer ID → cập nhật
              nếu có thay đổi, giữ nguyên nếu không đổi; chưa có → thêm mới.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={importing || (custTotal === 0 && customers.length === 0)}
                onClick={handleClearAllCustomers}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 transition"
                title="Xóa toàn bộ khách hàng để nạp danh sách mới"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Làm sạch Database ({custTotal || customers.length})
              </button>
              <button
                type="button"
                onClick={() =>
                  apiClient.downloadTemplate(role, 'customers').catch((err) =>
                    setStatusMessage(`Lỗi tải template: ${err instanceof Error ? err.message : String(err)}`)
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-3.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Tải template
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-800">
                <Upload className="h-3.5 w-3.5" />
                {importing ? 'Đang xử lý...' : 'Upload Customer'}
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={importing}
                  onChange={handleUploadCustomerFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          <form
            onSubmit={handleAddCustomer}
            className="grid grid-cols-1 gap-3 sm:grid-cols-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
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
            <input
              type="text"
              placeholder="Salesman Name (Tùy chọn)"
              value={newCustSalesman}
              onChange={(e) => setNewCustSalesman(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                {editingCustId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingCustId ? 'Cập nhật' : 'Thêm / Cập nhật Khách hàng'}
              </button>
              {editingCustId && (
                <button
                  type="button"
                  onClick={resetCustomerForm}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
              )}
            </div>
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
                  <th className="border border-slate-700 px-3 py-2 text-left w-56">
                    Short Name
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Customer Name
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left w-48">
                    Salesman Name
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-center w-20">
                    Sửa / Xóa
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
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-700">
                      {c.salesmanName ? (
                        <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-100">
                          {c.salesmanName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        title="Sửa"
                        onClick={() => startEditCustomer(c)}
                        className="rounded p-1 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Xóa"
                        onClick={async () => {
                          await apiClient.deleteCustomer(role, c.id);
                          if (editingCustId === c.id) resetCustomerForm();
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
          {canEditPrice && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 px-3.5 py-2 text-xs text-slate-700">
              <span>
                Upload file .xlsx (sheet <strong>quotation</strong>): trùng khóa Khách hàng + Material
                Code → cập nhật nếu có thay đổi, giữ nguyên nếu không đổi; chưa có → thêm mới.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={importing || (quotTotal === 0 && quotations.length === 0)}
                  onClick={handleClearAllQuotations}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40 transition"
                  title="Xóa toàn bộ báo giá để nạp danh sách mới"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Làm sạch Database ({quotTotal || quotations.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    apiClient.downloadTemplate(role, 'quotations').catch((err) =>
                      setStatusMessage(`Lỗi tải template: ${err instanceof Error ? err.message : String(err)}`)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-white px-3.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Tải template
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-800">
                  <Upload className="h-3.5 w-3.5" />
                  {importing ? 'Đang xử lý...' : 'Upload Quotation'}
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={importing}
                    onChange={handleUploadQuotationFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {canEditPrice ? (
            <form
              onSubmit={handleAddQuotation}
              className="grid grid-cols-1 gap-2.5 sm:grid-cols-6 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
            >
              <SearchableCombobox
                value={newQuotCustCode}
                options={customerOptions}
                onChange={(v) => setNewQuotCustCode(v)}
                placeholder="-- Chọn khách hàng --"
                searchPlaceholder="Gõ mã hoặc tên khách hàng..."
                compact
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
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                >
                  {editingQuotId ? (
                    <Pencil className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {editingQuotId ? 'Cập nhật' : 'Lưu Báo Giá'}
                </button>
                {editingQuotId && (
                  <button
                    type="button"
                    onClick={resetQuotationForm}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Hủy
                  </button>
                )}
              </div>
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
                <SearchableCombobox
                  value={quotCustomerFilter}
                  options={filterCustomerOptions}
                  onChange={(v) => {
                    setQuotCustomerFilter(v);
                    setQuotPage(1);
                  }}
                  placeholder="-- Tất cả Khách hàng --"
                  searchPlaceholder="Gõ mã hoặc tên khách hàng..."
                  popoverWidthClass="w-96"
                  highlightEmpty={false}
                  compact
                  className="w-64"
                />
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
                  onClick={() => setQuotPage(1)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  «
                </button>
                <button
                  type="button"
                  disabled={quotPage <= 1 || loadingQuotPaged}
                  onClick={() => setQuotPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Trước
                </button>
                <span className="inline-flex items-center gap-1 px-2 font-bold text-slate-800">
                  Trang
                  <input
                    key={quotPage}
                    type="number"
                    min={1}
                    max={quotTotalPages}
                    defaultValue={quotPage}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const n = Math.floor(Number(e.currentTarget.value));
                        if (n >= 1) setQuotPage(Math.min(n, quotTotalPages));
                      }
                    }}
                    className="w-14 rounded border border-slate-300 px-1 py-0.5 text-center text-xs"
                  />
                  / {quotTotalPages}
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
                <button
                  type="button"
                  disabled={quotPage >= quotTotalPages || loadingQuotPaged}
                  onClick={() => setQuotPage(quotTotalPages)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
                >
                  »
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
                    Khách hàng
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Material Code
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left">
                    Description
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-right">
                    Price/nett (VND)
                  </th>
                  {canEditPrice && (
                    <th className="border border-slate-700 px-2.5 py-2 text-center w-24">
                      Sửa / Xóa
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
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-800">
                      {customerNameByCode.get(q.sapCustomerCode) || q.customerName}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 font-mono font-bold text-blue-950">
                      {q.materialCode}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-slate-800">
                      {q.materialName}
                    </td>
                    <td className="border border-slate-200 px-3 py-1.5 text-right font-bold text-emerald-800">
                      {canEditPrice ? formatVnd(q.priceUnitVnd) : '🔒 Ẩn (RBAC)'}
                    </td>
                    {canEditPrice && (
                      <td className="border border-slate-200 px-2.5 py-1.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          title="Sửa"
                          onClick={() => startEditQuotation(q)}
                          className="rounded p-1 text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Xóa"
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
                {pagedQuotations.length === 0 && (
                  <tr>
                    <td
                      colSpan={canEditPrice ? 6 : 5}
                      className="border border-slate-200 py-12 text-center text-slate-400"
                    >
                      <Database className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      <div className="font-semibold text-slate-600">Database Quotation đang trống</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Chưa có dữ liệu báo giá vật tư. Hãy bấm nút <strong>Upload Quotation</strong> ở trên để nạp dữ liệu mới.
                      </div>
                    </td>
                  </tr>
                )}
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
            {editingStepId && (
              <input
                type="number"
                min={1}
                step={1}
                placeholder="Thứ tự"
                value={newStepOrder}
                onChange={(e) => setNewStepOrder(e.target.value)}
                className="w-24 rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              {editingStepId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editingStepId ? 'Cập nhật Bước' : 'Thêm Bước Thi Công'}
            </button>
            {editingStepId && (
              <button
                type="button"
                onClick={resetStepForm}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Hủy
              </button>
            )}
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
                  Sửa / Xóa
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
                  <td className="border border-slate-200 px-3 py-2 text-center whitespace-nowrap">
                    <button
                      type="button"
                      title="Sửa"
                      onClick={() => startEditStep(s)}
                      className="rounded p-1 text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Xóa"
                      onClick={async () => {
                        await apiClient.deleteStepMaster(role, s.id);
                        if (editingStepId === s.id) resetStepForm();
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
            <div className="flex gap-1.5">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                {editingMethodId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingMethodId ? 'Cập nhật' : 'Lưu Phương Pháp & Hiệu Suất'}
              </button>
              {editingMethodId && (
                <button
                  type="button"
                  onClick={resetMethodForm}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
              )}
            </div>
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
                <th className="border border-slate-700 px-3 py-2 text-center w-24">
                  Sửa / Xóa
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
                  <td className="border border-slate-200 px-3 py-2 text-center whitespace-nowrap">
                    <button
                      type="button"
                      title="Sửa"
                      onClick={() => startEditMethod(m)}
                      className="rounded p-1 text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Xóa"
                      onClick={async () => {
                        await apiClient.deleteMethodMaster(role, m.id);
                        if (editingMethodId === m.id) resetMethodForm();
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

      {/* TAB 5: PACKING MAPPING */}
      {subTab === 'PACKINGS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <form
            onSubmit={handleSavePacking}
            className="grid grid-cols-1 gap-3 sm:grid-cols-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200"
          >
            <input
              type="text"
              placeholder="Packing Code"
              value={packCode}
              onChange={(e) => setPackCode(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <input
              type="text"
              placeholder="Description"
              value={packDesc}
              onChange={(e) => setPackDesc(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <select
              value={packUnit}
              onChange={(e) => setPackUnit(e.target.value as 'KG' | 'LTR' | 'SET')}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs"
            >
              <option value="KG">KG</option>
              <option value="LTR">LTR</option>
              <option value="SET">SET</option>
            </select>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Nett Weight"
              value={packNett}
              onChange={(e) => setPackNett(e.target.value)}
              className="rounded border border-slate-300 px-3 py-1.5 text-xs"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                {editingPackId ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editingPackId ? 'Cập nhật' : 'Thêm Packing'}
              </button>
              {editingPackId && (
                <button
                  type="button"
                  onClick={resetPackingForm}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>

          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="border border-slate-700 px-3 py-2 text-left">Packing Code</th>
                <th className="border border-slate-700 px-3 py-2 text-left">Description</th>
                <th className="border border-slate-700 px-3 py-2 text-center">Unit Type</th>
                <th className="border border-slate-700 px-3 py-2 text-right">Nett Weight</th>
                <th className="border border-slate-700 px-3 py-2 text-center w-24">Sửa / Xóa</th>
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
                  <td className="border border-slate-200 px-3 py-1.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      title="Sửa"
                      onClick={() => startEditPacking(p)}
                      className="rounded p-1 text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Xóa"
                      onClick={async () => {
                        await apiClient.deletePackingMaster(role, p.id);
                        if (editingPackId === p.id) resetPackingForm();
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

      {/* ===================================================================== */}
      {/* 6. USERS MANAGEMENT TAB (Admin Only, 100% Bilingual EN/VI)           */}
      {/* ===================================================================== */}
      {subTab === 'USERS' && role === 'ADMIN' && (
        <div className="space-y-4">
          {/* Header & Description */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-purple-950 uppercase tracking-wide">
                  User Accounts Management / Quản lý Tài khoản Người Dùng
                </h3>
                <p className="text-xs text-purple-700">
                  Admin-only access: Create/edit user accounts, assign RBAC roles, and bind Sales man for data isolation. / Quyền Quản trị viên: Quản lý tài khoản, phân vai trò và gán Sales man để phân vùng dữ liệu.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadUsersAndSalesmen}
              disabled={loadingUsers}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-300 bg-white px-3 py-1.5 text-xs font-bold text-purple-800 shadow-sm hover:bg-purple-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              Refresh / Làm mới
            </button>
          </div>

          {/* Form Messages */}
          {userFormError && (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-800 flex items-center justify-between">
              <span>⚠️ {userFormError}</span>
              <button
                type="button"
                onClick={() => setUserFormError(null)}
                className="text-red-500 hover:text-red-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {userFormSuccess && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{userFormSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setUserFormSuccess(null)}
                className="text-emerald-600 hover:text-emerald-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Add / Edit Form */}
          <form
            onSubmit={handleSaveUser}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                {editingUserId ? (
                  <>
                    <Pencil className="h-4 w-4 text-blue-600" />
                    <span>Edit User Account / Chỉnh sửa Tài khoản</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 text-purple-600" />
                    <span>Add New User Account / Thêm Tài khoản Mới</span>
                  </>
                )}
              </div>
              {editingUserId && (
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel Edit / Hủy chỉnh sửa
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Email / Email đăng nhập <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="vd: sales02@alkana.vn"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name / Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={userFullName}
                  onChange={(e) => setUserFullName(e.target.value)}
                  placeholder="vd: Trần Văn C"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Password / Mật khẩu
                </label>
                <input
                  type="text"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder={
                    editingUserId
                      ? 'Leave blank to keep unchanged / Để trống nếu không đổi'
                      : 'Default / Mặc định: 123456'
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  System Role / Vai trò hệ thống <span className="text-red-500">*</span>
                </label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value as UserRole)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold focus:border-purple-600 focus:outline-none"
                >
                  <option value="ADMIN">🛡️ System Admin / Quản trị hệ thống (Toàn quyền)</option>
                  <option value="PROJECT_LEADER">👔 Project Leader / Quản lý Dự án (Full CS + CC)</option>
                  <option value="SALES">💼 Sales / Kinh doanh (CS + CC theo Sales)</option>
                  <option value="TECHNICAL">🛠️ Technical TA / Kỹ thuật viên (Chỉ CS theo Sales — Ẩn giá)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Assigned Salesman / Sales man phụ trách
                  {(userRole === 'SALES' || userRole === 'TECHNICAL') && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                {userRole === 'SALES' || userRole === 'TECHNICAL' ? (
                  <div>
                    <select
                      value={userSalesman}
                      onChange={(e) => setUserSalesman(e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-1.5 font-semibold text-amber-900 focus:border-amber-600 focus:outline-none"
                    >
                      <option value="">-- Select Salesman / Chọn Sales man phụ trách --</option>
                      {salesmenList.map((sm) => (
                        <option key={sm} value={sm}>
                          {sm}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-amber-700">
                      Restricted to customers & quotations of this Salesman / Chỉ xem & làm báo giá cho khách hàng của Sales man này.
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      disabled
                      value="All Access (No restriction) / Toàn quyền - Xem tất cả khách hàng"
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-slate-500 italic cursor-not-allowed"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      ADMIN & PROJECT_LEADER have company-wide access / Quyền quản lý toàn diện toàn công ty.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={savingUser}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {editingUserId ? 'Save Changes / Lưu thay đổi' : 'Add User / Thêm tài khoản'}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    onClick={resetUserForm}
                    className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 font-bold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Cancel / Hủy
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Table of User Accounts */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="border border-slate-700 px-3 py-2.5 text-left font-bold">
                    Email / Hộp thư đăng nhập
                  </th>
                  <th className="border border-slate-700 px-3 py-2.5 text-left font-bold">
                    Full Name / Họ và Tên
                  </th>
                  <th className="border border-slate-700 px-3 py-2.5 text-center font-bold">
                    System Role / Vai trò
                  </th>
                  <th className="border border-slate-700 px-3 py-2.5 text-left font-bold">
                    Assigned Salesman / Sales man phụ trách
                  </th>
                  <th className="border border-slate-700 px-3 py-2.5 text-center font-bold">
                    Created Date / Ngày tạo
                  </th>
                  <th className="border border-slate-700 px-3 py-2.5 text-center font-bold w-24">
                    Actions / Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 italic">
                      {loadingUsers
                        ? 'Loading user accounts / Đang tải danh sách tài khoản...'
                        : 'No user accounts found / Chưa có tài khoản nào.'}
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="border-r border-slate-200 px-3 py-2 font-mono font-bold text-blue-900">
                        {u.email}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-2 font-semibold text-slate-900">
                        {u.fullName}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-2 text-center">
                        {renderRoleBadge(u.role)}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-2">
                        {u.salesmanName ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-bold text-amber-900 border border-amber-200">
                            💼 {u.salesmanName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 font-medium">
                            🌐 All Access / Tất cả
                          </span>
                        )}
                      </td>
                      <td className="border-r border-slate-200 px-3 py-2 text-center text-slate-600 font-mono">
                        {formatUserCreatedDate(u.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Edit / Sửa"
                            onClick={() => startEditUser(u)}
                            className="rounded p-1 text-blue-700 hover:bg-blue-50 transition"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete / Xóa"
                            onClick={() => handleDeleteUser(u)}
                            className="rounded p-1 text-red-600 hover:bg-red-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
