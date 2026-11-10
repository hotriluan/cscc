import React from 'react';
import {
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  PackingMapping,
  Project,
  ProjectRevision,
  RevisionStatus,
  RevisionStatusHistoryEntry,
  UserRole,
  UserAccount,
  ReportSubTab,
  calculateCoatingCostTable,
  calculateBomSummary,
  formatVnd,
  parseCaInput
} from '@cscc/shared';
import { apiClient, getStoredAuthToken, setStoredAuthToken } from './api/client';
import {
   CoatingScheduleEditor,
  RevisionChangeMode
} from './components/schedule/CoatingScheduleEditor';
import { CoatingCostTable } from './components/cost/CoatingCostTable';
import { BomSummaryView } from './components/bom/BomSummaryView';
import { MasterDataManager, MasterSubTab } from './components/master/MasterDataManager';
import { ProjectExplorerView } from './components/projects/ProjectExplorerView';
import { ReportsAnalyticsView } from './components/reports/ReportsAnalyticsView';
import { PrintableSheetA4 } from './components/print/PrintableSheetA4';
import { UserAuthModal } from './components/auth/UserAuthModal';
import { LoginPage } from './components/auth/LoginPage';
import { AdminBackupView } from './components/backup/AdminBackupView';
import logoWeb from './assets/logo_web.png';
import {
  ClipboardList,
  Calculator,
  Boxes,
  Database,
  HardDrive,
  FolderKanban,
  BarChart3,
  Shield,
  Save,
  Copy,
  Lock,
  Unlock,
  FileEdit,
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
  LogOut,
  KeyRound,
  History,
  PauseCircle,
  RotateCcw,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export type MainSection = 'WORKSPACE' | 'PROJECTS' | 'REPORTS' | 'MASTER_DATA' | 'BACKUP';
export type WorkspaceTab = 'CS' | 'CC' | 'BOM';
export type AutoSaveStatus = 'IDLE' | 'PENDING' | 'SAVING' | 'SAVED' | 'ERROR';

function computeRevisionSignature(rev: ProjectRevision, area: number): string {
  return JSON.stringify({
    id: rev.id,
    customerId: rev.customer?.id || rev.customer?.customerId || '',
    projectCode: rev.projectCode || '',
    scheduleDate: rev.scheduleDate || '',
    productName: rev.productName || '',
    colorName: rev.colorName || '',
    substrate: rev.substrate || '',
    positioning: rev.positioning || '',
    finishingSystem: rev.finishingSystem || '',
    glossLevel: rev.glossLevel || '',
    referenceStandard: rev.referenceStandard || '',
    mcWood: rev.mcWood || '',
    roomHumidity: rev.roomHumidity || '',
    roomTemp: rev.roomTemp || '',
    lineSpeed: rev.lineSpeed ?? null,
    dryingCondition: rev.dryingCondition ?? null,
    remark: rev.remark ?? null,
    defaultAreaM2: Number(area) || 100,
    preparedByTa: rev.preparedByTa ?? null,
    checkedByLeader: rev.checkedByLeader ?? null,
    approvedByPdPm: rev.approvedByPdPm ?? null,
    customerConfirmName: rev.customerConfirmName ?? null,
    steps: (rev.steps || []).map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      stepNumber: s.stepNumber,
      rowType: s.rowType,
      stepName: s.stepName || '',
      sandingSpec: s.sandingSpec ?? null,
      visco: s.visco ?? null,
      caInputRaw: s.caInputRaw ?? null,
      methodName: s.methodName ?? null,
      efficiencySnapshot: s.efficiencySnapshot ?? null,
      dryingTime: s.dryingTime ?? null,
      stepRemark: s.stepRemark ?? null,
      items: (s.items || []).map((it) => ({
        id: it.id,
        itemOrder: it.itemOrder,
        materialCode: it.materialCode || '',
        materialName: it.materialName || '',
        packingDesc: it.packingDesc ?? null,
        nettWeight: it.nettWeight ?? null,
        mixingRatio: Number(it.mixingRatio) || 0,
        visco: it.visco ?? null,
        priceSnapshotVnd: it.priceSnapshotVnd ?? 0
      }))
    }))
  });
}

interface NavState {
  section: MainSection;
  tab: WorkspaceTab;
  subTab: MasterSubTab;
  reportTab: ReportSubTab;
  revId: string | null;
}

const NAV_STATE_KEY = 'cscc_nav_state';

function parseNavState(): NavState {
  let section: MainSection = 'WORKSPACE';
  let tab: WorkspaceTab = 'CS';
  let subTab: MasterSubTab = 'CUSTOMERS';
  let reportTab: ReportSubTab = 'PRODUCT_USAGE';
  let revId: string | null = null;

  // 1. URL search params have highest priority
  try {
    const params = new URLSearchParams(window.location.search);
    const pSection = params.get('section')?.toUpperCase();
    if (
      pSection === 'WORKSPACE' ||
      pSection === 'PROJECTS' ||
      pSection === 'REPORTS' ||
      pSection === 'MASTER_DATA' ||
      pSection === 'BACKUP'
    ) {
      section = pSection;
    }
    const pTab = params.get('tab')?.toUpperCase();
    if (pTab === 'CS' || pTab === 'CC' || pTab === 'BOM') {
      tab = pTab;
    }
    const pSubTab = params.get('subTab')?.toUpperCase();
    if (
      pSubTab === 'CUSTOMERS' ||
      pSubTab === 'QUOTATIONS' ||
      pSubTab === 'STEPS' ||
      pSubTab === 'METHODS' ||
      pSubTab === 'PACKINGS' ||
      pSubTab === 'USERS'
    ) {
      subTab = pSubTab;
    }
    const pReportTab = params.get('reportTab')?.toUpperCase();
    if (
      pReportTab === 'PRODUCT_USAGE' ||
      pReportTab === 'CUSTOMER_PORTFOLIO' ||
      pReportTab === 'REVISION_VARIANCE' ||
      pReportTab === 'PRICE_DRIFT' ||
      pReportTab === 'STEP_BENCHMARK' ||
      pReportTab === 'BOM_FORECAST' ||
      pReportTab === 'ACTIVITY_FUNNEL'
    ) {
      reportTab = pReportTab;
    }
    const pRev = params.get('rev');
    if (pRev) {
      revId = pRev;
    }
  } catch (err) {
    console.error('Failed to parse URL search params:', err);
  }

  // 2. Fall back to localStorage for any missing fields if no URL params were present
  try {
    const storedRaw = localStorage.getItem(NAV_STATE_KEY);
    if (storedRaw) {
      const stored = JSON.parse(storedRaw);
      const hasUrlParams = window.location.search && window.location.search.length > 1;
      if (!hasUrlParams) {
        if (
          stored.section === 'WORKSPACE' ||
          stored.section === 'PROJECTS' ||
          stored.section === 'REPORTS' ||
          stored.section === 'MASTER_DATA' ||
          stored.section === 'BACKUP'
        ) {
          section = stored.section;
        }
        if (stored.tab === 'CS' || stored.tab === 'CC' || stored.tab === 'BOM') {
          tab = stored.tab;
        }
        if (
          stored.subTab === 'CUSTOMERS' ||
          stored.subTab === 'QUOTATIONS' ||
          stored.subTab === 'STEPS' ||
          stored.subTab === 'METHODS' ||
          stored.subTab === 'PACKINGS'
        ) {
          subTab = stored.subTab;
        }
        if (
          stored.reportTab === 'PRODUCT_USAGE' ||
          stored.reportTab === 'CUSTOMER_PORTFOLIO' ||
          stored.reportTab === 'REVISION_VARIANCE' ||
          stored.reportTab === 'PRICE_DRIFT' ||
          stored.reportTab === 'STEP_BENCHMARK' ||
          stored.reportTab === 'BOM_FORECAST' ||
          stored.reportTab === 'ACTIVITY_FUNNEL'
        ) {
          reportTab = stored.reportTab;
        }
        if (typeof stored.revId === 'string' && stored.revId) {
          revId = stored.revId;
        }
      }
    }
  } catch (err) {
    console.error('Failed to parse localStorage nav state:', err);
  }

  return { section, tab, subTab, reportTab, revId };
}

export function App() {
  const initialNav = React.useMemo(() => parseNavState(), []);

  const [currentUser, setCurrentUser] = React.useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = React.useState<boolean>(() =>
    Boolean(getStoredAuthToken())
  );
  const role: UserRole = currentUser?.role ?? 'TECHNICAL';
  const [showAuthModal, setShowAuthModal] = React.useState<boolean>(false);
  const [mainSection, setMainSection] = React.useState<MainSection>(initialNav.section);
  const [workspaceTab, setWorkspaceTab] = React.useState<WorkspaceTab>(initialNav.tab);
  const [masterSubTab, setMasterSubTab] = React.useState<MasterSubTab>(initialNav.subTab);
  const [reportSubTab, setReportSubTab] = React.useState<ReportSubTab>(initialNav.reportTab);

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
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<AutoSaveStatus>('IDLE');
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [autoSaveError, setAutoSaveError] = React.useState<string | null>(null);
  const [saveToast, setSaveToast] = React.useState<string | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);
  const [showPrintModal, setShowPrintModal] = React.useState<boolean>(false);

  // Refs for Hybrid Auto-Save Engine & Single-Flight Queue
  const lastSavedSignatureRef = React.useRef<string>('');
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSavePromiseRef = React.useRef<Promise<void> | null>(null);
  const queuedSaveRef = React.useRef<{ rev: ProjectRevision; area: number } | null>(null);
  const latestRevisionRef = React.useRef<ProjectRevision | null>(null);
  const latestAreaRef = React.useRef<number>(1);
  latestRevisionRef.current = activeRevision;
  latestAreaRef.current = areaM2;

  // Status Change Modal & Status History Modal states
  const [statusModalTarget, setStatusModalTarget] =
    React.useState<RevisionStatus | null>(null);
  const [statusReasonNote, setStatusReasonNote] = React.useState<string>('');
  const [statusChangeError, setStatusChangeError] = React.useState<string | null>(
    null
  );
  const [changingStatus, setChangingStatus] = React.useState<boolean>(false);

  const [showStatusHistoryModal, setShowStatusHistoryModal] =
    React.useState<boolean>(false);
  const [statusHistoryItems, setStatusHistoryItems] = React.useState<
    RevisionStatusHistoryEntry[]
  >([]);
  const [loadingStatusHistory, setLoadingStatusHistory] =
    React.useState<boolean>(false);

  // Restore JWT session from PostgreSQL User table if token is present in localStorage
  React.useEffect(() => {
    const token = getStoredAuthToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    apiClient
      .getMe()
      .then((res) => {
        setCurrentUser(res.user);
      })
      .catch(() => {
        setStoredAuthToken(null);
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  // Enforce RBAC: if user switches to TECHNICAL while viewing CC tab, redirect immediately to CS
  React.useEffect(() => {
    if (role === 'TECHNICAL' && workspaceTab === 'CC') {
      setWorkspaceTab('CS');
    }
    if (role !== 'ADMIN' && mainSection === 'BACKUP') {
      setMainSection('WORKSPACE');
    }
  }, [role, workspaceTab, mainSection]);

  // Keep URL search params and localStorage in sync with user navigation
  React.useEffect(() => {
    try {
      localStorage.setItem(
        NAV_STATE_KEY,
        JSON.stringify({
          section: mainSection,
          tab: workspaceTab,
          subTab: masterSubTab,
          reportTab: reportSubTab,
          revId: activeRevision?.id || null
        })
      );
    } catch {
      // ignore storage errors
    }

    try {
      const params = new URLSearchParams();
      params.set('section', mainSection);
      if (mainSection === 'WORKSPACE') {
        params.set('tab', workspaceTab);
        if (activeRevision?.id) {
          params.set('rev', activeRevision.id);
        }
      } else if (mainSection === 'REPORTS') {
        params.set('reportTab', reportSubTab);
      } else if (mainSection === 'MASTER_DATA') {
        params.set('subTab', masterSubTab);
      }

      const newQuery = params.toString();
      const currentQuery = window.location.search.replace(/^\?/, '');
      if (newQuery !== currentQuery) {
        window.history.replaceState(null, '', `${window.location.pathname}?${newQuery}`);
      }
    } catch (err) {
      console.error('Failed to sync nav state to URL:', err);
    }
  }, [mainSection, workspaceTab, masterSubTab, reportSubTab, activeRevision?.id]);

  const enrichRevisionItemNames = React.useCallback(
    (rev: ProjectRevision, quots: QuotationItem[]): ProjectRevision => {
      const custCode = (rev.customer?.customerId || '').trim();
      return {
        ...rev,
        steps: rev.steps.map((s) => ({
          ...s,
          items: s.items.map((it) => {
            const code = (it.materialCode || '').trim();
            if (!code || (it.materialName && it.materialName.trim() !== code)) {
              return it;
            }
            const matched =
              quots.find(
                (q) =>
                  q.sapCustomerCode.trim() === custCode &&
                  q.materialCode.trim() === code
              ) ?? quots.find((q) => q.materialCode.trim() === code);
            return matched?.materialName
              ? { ...it, materialName: matched.materialName }
              : it;
          })
        }))
      };
    },
    []
  );

  const syncLoadedRevisionState = React.useCallback(
    (rev: ProjectRevision, quots: QuotationItem[]) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      queuedSaveRef.current = null;
      const enriched = enrichRevisionItemNames(rev, quots);
      const area =
        enriched.defaultAreaM2 && enriched.defaultAreaM2 > 0
          ? enriched.defaultAreaM2
          : 1;
      latestRevisionRef.current = enriched;
      latestAreaRef.current = area;
      lastSavedSignatureRef.current = computeRevisionSignature(enriched, area);
      setActiveRevision(enriched);
      setAreaM2(area);
      setAutoSaveStatus('IDLE');
      setAutoSaveError(null);
      setValidationErrors([]);
    },
    [enrichRevisionItemNames]
  );

  // Handle browser Back / Forward buttons (popstate)
  React.useEffect(() => {
    const handlePopState = () => {
      const nav = parseNavState();
      setMainSection(nav.section);
      setWorkspaceTab(nav.tab);
      setMasterSubTab(nav.subTab);
      setReportSubTab(nav.reportTab);
      if (nav.revId && nav.revId !== activeRevision?.id) {
        apiClient
          .getRevision(role, nav.revId)
          .then((rev) => syncLoadedRevisionState(rev, quotations))
          .catch(() => {});
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [role, quotations, syncLoadedRevisionState, activeRevision?.id]);

  const loadAllData = React.useCallback(
    async (targetRevisionId?: string, isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }
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
          targetRevisionId || activeRevision?.id || initialNav.revId || fallbackRevId;

        if (revIdToLoad) {
          const rev = await apiClient
            .getRevision(role, revIdToLoad)
            .catch(() => apiClient.getRevision(role, fallbackRevId));
          syncLoadedRevisionState(rev, quots);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    },
    [role, activeRevision?.id, syncLoadedRevisionState, initialNav.revId]
  );

  const reloadMasterData = React.useCallback(async () => {
    try {
      const [custs, quots, steps, methods, packings] = await Promise.all([
        apiClient.getCustomers(role),
        apiClient.getQuotations(role, '', '', 10000),
        apiClient.getStepsMaster(role),
        apiClient.getMethodsMaster(role),
        apiClient.getPackingsMaster(role)
      ]);
      setCustomers(custs);
      setQuotations(quots);
      setStepsMaster(steps);
      setMethodsMaster(methods);
      setPackingsMaster(packings);
    } catch (err) {
      console.error('Failed to reload master data:', err);
    }
  }, [role]);

  React.useEffect(() => {
    if (!currentUser) return;
    loadAllData(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, role]);

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

  // Filter projects in Sidebar by sidebarProjectSearch & Salesman isolation
  const filteredSidebarProjects = React.useMemo(() => {
    const isRestricted =
      (role === 'SALES' || role === 'TECHNICAL') &&
      currentUser?.salesmanName &&
      currentUser.salesmanName.trim() !== '';
    const assignedSalesman = isRestricted ? currentUser!.salesmanName!.trim().toLowerCase() : null;

    const base = assignedSalesman
      ? projects.filter(
          (p) =>
            p.customer.salesmanName &&
            p.customer.salesmanName.trim().toLowerCase() === assignedSalesman
        )
      : projects;

    const q = sidebarProjectSearch.toLowerCase().trim();
    if (!q) return base;
    return base.filter((p) => {
      const revText = p.revisions
        .map((r) => `${r.productName} ${r.colorName} ${r.substrate || ''}`)
        .join(' ');
      const hay =
        `${p.projectCode} ${p.customer.shortName} ${p.customer.customerId} ${p.customer.salesmanName || ''} ${revText}`.toLowerCase();
      return hay.includes(q);
    });
  }, [projects, sidebarProjectSearch, role, currentUser]);

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
                `${stepLabel} (Vật tư dòng ${itemIdx + 1}): Chưa chọn Tên vật tư (Product Name)`
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

  const isCustomerOutOfScopeForRevision = React.useCallback(
    (rev: ProjectRevision | null): boolean => {
      if (!rev) return false;
      const isRestricted =
        (role === 'SALES' || role === 'TECHNICAL') &&
        currentUser?.salesmanName &&
        currentUser.salesmanName.trim() !== '';
      if (!isRestricted) return false;
      const assigned = currentUser!.salesmanName!.trim().toLowerCase();
      return Boolean(
        rev.customer?.salesmanName &&
          rev.customer.salesmanName.trim().toLowerCase() !== assigned
      );
    },
    [role, currentUser]
  );

  // Core Single-Flight Auto-Save Execution + Local Sidebar State Patching
  const performAutoSave = React.useCallback(
    async (revToSave: ProjectRevision | null, areaToSave: number): Promise<void> => {
      if (
        !revToSave ||
        revToSave.status === 'LOCKED' ||
        revToSave.status === 'APPROVED' ||
        revToSave.status === 'INACTIVE' ||
        isCustomerOutOfScopeForRevision(revToSave)
      ) {
        return;
      }

      const candidateSignature = computeRevisionSignature(revToSave, areaToSave);
      if (candidateSignature === lastSavedSignatureRef.current) {
        setAutoSaveStatus((prev) => (prev === 'PENDING' ? 'SAVED' : prev));
        return;
      }

      // Single-Flight Queue: if a request is already in-flight, coalesce into queuedSaveRef
      if (inFlightSavePromiseRef.current) {
        queuedSaveRef.current = { rev: revToSave, area: areaToSave };
        return inFlightSavePromiseRef.current;
      }

      const runSaveLoop = async (initialRev: ProjectRevision, initialArea: number) => {
        let currentRev: ProjectRevision | null = initialRev;
        let currentArea = initialArea;

        while (currentRev) {
          const sig = computeRevisionSignature(currentRev, currentArea);
          if (sig === lastSavedSignatureRef.current) {
            setAutoSaveStatus('SAVED');
            break;
          }

          setAutoSaveStatus('SAVING');
          setAutoSaveError(null);
          const savingRev = currentRev;
          const savingArea = currentArea;

          try {
            const res = await apiClient.updateRevision(role, savingRev.id, {
              ...savingRev,
              customerId: savingRev.customer.id,
              defaultAreaM2: savingArea
            });

            lastSavedSignatureRef.current = sig;
            const nowStr = new Date().toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            setLastSavedAt(nowStr);
            setAutoSaveStatus(queuedSaveRef.current ? 'SAVING' : 'SAVED');

            // Patch Sidebar `projects` state directly in RAM without calling GET /api/projects
            const savedChemCount = (res.revision.steps || []).filter(
              (s) => s.rowType === 'CHEMICAL_STEP'
            ).length;
            const savedCostDisplay =
              role === 'TECHNICAL'
                ? null
                : res.costSummary?.totalCoatingCostDisplay ??
                  calculateCoatingCostTable(res.revision.id, res.revision.steps)
                    .totalCoatingCostDisplay;

            setProjects((prevProjects) =>
              prevProjects.map((proj) => {
                if (proj.id !== res.revision.projectId) return proj;
                return {
                  ...proj,
                  projectCode: res.revision.projectCode || proj.projectCode,
                  customerId: res.revision.customer?.id || proj.customerId,
                  customer: res.revision.customer || proj.customer,
                  updatedAt: res.revision.updatedAt,
                  revisions: proj.revisions.map((r) =>
                    r.id === res.revision.id
                      ? {
                          ...r,
                          scheduleDate: res.revision.scheduleDate,
                          productName: res.revision.productName,
                          colorName: res.revision.colorName,
                          substrate: res.revision.substrate,
                          finishingSystem: res.revision.finishingSystem,
                          stepCount: savedChemCount,
                          totalCoatingCostDisplay: savedCostDisplay,
                          updatedAt: res.revision.updatedAt
                        }
                      : r
                  )
                };
              })
            );
          } catch (err) {
            setAutoSaveStatus('ERROR');
            setAutoSaveError(err instanceof Error ? err.message : String(err));
            break;
          }

          if (queuedSaveRef.current) {
            const nextQueued = queuedSaveRef.current;
            queuedSaveRef.current = null;
            currentRev = nextQueued.rev;
            currentArea = nextQueued.area;
          } else {
            currentRev = null;
          }
        }
      };

      const promise = runSaveLoop(revToSave, areaToSave).finally(() => {
        inFlightSavePromiseRef.current = null;
      });
      inFlightSavePromiseRef.current = promise;
      return promise;
    },
    [role, isCustomerOutOfScopeForRevision]
  );

  // Schedule Hybrid Auto-Save: 300ms for discrete actions, 800ms for typing
  const scheduleAutoSave = React.useCallback(
    (
      updatedRev: ProjectRevision,
      updatedArea: number,
      mode: RevisionChangeMode = 'typing'
    ) => {
      if (
        updatedRev.status === 'LOCKED' ||
        updatedRev.status === 'APPROVED' ||
        updatedRev.status === 'INACTIVE' ||
        isCustomerOutOfScopeForRevision(updatedRev)
      ) {
        return;
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const nextSig = computeRevisionSignature(updatedRev, updatedArea);
      if (nextSig === lastSavedSignatureRef.current && !inFlightSavePromiseRef.current) {
        return;
      }

      setAutoSaveStatus((prev) => (prev === 'SAVING' ? 'SAVING' : 'PENDING'));
      setAutoSaveError(null);

      const delayMs = mode === 'discrete' ? 300 : 800;
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveTimerRef.current = null;
        void performAutoSave(latestRevisionRef.current, latestAreaRef.current);
      }, delayMs);
    },
    [performAutoSave, isCustomerOutOfScopeForRevision]
  );

  // Immediately flush any pending changes (0ms) — onBlur, Ctrl+S, before switching Rev / Clone / Approve
  const flushAutoSave = React.useCallback(async (): Promise<void> => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const rev = latestRevisionRef.current;
    const area = latestAreaRef.current;
    if (!rev) return;
    await performAutoSave(rev, area);
  }, [performAutoSave]);

  // Global keyboard shortcut: Ctrl+S / Cmd+S in WORKSPACE flushes auto-save immediately
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (mainSection === 'WORKSPACE' && latestRevisionRef.current) {
          e.preventDefault();
          void flushAutoSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mainSection, flushAutoSave]);

  const handleSelectRevision = React.useCallback(
    async (revId: string) => {
      await flushAutoSave();
      const loaded = await apiClient.getRevision(role, revId);
      syncLoadedRevisionState(loaded, quotations);
      setMainSection('WORKSPACE');
    },
    [flushAutoSave, role, quotations, syncLoadedRevisionState]
  );

  const handleCloneRevision = async () => {
    if (!activeRevision) return;
    await flushAutoSave();
    setValidationErrors([]);
    const cloned = await apiClient.cloneRevision(role, activeRevision.id, true);
    await loadAllData(cloned.id);
    setSaveToast(
      `Đã nhân bản thành công sang Rev ${String(cloned.revisionNo).padStart(2, '0')}!`
    );
    setTimeout(() => setSaveToast(null), 2500);
  };

  const canChangeStatus = role === 'PROJECT_LEADER' || role === 'ADMIN';

  const handleOpenStatusChangeModal = async (targetStatus: RevisionStatus) => {
    if (!activeRevision || !canChangeStatus) return;

    await flushAutoSave();
    const currentRev = latestRevisionRef.current || activeRevision;

    if (targetStatus === 'APPROVED' && currentRev.status === 'DRAFT') {
      const missingErrors = validateRevisionBeforeSave(currentRev);
      if (missingErrors.length > 0) {
        setValidationErrors(missingErrors);
        setMainSection('WORKSPACE');
        setWorkspaceTab('CS');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setValidationErrors([]);
    }

    setStatusModalTarget(targetStatus);
    setStatusReasonNote('');
    setStatusChangeError(null);
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRevision || !statusModalTarget) return;

    const cleanNote = statusReasonNote.trim();
    if (!cleanNote) {
      setStatusChangeError(
        'Reason is required to change revision status / Vui lòng nhập lý do thay đổi trạng thái hồ sơ.'
      );
      return;
    }

    setChangingStatus(true);
    setStatusChangeError(null);
    try {
      const updated = await apiClient.updateRevisionStatus(
        role,
        activeRevision.id,
        statusModalTarget,
        cleanNote
      );
      syncLoadedRevisionState(updated, quotations);
      const projs = await apiClient.getProjects(role);
      setProjects(projs);
      setStatusModalTarget(null);
      setStatusReasonNote('');

      const toastMsg =
        statusModalTarget === 'APPROVED'
          ? 'Revision Approved (Active) / Hồ sơ đã được Phê duyệt (APPROVED) & chốt dữ liệu!'
          : statusModalTarget === 'INACTIVE'
            ? 'Revision set to Inactive / Đã chuyển hồ sơ sang trạng thái Ngưng hiệu lực (INACTIVE)!'
            : 'Revision reopened as Draft / Đã mở lại hồ sơ về trạng thái Bản nháp (DRAFT)!';
      setSaveToast(toastMsg);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      setStatusChangeError(err instanceof Error ? err.message : String(err));
    } finally {
      setChangingStatus(false);
    }
  };

  const handleOpenStatusHistoryModal = async () => {
    if (!activeRevision) return;
    setShowStatusHistoryModal(true);
    setLoadingStatusHistory(true);
    try {
      const list = await apiClient.getRevisionStatusHistory(role, activeRevision.id);
      setStatusHistoryItems(list);
    } catch (err) {
      console.error('Failed to load status history:', err);
      setStatusHistoryItems(activeRevision.statusHistory || []);
    } finally {
      setLoadingStatusHistory(false);
    }
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

  const handleLogoutSession = React.useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    queuedSaveRef.current = null;
    setStoredAuthToken(null);
    setCurrentUser(null);
    setActiveRevision(null);
    setProjects([]);
    setShowAuthModal(false);
  }, []);

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-xs font-bold tracking-wider uppercase">
        Đang kiểm tra phiên đăng nhập... / Verifying session...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onAuthenticated={(user) => {
          setCurrentUser(user);
          setSaveToast(`Xin chào ${user.fullName} (${user.role})!`);
          setTimeout(() => setSaveToast(null), 2500);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 print:min-h-0 print:block print:bg-white">
      {/* ===================================================================
          LEFT SIDEBAR (COLLAPSIBLE / SHOW-HIDE FULL SIDEBAR + SUB-SECTIONS)
         =================================================================== */}
      {isSidebarOpen && (
        <aside className="no-print sticky top-0 h-screen w-72 shrink-0 bg-slate-950 text-slate-100 flex flex-col justify-between border-r border-slate-800 overflow-hidden transition-all duration-200">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Brand Logo + Collapse Sidebar Button */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow">
                  <img
                    src={logoWeb}
                    alt="Alkana Logo"
                    className="h-full w-full object-contain"
                  />
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

            {/* Authenticated User Session Card — Collapsible */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-2.5">
              <button
                type="button"
                onClick={() => setShowRbacSection((prev) => !prev)}
                className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Tài khoản đang đăng nhập
                </span>
                {showRbacSection ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                )}
              </button>

              {showRbacSection && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-950/90 p-2.5 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 text-xs font-extrabold text-white leading-snug break-words">
                        <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" />
                        <span>{currentUser.fullName}</span>
                      </div>
                      <span className="shrink-0 rounded bg-emerald-950/90 border border-emerald-700/60 px-2 py-0.5 font-mono text-[10px] font-extrabold text-emerald-300">
                        {currentUser.role}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 break-all pl-5">
                      {currentUser.email}
                    </div>
                  </div>

                  {currentUser.salesmanName && (
                    <div className="rounded bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-amber-300 border border-slate-800 leading-snug break-words">
                      💼 Sales phụ trách: <strong className="text-amber-200">{currentUser.salesmanName}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(true)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-slate-800 px-2 py-1.5 text-[10px] font-bold text-slate-200 hover:bg-blue-600 hover:text-white transition"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>Đổi mật khẩu</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoutSession}
                      className="inline-flex items-center justify-center gap-1 rounded-md border border-red-900/60 bg-red-950/40 px-2 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-900/70 hover:text-white transition"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Navigation */}
            <nav className="space-y-1">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Main Menu / Menu Chính
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
                <span>Workspace / Qui Trình Sơn & Chi Phí</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await flushAutoSave();
                  setMainSection('PROJECTS');
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'PROJECTS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FolderKanban className="h-4 w-4 shrink-0" />
                  <span>Projects / Quản lý Hồ sơ Dự án</span>
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await flushAutoSave();
                  setMainSection('REPORTS');
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'REPORTS'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span>Reports & Analytics / Báo cáo & Phân tích</span>
                </span>
                <span className="rounded-full bg-emerald-900/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  7
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  await flushAutoSave();
                  setMainSection('MASTER_DATA');
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  mainSection === 'MASTER_DATA'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <Database className="h-4 w-4 shrink-0" />
                <span>Master Data / Quản trị Dữ liệu Gốc</span>
              </button>

              {role === 'ADMIN' && (
                <button
                  type="button"
                  onClick={async () => {
                    await flushAutoSave();
                    setMainSection('BACKUP');
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold transition ${
                    mainSection === 'BACKUP'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <HardDrive className="h-4 w-4 shrink-0" />
                    <span>Sao lưu & Phục hồi</span>
                  </span>
                  <span className="rounded bg-amber-900/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    ADMIN
                  </span>
                </button>
              )}
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
                                    await handleSelectRevision(latestRev.id);
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
                                  const isApproved =
                                    r.status === 'APPROVED' ||
                                    r.status === 'LOCKED';
                                  const isInactive = r.status === 'INACTIVE';
                                  const canDeleteRev =
                                    proj.revisions.length > 1 &&
                                    !isApproved &&
                                    !isInactive;
                                  return (
                                    <div
                                      key={r.id}
                                      className={`inline-flex items-center rounded text-[11px] font-bold transition ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white'
                                          : isInactive
                                            ? 'bg-amber-950/70 text-amber-300 border border-amber-700/50 hover:bg-amber-900/70'
                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        title={
                                          isApproved
                                            ? 'APPROVED / Đã duyệt - Đang hiệu lực'
                                            : isInactive
                                              ? 'INACTIVE / Đã duyệt - Hết hiệu lực'
                                              : 'DRAFT / Bản nháp'
                                        }
                                        onClick={async () => {
                                          await handleSelectRevision(r.id);
                                        }}
                                        className="px-2 py-0.5"
                                      >
                                        Rev {String(r.revisionNo).padStart(2, '0')}
                                        {r.status === 'APPROVED'
                                          ? ' ✅'
                                          : r.status === 'INACTIVE'
                                            ? ' ⏸️'
                                            : r.status === 'LOCKED'
                                              ? ' 🔒'
                                              : ''}
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
                      Tự động nhảy real-time khi sửa Qui Trình Sơn
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400">
                    Chỉ hiển thị thông số kỹ thuật Qui Trình Sơn.
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
      <main className="no-print flex-1 flex flex-col min-w-0">
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
                  1. Coating Schedule (CS) / Qui Trình Sơn
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
                    2. Coating Cost (CC) / Chi phí sơn{' '}
                    {liveCostSummary
                      ? `(${formatVnd(liveCostSummary.totalCoatingCostDisplay)} đ/m²)`
                      : ''}
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
                  3. BOM Summary / Dự toán định mức vật tư
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await flushAutoSave();
                    setMainSection('REPORTS');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100 transition"
                >
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  Reports / Báo cáo & Phân tích
                </button>
              </div>

              {/* Action Buttons: Save, Clone Rev, Lock, Export Excel, Print A4 */}
              <div className="flex flex-wrap items-center gap-2">
                {currentUser?.salesmanName && (role === 'SALES' || role === 'TECHNICAL') && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300">
                    💼 Sales: {currentUser.salesmanName}
                  </span>
                )}
                {saveToast && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {saveToast}
                  </span>
                )}

                {activeRevision.status === 'DRAFT' &&
                  !isCustomerOutOfScopeForRevision(activeRevision) && (
                    <>
                      {autoSaveStatus === 'PENDING' || autoSaveStatus === 'SAVING' ? (
                        <button
                          type="button"
                          onClick={() => void flushAutoSave()}
                          title="Changes are being auto-saved. Click or press Ctrl+S to flush immediately / Đang tự động lưu thay đổi (Bấm hoặc nhấn Ctrl+S để lưu ngay)"
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-sm"
                        >
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                          <span>Saving... / Đang tự động lưu...</span>
                        </button>
                      ) : autoSaveStatus === 'ERROR' ? (
                        <button
                          type="button"
                          onClick={() => void flushAutoSave()}
                          title={
                            autoSaveError
                              ? `Auto-save error: ${autoSaveError}. Click to retry.`
                              : 'Auto-save failed. Click to retry / Lỗi tự động lưu. Bấm để thử lại.'
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-sm"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                          <span>Save failed — Retry / Lỗi tự động lưu — Thử lại</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void flushAutoSave()}
                          title={
                            lastSavedAt
                              ? `All changes synced to PostgreSQL at ${lastSavedAt} (Ctrl+S) / Đã đồng bộ tự động lúc ${lastSavedAt}`
                              : 'Smart Auto-Save active (Ctrl+S) / Tự động lưu thông minh đang bật'
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100/80 transition"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span>
                            Auto-saved / Đã tự động lưu
                            {lastSavedAt ? ` (${lastSavedAt})` : ''}
                          </span>
                        </button>
                      )}
                    </>
                  )}

                <button
                  type="button"
                  onClick={handleCloneRevision}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5 text-blue-600" />
                  Clone Rev / Nhân bản Rev
                </button>

                {/* Status Badge & Status Workflow Controls (Only PROJECT_LEADER & ADMIN can change status) */}
                {!canChangeStatus ? (
                  <span
                    title="Technical (TA) & Sales accounts can view status only. Only Project Leader and Admin can change revision status. / Tài khoản Kỹ thuật & Kinh doanh chỉ xem trạng thái."
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold ${
                      activeRevision.status === 'APPROVED' ||
                      activeRevision.status === 'LOCKED'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : activeRevision.status === 'INACTIVE'
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-slate-300 bg-slate-100 text-slate-700'
                    }`}
                  >
                    {activeRevision.status === 'APPROVED' ||
                    activeRevision.status === 'LOCKED' ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        APPROVED / Đã duyệt (Đang hiệu lực)
                      </>
                    ) : activeRevision.status === 'INACTIVE' ? (
                      <>
                        <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                        INACTIVE / Đã duyệt (Hết hiệu lực)
                      </>
                    ) : (
                      <>
                        <FileEdit className="h-3.5 w-3.5 text-slate-600" />
                        DRAFT / Bản nháp
                      </>
                    )}
                  </span>
                ) : activeRevision.status === 'DRAFT' ? (
                  <button
                    type="button"
                    onClick={() => handleOpenStatusChangeModal('APPROVED')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve / Phê duyệt (APPROVED)
                  </button>
                ) : activeRevision.status === 'APPROVED' ||
                  activeRevision.status === 'LOCKED' ? (
                  <div className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-2 text-xs font-extrabold text-emerald-900">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      APPROVED / Đang hiệu lực
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenStatusChangeModal('INACTIVE')}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition"
                    >
                      <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                      Set Inactive / Ngưng hiệu lực
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenStatusChangeModal('DRAFT')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
                      Reopen Draft / Mở lại Draft
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-2 text-xs font-extrabold text-amber-900">
                      <PauseCircle className="h-3.5 w-3.5 text-amber-600" />
                      INACTIVE / Hết hiệu lực
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenStatusChangeModal('APPROVED')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Reactivate / Khôi phục hiệu lực
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenStatusChangeModal('DRAFT')}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-600" />
                      Reopen Draft / Mở lại Draft
                    </button>
                  </div>
                )}

                {/* Status History Button (Visible to all roles) */}
                <button
                  type="button"
                  onClick={handleOpenStatusHistoryModal}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  title="View Revision Status History / Xem lịch sử thay đổi trạng thái"
                >
                  <History className="h-3.5 w-3.5 text-indigo-600" />
                  <span>History / Lịch sử</span>
                  {activeRevision.statusHistory &&
                    activeRevision.statusHistory.length > 0 && (
                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-extrabold text-indigo-800">
                        {activeRevision.statusHistory.length}
                      </span>
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
                  Export Excel / Xuất Excel (.xlsx)
                </a>

                <button
                  type="button"
                  onClick={async () => {
                    await flushAutoSave();
                    setShowPrintModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print A4 - PDF / In A4 - Xuất PDF
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
                      ? 'Hide Sidebar / Ẩn thanh menu bên trái'
                      : 'Show Sidebar / Hiện thanh menu bên trái'
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
                      <span>Show Menu / Hiện Menu</span>
                    </>
                  )}
                </button>
                <div className="text-sm font-bold text-slate-800">
                  {mainSection === 'PROJECTS'
                    ? 'Projects Explorer / Quản lý & Tra cứu Hồ sơ Dự án'
                    : mainSection === 'REPORTS'
                      ? 'Reports & Analytics / Trung tâm Báo cáo & Phân tích Dữ liệu'
                      : mainSection === 'BACKUP'
                        ? 'Sao lưu & Phục hồi Hệ thống (ADMIN)'
                        : 'Master Data / Quản trị Cơ sở Dữ liệu Gốc'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentUser?.salesmanName && (role === 'SALES' || role === 'TECHNICAL') && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300">
                    💼 Sales: {currentUser.salesmanName}
                  </span>
                )}
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
                  Back to Workspace / Quay lại Qui Trình Sơn (CS/CC)
                </button>
              </div>
            </div>
          )}
        </header>

        {/* Main Content Body */}
        <div className="p-4 xl:p-6 flex-1 min-w-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm font-semibold text-slate-500">
              Loading system data / Đang tải dữ liệu hệ thống từ Form CS Industry.xlsx...
            </div>
          ) : mainSection === 'PROJECTS' ? (
            <ProjectExplorerView
              projects={projects}
              customers={customers}
              activeRevisionId={activeRevision?.id}
              role={role}
              currentUser={currentUser}
              onSelectRevision={handleSelectRevision}
              onCreateProject={handleCreateProjectFromExplorer}
              onDeleteProject={handleDeleteProject}
              onDeleteRevision={handleDeleteRevision}
            />
          ) : mainSection === 'REPORTS' ? (
            <ReportsAnalyticsView
              role={role}
              currentUser={currentUser}
              projects={projects}
              activeReportTab={reportSubTab}
              onChangeReportTab={setReportSubTab}
              onSelectRevision={handleSelectRevision}
            />
          ) : mainSection === 'MASTER_DATA' ? (
            <MasterDataManager
              role={role}
              currentUser={currentUser}
              customers={customers}
              quotations={quotations}
              stepsMaster={stepsMaster}
              methodsMaster={methodsMaster}
              packingsMaster={packingsMaster}
              activeSubTab={masterSubTab}
              onChangeSubTab={setMasterSubTab}
              onReloadMasterData={reloadMasterData}
            />
          ) : mainSection === 'BACKUP' && role === 'ADMIN' ? (
            <AdminBackupView />
          ) : activeRevision ? (
            <>
              {validationErrors.length > 0 && (
                <div className="mb-5 rounded-xl border-2 border-red-400 bg-red-50 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-extrabold uppercase text-red-800">
                        ⚠️ Cannot Approve Revision / Không thể Phê duyệt Hồ Sơ vì còn {validationErrors.length}{' '}
                        mục bắt buộc đang để trống:
                      </h4>
                      <p className="mt-0.5 text-xs text-red-700">
                        Please fill all highlighted fields before approving / Vui lòng điền đầy đủ các mục được đánh dấu trước khi Phê duyệt (APPROVED):
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
                  role={role}
                  currentUser={currentUser}
                  onChangeRevision={(updated, mode = 'typing') => {
                    latestRevisionRef.current = updated;
                    setActiveRevision(updated);
                    if (validationErrors.length > 0) {
                      setValidationErrors(validateRevisionBeforeSave(updated));
                    }
                    scheduleAutoSave(updated, latestAreaRef.current, mode);
                  }}
                  onFlushAutoSave={() => {
                    void flushAutoSave();
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
                  onChangeAreaM2={(newArea) => {
                    latestAreaRef.current = newArea;
                    setAreaM2(newArea);
                    if (latestRevisionRef.current) {
                      scheduleAutoSave(latestRevisionRef.current, newArea, 'typing');
                    }
                  }}
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
          initialMode={workspaceTab === 'CC' ? 'CC' : 'CS'}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Mandatory Reason Confirmation Modal for Revision Status Change */}
      {statusModalTarget && activeRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold uppercase text-slate-900">
                  Confirm Status Change / Xác nhận Thay đổi Trạng thái
                </h3>
                <p className="text-xs text-slate-500">
                  Project / Hồ sơ: <strong>{activeRevision.projectCode}</strong> — Rev{' '}
                  <strong>{String(activeRevision.revisionNo).padStart(2, '0')}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalTarget(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="mt-4 space-y-4">
              {/* Status Transition Banner */}
              <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold">
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 ${
                    activeRevision.status === 'APPROVED' ||
                    activeRevision.status === 'LOCKED'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                      : activeRevision.status === 'INACTIVE'
                        ? 'border-amber-300 bg-amber-100 text-amber-900'
                        : 'border-slate-300 bg-white text-slate-800'
                  }`}
                >
                  {activeRevision.status === 'APPROVED' ||
                  activeRevision.status === 'LOCKED'
                    ? 'APPROVED / Đã duyệt (Đang hiệu lực)'
                    : activeRevision.status === 'INACTIVE'
                      ? 'INACTIVE / Đã duyệt (Hết hiệu lực)'
                      : 'DRAFT / Bản nháp'}
                </span>
                <span className="text-slate-400 font-black">➔</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 ${
                    statusModalTarget === 'APPROVED'
                      ? 'border-emerald-500 bg-emerald-600 text-white'
                      : statusModalTarget === 'INACTIVE'
                        ? 'border-amber-500 bg-amber-500 text-white'
                        : 'border-blue-500 bg-blue-600 text-white'
                  }`}
                >
                  {statusModalTarget === 'APPROVED'
                    ? 'APPROVED / Đã duyệt (Đang hiệu lực)'
                    : statusModalTarget === 'INACTIVE'
                      ? 'INACTIVE / Ngưng hiệu lực'
                      : 'DRAFT / Bản nháp'}
                </span>
              </div>

              {/* Auto-supersede warning if approving */}
              {statusModalTarget === 'APPROVED' &&
                (() => {
                  const activeProj = projects.find(
                    (p) => p.id === activeRevision.projectId
                  );
                  const otherApprovedRevs =
                    activeProj?.revisions.filter(
                      (r) =>
                        r.id !== activeRevision.id &&
                        (r.status === 'APPROVED' || r.status === 'LOCKED')
                    ) || [];
                  if (otherApprovedRevs.length === 0) return null;
                  return (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-900">
                          Auto-Supersede Notice / Lưu ý Tự động chuyển INACTIVE:
                        </div>
                        <p className="mt-0.5 leading-relaxed">
                          Approving this revision will automatically set existing APPROVED
                          revision(s) (
                          <strong>
                            {otherApprovedRevs
                              .map(
                                (r) => `Rev ${String(r.revisionNo).padStart(2, '0')}`
                              )
                              .join(', ')}
                          </strong>
                          ) in project <strong>{activeRevision.projectCode}</strong> to{' '}
                          <strong>INACTIVE</strong> and log their audit history. / Khi phê
                          duyệt phiên bản này, các phiên bản đang APPROVED khác cùng dự án
                          sẽ tự động chuyển sang trạng thái{' '}
                          <strong>INACTIVE (Đã duyệt &amp; Không còn hiệu lực)</strong>.
                        </p>
                      </div>
                    </div>
                  );
                })()}

              {statusChangeError && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
                  ⚠️ {statusChangeError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Reason for Status Change / Lý do thay đổi trạng thái{' '}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  value={statusReasonNote}
                  onChange={(e) => setStatusReasonNote(e.target.value)}
                  placeholder="Enter mandatory reason (e.g. Approved for mass production, Superseded by customer color update, Reopened to adjust mixing ratio)... / Nhập lý do bắt buộc..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This reason will be permanently recorded in the Revision Status History /
                  Lý do này sẽ được lưu vĩnh viễn vào Lịch sử trạng thái của hồ sơ.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={changingStatus}
                  onClick={() => setStatusModalTarget(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel / Hủy
                </button>
                <button
                  type="submit"
                  disabled={changingStatus || !statusReasonNote.trim()}
                  className={`rounded-lg px-5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                    statusModalTarget === 'APPROVED'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : statusModalTarget === 'INACTIVE'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {changingStatus
                    ? 'Saving... / Đang xử lý...'
                    : 'Confirm Change / Xác nhận đổi trạng thái'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision Status History Timeline Modal */}
      {showStatusHistoryModal && activeRevision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold uppercase text-slate-900">
                    Revision Status History / Lịch sử Trạng thái Hồ sơ
                  </h3>
                  <p className="text-xs text-slate-500">
                    Project / Hồ sơ: <strong>{activeRevision.projectCode}</strong> — Rev{' '}
                    <strong>{String(activeRevision.revisionNo).padStart(2, '0')}</strong> (
                    {activeRevision.customer.shortName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStatusHistoryModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-3">
              {loadingStatusHistory ? (
                <div className="py-10 text-center text-xs font-semibold text-slate-500">
                  Loading status history... / Đang tải lịch sử trạng thái...
                </div>
              ) : statusHistoryItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
                  No status changes recorded yet for this revision. / Chưa có lịch sử thay
                  đổi trạng thái nào được ghi nhận cho phiên bản này.
                </div>
              ) : (
                statusHistoryItems.map((entry) => {
                  const dt = new Date(entry.changedAt);
                  const formattedTime = Number.isNaN(dt.getTime())
                    ? entry.changedAt
                    : dt.toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });

                  return (
                    <div
                      key={entry.id}
                      className={`rounded-xl border p-3.5 text-xs shadow-sm ${
                        entry.isAutoSupersede
                          ? 'border-amber-300 bg-amber-50/60'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700 border border-slate-300">
                            {entry.fromStatus || 'INITIAL'}
                          </span>
                          <span className="text-slate-400 font-black">➔</span>
                          <span
                            className={`rounded px-2 py-0.5 font-bold border ${
                              entry.toStatus === 'APPROVED' || entry.toStatus === 'LOCKED'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : entry.toStatus === 'INACTIVE'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                            }`}
                          >
                            {entry.toStatus}
                          </span>
                          {entry.isAutoSupersede && (
                            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold text-amber-950">
                              ⚡ Auto-supersede / Tự động thay thế
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          {formattedTime}
                        </span>
                      </div>

                      <div className="mt-2 text-slate-900 font-medium leading-relaxed">
                        <strong className="text-slate-600">Reason / Lý do:</strong>{' '}
                        {entry.note}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          Changed by / Thực hiện bởi:{' '}
                          <strong className="text-slate-800">{entry.changedByName}</strong>{' '}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {entry.changedByRole}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowStatusHistoryModal(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close / Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Account Profile & Change Password Modal */}
      <UserAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        currentRole={role}
        onLogout={handleLogoutSession}
      />
    </div>
  );
}

export default App;
