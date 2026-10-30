import React from 'react';
import {
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  PackingMapping,
  Project,
  ProjectRevision,
  UserRole,
  UserAccount,
  calculateCoatingCostTable,
  calculateBomSummary,
  formatVnd,
  parseCaInput
} from '@cscc/shared';
import { apiClient, getStoredAuthToken, setStoredAuthToken } from './api/client';
import { CoatingScheduleEditor } from './components/schedule/CoatingScheduleEditor';
import { CoatingCostTable } from './components/cost/CoatingCostTable';
import { BomSummaryView } from './components/bom/BomSummaryView';
import { MasterDataManager } from './components/master/MasterDataManager';
import { ProjectExplorerView } from './components/projects/ProjectExplorerView';
import { PrintableSheetA4 } from './components/print/PrintableSheetA4';
import { UserAuthModal } from './components/auth/UserAuthModal';
import {
  ClipboardList,
  Calculator,
  Boxes,
  Database,
  FolderKanban,
  Shield,
  Save,
  Copy,
  Lock,
  Unlock,
  Download,
  Printer,
  FolderPlus,
  CheckCircle2,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
  LogIn
} from 'lucide-react';

export function App() {
  const [role, setRole] = React.useState<UserRole>('PROJECT_LEADER');
  const [currentUser, setCurrentUser] = React.useState<UserAccount | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState<boolean>(false);
  const [mainSection, setMainSection] = React.useState<
    'WORKSPACE' | 'PROJECTS' | 'MASTER_DATA'
  >('WORKSPACE');
  const [workspaceTab, setWorkspaceTab] = React.useState<'CS' | 'CC' | 'BOM'>('CS');

  // Toggle states for Sidebar & internal Sidebar sections
  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true);
  const [showRbacSection, setShowRbacSection] = React.useState<boolean>(true);
  const [showProjectsSection, setShowProjectsSection] = React.useState<boolean>(true);
  const [showLiveCostFooter, setShowLiveCostFooter] = React.useState<boolean>(true);

  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [quotations, setQuotations] = React.useState<QuotationItem[]>([]);
  const [stepsMaster, setStepsMaster] = React.useState<ApplicationStepMaster[]>([]);
  const [methodsMaster, setMethodsMaster] = React.useState<ApplicationMethod[]>([]);
  const [packingsMaster, setPackingsMaster] = React.useState<PackingMapping[]>([]);

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [activeRevision, setActiveRevision] = React.useState<ProjectRevision | null>(
    null
  );
  const [areaM2, setAreaM2] = React.useState<number>(1);
  const [sidebarProjectSearch, setSidebarProjectSearch] = React.useState('');

  const [loading, setLoading] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [saveToast, setSaveToast] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [showPrintModal, setShowPrintModal] = React.useState<boolean>(false);

  // Restore JWT session from PostgreSQL User table if token is present in localStorage
  React.useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) return;
    apiClient
      .getMe(role)
      .then((res) => {
        setCurrentUser(res.user);
        setRole(res.user.role);
      })
      .catch(() => {
        setStoredAuthToken(null);
        setCurrentUser(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enforce RBAC: if user switches to TECHNICAL while viewing CC tab, redirect immediately to CS
  React.useEffect(() => {
    if (role === 'TECHNICAL' && workspaceTab === 'CC') {
      setWorkspaceTab('CS');
    }
  }, [role, workspaceTab]);

  const loadAllData = React.useCallback(
    async (targetRevisionId?: string) => {
      setLoading(true);
      try {
        const [custs, quots, steps, methods, packings, projs] = await Promise.all([
          apiClient.getCustomers(role),
          apiClient.getQuotations(role, '', '', 10000),
          apiClient.getStepsMaster(role),
          apiClient.getMethodsMaster(role),
          apiClient.getPackingsMaster(role),
          apiClient.getProjects(role)
        ]);

        setCustomers(custs);
        setQuotations(quots);
        setStepsMaster(steps);
        setMethodsMaster(methods);
        setPackingsMaster(packings);
        setProjects(projs);

        const defaultProj =
          projs.find((p) => p.projectCode === 'NTR 001') ?? projs[0];
        const fallbackRevId =
          defaultProj?.revisions[defaultProj.revisions.length - 1]?.id ||
          'rev-ntr001-00';

        const revIdToLoad =
          targetRevisionId || activeRevision?.id || fallbackRevId;

        if (revIdToLoad) {
          const rev = await apiClient
            .getRevision(role, revIdToLoad)
            .catch(() => apiClient.getRevision(role, fallbackRevId));
          setActiveRevision(rev);
          setAreaM2(1);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    },
    [role, activeRevision?.id]
  );

  React.useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Real-time client-side calculation for Coating Cost (CC) & BOM Summary
  const liveCostSummary = React.useMemo(() => {
    if (!activeRevision || role === 'TECHNICAL') return null;
    return calculateCoatingCostTable(activeRevision.id, activeRevision.steps);
  }, [activeRevision, role]);

  const liveBomSummary = React.useMemo(() => {
    if (!activeRevision) return null;
    return calculateBomSummary(
      activeRevision.id,
      areaM2,
      activeRevision.steps,
      role
    );
  }, [activeRevision, areaM2, role]);

  // Filter projects in Sidebar by sidebarProjectSearch
  const filteredSidebarProjects = React.useMemo(() => {
    const q = sidebarProjectSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter((p) => {
      const revText = p.revisions
        .map((r) => `${r.productName} ${r.colorName} ${r.substrate || ''}`)
        .join(' ');
      const hay =
        `${p.projectCode} ${p.customer.shortName} ${p.customer.customerId} ${revText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, sidebarProjectSearch]);

  // Validate all required fields on a Revision before allowing Save or Lock
  const validateRevisionBeforeSave = (rev: ProjectRevision): string[] => {
    const errs: string[] = [];

    // 1. Header fields
    if (!rev.customer?.customerId?.trim()) {
      errs.push('Phần Header: Chưa chọn Khách hàng (Customer)');
    }
    if (!rev.projectCode?.trim()) {
      errs.push('Phần Header: Chưa nhập Mã Hồ Sơ (No.)');
    }
    if (!rev.productName?.trim()) {
      errs.push('Phần Header: Chưa nhập Tên Sản phẩm (Product / Item)');
    }
    if (!rev.colorName?.trim()) {
      errs.push('Phần Header: Chưa nhập Màu sắc (Color)');
    }
    if (!rev.substrate?.trim()) {
      errs.push('Phần Header: Chưa nhập Loại gỗ (Substrate)');
    }
    if (!rev.finishingSystem?.trim()) {
      errs.push('Phần Header: Chưa nhập Hệ sơn (System)');
    }

    // 2. Steps & Chemical Items
    if (!rev.steps || rev.steps.length === 0) {
      errs.push('Quy trình thi công: Chưa có bước thi công nào');
    } else {
      rev.steps.forEach((step, idx) => {
        if (step.rowType === 'SANDING') {
          if (!step.sandingSpec?.trim()) {
            errs.push(
              `Hàng chà nhám (SANDING) ở vị trí dòng #${idx + 1}: Chưa nhập thông số nhám`
            );
          }
          return;
        }

        const stepLabel = `Bước ${step.stepNumber ?? idx + 1}`;
        if (!step.stepName?.trim()) {
          errs.push(
            `${stepLabel}: Chưa chọn Tên bước thi công (Application Step)`
          );
        }
        if (!step.caInputRaw?.trim() || parseCaInput(step.caInputRaw).caAvg <= 0) {
          errs.push(`${stepLabel}: Chưa nhập Định mức sơn CA (g/m²)`);
        }
        if (!step.methodName?.trim()) {
          errs.push(
            `${stepLabel}: Chưa chọn Phương pháp thi công (Application Method)`
          );
        }
        if (!step.dryingTime?.trim()) {
          errs.push(
            `${stepLabel}: Chưa nhập Thời gian khô (Drying Time Recommended)`
          );
        }

        if (!step.items || step.items.length === 0) {
          errs.push(`${stepLabel}: Chưa có vật tư nào trong bước`);
        } else {
          step.items.forEach((item, itemIdx) => {
            if (!item.materialCode?.trim()) {
              errs.push(
                `${stepLabel} (Vật tư dòng ${itemIdx + 1}): Chưa chọn Mã vật tư (Product Code)`
              );
            }
            if (!item.mixingRatio || item.mixingRatio <= 0) {
              errs.push(
                `${stepLabel} (Vật tư dòng ${itemIdx + 1}): Chưa nhập Tỷ lệ pha (Mixing Ratio > 0)`
              );
            }
          });
        }
      });
    }

    return errs;
  };

  const handleSaveRevision = async (revToSave = activeRevision) => {
    if (!revToSave || revToSave.status === 'LOCKED') return;

    const missingErrors = validateRevisionBeforeSave(revToSave);
    if (missingErrors.length > 0) {
      setValidationErrors(missingErrors);
      setMainSection('WORKSPACE');
      setWorkspaceTab('CS');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    setSaving(true);
    try {
      const res = await apiClient.updateRevision(role, revToSave.id, {
        ...revToSave,
        customerId: revToSave.customer.id,
        defaultAreaM2: areaM2
      });
      setActiveRevision(res.revision);
      const updatedProjects = await apiClient.getProjects(role);
      setProjects(updatedProjects);
      setSaveToast('Đã lưu và đồng bộ Coating Schedule & Coating Cost!');
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err) {
      alert(`Lỗi khi lưu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCloneRevision = async () => {
    if (!activeRevision) return;
    setValidationErrors([]);
    const cloned = await apiClient.cloneRevision(role, activeRevision.id, true);
    await loadAllData(cloned.id);
    setSaveToast(
      `Đã nhân bản thành công sang Rev ${String(cloned.revisionNo).padStart(2, '0')}!`
    );
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleToggleLock = async () => {
    if (!activeRevision) return;
    const nextStatus = activeRevision.status === 'LOCKED' ? 'DRAFT' : 'LOCKED';
    if (nextStatus === 'LOCKED') {
      const missingErrors = validateRevisionBeforeSave(activeRevision);
      if (missingErrors.length > 0) {
        setValidationErrors(missingErrors);
        setMainSection('WORKSPACE');
        setWorkspaceTab('CS');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setValidationErrors([]);
    }
    const updated = await apiClient.updateRevisionStatus(
      role,
      activeRevision.id,
      nextStatus
    );
    setActiveRevision(updated);
    const projs = await apiClient.getProjects(role);
    setProjects(projs);
  };

  const handleCreateProjectFromExplorer = async (payload: {
    projectCode: string;
    customerId: string;
    productName: string;
    colorName: string;
    substrate: string;
    finishingSystem: string;
  }) => {
    const res = await apiClient.createProject(role, payload);
    await loadAllData(res.revision.id);
    setMainSection('WORKSPACE');
    setWorkspaceTab('CS');
    setSaveToast(`Đã khởi tạo hồ sơ ${res.project.projectCode} (Rev 00)!`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await apiClient.deleteProject(role, projectId);
      const remaining = projects.filter((p) => p.id !== projectId);
      const nextRevId =
        activeRevision?.projectId === projectId
          ? remaining[0]?.revisions[remaining[0].revisions.length - 1]?.id
          : activeRevision?.id;
      await loadAllData(nextRevId);
      setSaveToast('Đã xóa hồ sơ dự án!');
      setTimeout(() => setSaveToast(null), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteRevision = async (revisionId: string) => {
    try {
      await apiClient.deleteRevision(role, revisionId);
      const nextRevId =
        activeRevision?.id === revisionId ? undefined : activeRevision?.id;
      await loadAllData(nextRevId);
      setSaveToast('Đã xóa phiên bản nháp!');
      setTimeout(() => setSaveToast(null), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleQuickCreateStepMaster = async (stepName: string) => {
    await apiClient.saveStepMaster(role, {
      stepName: stepName.toUpperCase(),
      sortOrder: stepsMaster.length + 1
    });
    const updatedSteps = await apiClient.getStepsMaster(role);
    setStepsMaster(updatedSteps);
  };

  const canViewCost = role !== 'TECHNICAL';

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      {/* ===================================================================
          LEFT SIDEBAR (COLLAPSIBLE / SHOW-HIDE FULL SIDEBAR + SUB-SECTIONS)
         =================================================================== */}
      {isSidebarOpen && (
        <aside className="no-print sticky top-0 h-screen w-72 shrink-0 bg-slate-950 text-slate-100 flex flex-col justify-between border-r border-slate-800 overflow-hidden transition-all duration-200">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Brand Logo + Collapse Sidebar Button */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 font-black text-white text-base shadow">
                  AK
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold tracking-wide text-white">
                    ALKANA COATING
                  </div>
                  <div className="truncate text-[11px] text-slate-400">
                    CS & CC Automation System
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                title="Ẩn thanh menu bên trái (Mở rộng toàn màn hình)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:border-blue-500 hover:bg-slate-800 hover:text-white transition"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Role-Based Access Switcher (RBAC) & PostgreSQL User Auth — Collapsible */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
              <button
                type="button"
                onClick={() => setShowRbacSection((prev) => !prev)}
                className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Tài khoản & Phân quyền (RBAC)
                </span>
                {showRbacSection ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>

              {showRbacSection && (
                <div className="mt-2 space-y-2">
                  {/* PostgreSQL User Account Session Card */}
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-2.5 py-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-white flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">
                          {currentUser ? currentUser.fullName : 'Chế độ Demo / RBAC Nhanh'}
                        </span>
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {currentUser
                          ? `${currentUser.email} (${currentUser.role})`
                          : 'Chưa đăng nhập JWT (Dùng Role Switcher)'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="shrink-0 inline-flex items-center gap-1 rounded bg-blue-600/90 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-500"
                    >
                      <LogIn className="h-3 w-3" />
                      {currentUser ? 'Tài khoản' : 'Đăng nhập'}
                    </button>
                  </div>

                  {/* Quick RBAC Role Switcher Dropdown */}
                  <div>
                    <div className="mb-1 text-[10px] font-semibold text-slate-400">
                      Chuyển nhanh vai trò (Role Switcher):
                    </div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="PROJECT_LEADER">
                        👔 Quản lý / Kinh doanh (Full CS + CC)
                      </option>
                      <option value="SALES">💼 Sales / Báo giá (Xem CS + CC)</option>
                      <option value="TECHNICAL">
                        🛠️ Kỹ thuật viên (Chỉ CS — Ẩn giá CC)
                      </option>
                      <option value="ADMIN">
                        🛡️ Quản trị hệ thống (Admin — Toàn quyền)
                      </option>
                    </select>
                    <p className="mt-1 text-[10px] leading-snug text-slate-400">
                      {role === 'TECHNICAL'
                        ? '🔒 Đang ẩn toàn bộ đơn giá (VND) và khóa Tab Coating Cost.'
                        : '✅ Đang mở quyền truy cập Tab Coating Cost (VND/m²) & Đơn giá.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Navigation */}
            <nav className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Menu Chính
              </div>
              <button
                type="button"
                onClick={() => setMainSection('WORKSPACE')}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'WORKSPACE'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <ClipboardList className="h-4 w-4 shrink-0" />
                <span>Workspace (Lập lịch & Giá)</span>
              </button>

              <button
                type="button"
                onClick={() => setMainSection('PROJECTS')}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'PROJECTS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span>Quản lý Hồ sơ Dự án</span>
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMainSection('MASTER_DATA')}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'MASTER_DATA'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Database className="h-4 w-4 shrink-0" />
                <span>Quản trị Master Data (CRUD)</span>
              </button>
            </nav>

            {/* Tier 1: Project & Revision Search + Accordion on Sidebar — Collapsible */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => setShowProjectsSection((prev) => !prev)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white"
                >
                  {showProjectsSection ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>
                    Hồ sơ Dự án ({filteredSidebarProjects.length}/{projects.length})
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMainSection('PROJECTS')}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-slate-700"
                  >
                    Tra cứu / +Mới
                  </button>
                </div>
              </div>

              {showProjectsSection && (
                <>
                  {/* Instant Sidebar Search Input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={sidebarProjectSearch}
                      onChange={(e) => setSidebarProjectSearch(e.target.value)}
                      placeholder="Tìm mã NTR, KH, sản phẩm, màu..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-6 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                    />
                    {sidebarProjectSearch && (
                      <button
                        type="button"
                        onClick={() => setSidebarProjectSearch('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Smart Accordion List */}
                  <div className="space-y-1.5">
                    {filteredSidebarProjects.length === 0 ? (
                      <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-center text-[11px] text-slate-400">
                        Không tìm thấy hồ sơ "{sidebarProjectSearch}"
                      </div>
                    ) : (
                      filteredSidebarProjects.map((proj) => {
                        const isActiveProject = activeRevision?.projectId === proj.id;
                        const latestRev =
                          proj.revisions[proj.revisions.length - 1] ??
                          proj.revisions[0];

                        return (
                          <div
                            key={proj.id}
                            className={`rounded-lg border transition ${
                              isActiveProject
                                ? 'border-blue-500/60 bg-slate-900'
                                : 'border-slate-800/80 bg-slate-900/40 hover:bg-slate-900/80'
                            }`}
                          >
                            {/* Project Header Row */}
                            <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (latestRev) {
                                    const loaded = await apiClient.getRevision(
                                      role,
                                      latestRev.id
                                    );
                                    setActiveRevision(loaded);
                                    setMainSection('WORKSPACE');
                                  }
                                }}
                                className="flex min-w-0 flex-1 items-start gap-1.5 text-left"
                              >
                                {isActiveProject ? (
                                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-400" />
                                ) : (
                                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-bold text-white">
                                    {proj.projectCode} — {proj.customer.shortName}
                                  </div>
                                  {latestRev && (
                                    <div className="truncate text-[10px] text-slate-400">
                                      {latestRev.productName} • {latestRev.colorName}
                                    </div>
                                  )}
                                </div>
                              </button>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                  {proj.revisions.length} Rev
                                </span>
                                {projects.length > 1 && (
                                  <button
                                    type="button"
                                    title={`Xóa hồ sơ ${proj.projectCode}`}
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (
                                        window.confirm(
                                          `Xóa hồ sơ dự án "${proj.projectCode} — ${proj.customer.shortName}"?`
                                        )
                                      ) {
                                        await handleDeleteProject(proj.id);
                                      }
                                    }}
                                    className="rounded p-1 text-slate-500 hover:bg-red-950 hover:text-red-400"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expanded Revisions Pills (Shown for Active Project or when searching) */}
                            {(isActiveProject || sidebarProjectSearch.trim() !== '') && (
                              <div className="flex flex-wrap gap-1 border-t border-slate-800/80 px-2.5 py-2 bg-slate-950/50 rounded-b-lg">
                                {proj.revisions.map((r) => {
                                  const isSelected = activeRevision?.id === r.id;
                                  const canDeleteRev =
                                    proj.revisions.length > 1 &&
                                    r.status !== 'LOCKED';
                                  return (
                                    <div
                                      key={r.id}
                                      className={`inline-flex items-center rounded text-[11px] font-bold transition ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const loaded = await apiClient.getRevision(
                                            role,
                                            r.id
                                          );
                                          setActiveRevision(loaded);
                                          setMainSection('WORKSPACE');
                                        }}
                                        className="px-2 py-0.5"
                                      >
                                        Rev {String(r.revisionNo).padStart(2, '0')}
                                        {r.status === 'LOCKED' ? ' 🔒' : ''}
                                      </button>
                                      {canDeleteRev && (
                                        <button
                                          type="button"
                                          title={`Xóa bản nháp Rev ${String(r.revisionNo).padStart(2, '0')}`}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (
                                              window.confirm(
                                                `Xóa phiên bản nháp Rev ${String(r.revisionNo).padStart(2, '0')}?`
                                              )
                                            ) {
                                              await handleDeleteRevision(r.id);
                                            }
                                          }}
                                          className="border-l border-white/15 px-1 py-0.5 hover:text-red-300"
                                        >
                                          <X className="h-2.5 w-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Live Cost Summary Widget in Sidebar Footer — Collapsible */}
          <div className="shrink-0 p-3 border-t border-slate-800 bg-slate-900">
            <button
              type="button"
              onClick={() => setShowLiveCostFooter((prev) => !prev)}
              className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300"
            >
              <span>
                {canViewCost
                  ? `Live Total Coating Cost (${activeRevision?.projectCode || ''})`
                  : 'Chế độ Kỹ thuật viên'}
              </span>
              {showLiveCostFooter ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            {showLiveCostFooter && (
              <div className="mt-1">
                {canViewCost && liveCostSummary ? (
                  <div>
                    <div className="text-lg font-black text-white">
                      {formatVnd(liveCostSummary.totalCoatingCostDisplay)}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        VND/m²
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Tự động nhảy real-time khi sửa Schedule
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    Chỉ hiển thị thông số kỹ thuật Coating Schedule.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ===================================================================
          MAIN WORKSPACE AREA
         =================================================================== */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Action Header */}
        <header className="no-print sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
          {mainSection === 'WORKSPACE' && activeRevision ? (
            <>
              {/* Sidebar Toggle + Workspace Tabs: CS / CC (Read-only, RBAC protected) / BOM */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  title={
                    isSidebarOpen
                      ? 'Ẩn thanh menu bên trái (Mở rộng bảng làm việc)'
                      : 'Hiện thanh menu bên trái'
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                    isSidebarOpen
                      ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  }`}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <>
                      <PanelLeftOpen className="h-4 w-4" />
                      <span>Hiện Menu</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('CS')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                    workspaceTab === 'CS'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  1. Coating Schedule (CS — Nhập liệu)
                </button>

                {canViewCost && (
                  <button
                    type="button"
                    onClick={() => setWorkspaceTab('CC')}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                      workspaceTab === 'CC'
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Calculator className="h-4 w-4" />
                    2. Coating Cost (CC — Read-Only:{' '}
                    {liveCostSummary
                      ? `${formatVnd(liveCostSummary.totalCoatingCostDisplay)} đ/m²`
                      : ''}
                    )
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setWorkspaceTab('BOM')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
                    workspaceTab === 'BOM'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Boxes className="h-4 w-4" />
                  3. BOM Summary (Dự toán Vật tư)
                </button>
              </div>

              {/* Action Buttons: Save, Clone Rev, Lock, Export Excel, Print A4 */}
              <div className="flex flex-wrap items-center gap-2">
                {saveToast && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saveToast}
                  </span>
                )}

                <button
                  type="button"
                  disabled={saving || activeRevision.status === 'LOCKED'}
                  onClick={() => handleSaveRevision(activeRevision)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Đang lưu...' : 'Lưu Hồ Sơ'}
                </button>

                <button
                  type="button"
                  onClick={handleCloneRevision}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5 text-blue-600" />
                  Nhân bản sang Rev mới
                </button>

                <button
                  type="button"
                  onClick={handleToggleLock}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    activeRevision.status === 'LOCKED'
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {activeRevision.status === 'LOCKED' ? (
                    <>
                      <Unlock className="h-3.5 w-3.5 text-amber-600" />
                      Mở khóa Rev
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 text-slate-600" />
                      Khóa & Chốt giá
                    </>
                  )}
                </button>

                <a
                  href={apiClient.getExcelDownloadUrl(
                    activeRevision.id,
                    role,
                    areaM2
                  )}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  Xuất Excel (.xlsx)
                </a>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  In A4 / PDF
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  title={
                    isSidebarOpen
                      ? 'Ẩn thanh menu bên trái'
                      : 'Hiện thanh menu bên trái'
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition ${
                    isSidebarOpen
                      ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  }`}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <>
                      <PanelLeftOpen className="h-4 w-4" />
                      <span>Hiện Menu</span>
                    </>
                  )}
                </button>
                <div className="text-sm font-bold text-slate-800">
                  {mainSection === 'PROJECTS'
                    ? 'Danh mục Quản lý & Tra cứu Hồ sơ Dự án (Project Explorer)'
                    : 'Quản trị Cơ sở Dữ liệu Gốc (Master Data Management)'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {saveToast && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saveToast}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMainSection('WORKSPACE')}
                  className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Quay lại Màn hình Lập lịch (CS / CC)
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Body */}
        <div className="p-4 xl:p-6 flex-1 min-w-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
              Đang tải dữ liệu hệ thống từ Form CS Industry.xlsx...
            </div>
          ) : mainSection === 'PROJECTS' ? (
            <ProjectExplorerView
              projects={projects}
              customers={customers}
              activeRevisionId={activeRevision?.id}
              role={role}
              onSelectRevision={async (revId) => {
                const loaded = await apiClient.getRevision(role, revId);
                setActiveRevision(loaded);
                setMainSection('WORKSPACE');
              }}
              onCreateProject={handleCreateProjectFromExplorer}
              onDeleteProject={handleDeleteProject}
              onDeleteRevision={handleDeleteRevision}
            />
          ) : mainSection === 'MASTER_DATA' ? (
            <MasterDataManager
              role={role}
              customers={customers}
              quotations={quotations}
              stepsMaster={stepsMaster}
              methodsMaster={methodsMaster}
              packingsMaster={packingsMaster}
              onReloadMasterData={() => loadAllData()}
            />
          ) : activeRevision ? (
            <>
              {validationErrors.length > 0 && (
                <div className="mb-5 rounded-xl border-2 border-red-400 bg-red-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-extrabold uppercase text-red-800">
                        ⚠️ Không thể Lưu Hồ Sơ vì còn {validationErrors.length}{' '}
                        mục bắt buộc đang để trống:
                      </h4>
                      <p className="mt-0.5 text-xs text-red-700">
                        Vui lòng chọn hoặc điền đầy đủ các mục được đánh dấu màu
                        vàng/đỏ bên dưới trước khi Lưu:
                      </p>
                      <ul className="mt-2 list-disc pl-5 space-y-1 text-xs font-semibold text-red-900">
                        {validationErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => setValidationErrors([])}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}

              {workspaceTab === 'CS' && (
                <CoatingScheduleEditor
                  revision={activeRevision}
                  customers={customers}
                  quotations={quotations}
                  stepsMaster={stepsMaster}
                  methodsMaster={methodsMaster}
                  onChangeRevision={(updated) => {
                    setActiveRevision(updated);
                    if (validationErrors.length > 0) {
                      setValidationErrors(validateRevisionBeforeSave(updated));
                    }
                  }}
                  onQuickCreateStepMaster={handleQuickCreateStepMaster}
                />
              )}

              {workspaceTab === 'CC' && canViewCost && liveCostSummary && (
                <CoatingCostTable
                  revision={activeRevision}
                  costSummary={liveCostSummary}
                />
              )}

              {workspaceTab === 'BOM' && liveBomSummary && (
                <BomSummaryView
                  revision={activeRevision}
                  bomSummary={liveBomSummary}
                  areaM2={areaM2}
                  role={role}
                  onChangeAreaM2={(newArea) => setAreaM2(newArea)}
                />
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* A4 Print / PDF Preview Modal */}
      {showPrintModal && activeRevision && (
        <PrintableSheetA4
          revision={activeRevision}
          costSummary={liveCostSummary}
          role={role}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* PostgreSQL User Authentication & Account Management Modal */}
      <UserAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        currentRole={role}
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setRole(user.role);
          setSaveToast(`Đã đăng nhập: ${user.fullName} (${user.role})`);
          setTimeout(() => setSaveToast(null), 2500);
        }}
        onLogout={() => {
          setCurrentUser(null);
          setSaveToast('Đã đăng xuất phiên JWT — Chuyển về chế độ RBAC Switcher!');
          setTimeout(() => setSaveToast(null), 2500);
        }}
      />
    </div>
  );
}

export default App;
