import React from 'react';
import {
  ProjectRevision,
  ScheduleStep,
  ScheduleStepItem,
  Customer,
  QuotationItem,
  ApplicationStepMaster,
  ApplicationMethod,
  parseCaInput
} from '@cscc/shared';
import {
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Copy,
  Lock,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  SearchableCombobox,
  ComboboxOption
} from '../common/SearchableCombobox';

interface CoatingScheduleEditorProps {
  revision: ProjectRevision;
  customers: Customer[];
  quotations: QuotationItem[];
  stepsMaster: ApplicationStepMaster[];
  methodsMaster: ApplicationMethod[];
  onChangeRevision: (updated: ProjectRevision) => void;
  onQuickCreateStepMaster?: (stepName: string) => Promise<void>;
}

export const CoatingScheduleEditor: React.FC<CoatingScheduleEditorProps> = ({
  revision,
  customers,
  quotations,
  stepsMaster,
  methodsMaster,
  onChangeRevision,
  onQuickCreateStepMaster
}) => {
  const isLocked =
    revision.status === 'LOCKED' || revision.status === 'APPROVED';
  const revCode = String(revision.revisionNo).padStart(2, '0');

  // UX/UI Scroll & Layout states
  const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(false);
  const [isTableViewportPinned, setIsTableViewportPinned] = React.useState(false);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = React.useState(false);
  const [scrollMetrics, setScrollMetrics] = React.useState({
    scrollLeft: 0,
    scrollWidth: 1000,
    clientWidth: 1000
  });

  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement>(null);
  const tableElRef = React.useRef<HTMLTableElement>(null);
  const isSyncingScrollRef = React.useRef(false);

  const measureTableOverflow = React.useCallback(() => {
    const container = tableScrollRef.current;
    const tableEl = tableElRef.current;
    if (!container || !tableEl) return;
    const clientWidth = container.clientWidth;
    const scrollWidth = Math.max(tableEl.scrollWidth, tableEl.offsetWidth);
    const overflows = scrollWidth > clientWidth + 2;
    setHasHorizontalOverflow(overflows);
    setScrollMetrics((prev) => ({
      scrollLeft: overflows ? container.scrollLeft : 0,
      scrollWidth,
      clientWidth
    }));
  }, []);

  React.useEffect(() => {
    measureTableOverflow();
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureTableOverflow())
        : null;
    if (ro) {
      if (tableScrollRef.current) ro.observe(tableScrollRef.current);
      if (tableElRef.current) ro.observe(tableElRef.current);
    }
    window.addEventListener('resize', measureTableOverflow);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureTableOverflow);
    };
  }, [measureTableOverflow, revision.steps.length]);

  const syncScrollPositions = React.useCallback(
    (source: 'table' | 'top' | 'bottom', left: number) => {
      if (isSyncingScrollRef.current) return;
      isSyncingScrollRef.current = true;

      if (source !== 'table' && tableScrollRef.current) {
        tableScrollRef.current.scrollLeft = left;
      }
      if (source !== 'top' && topScrollRef.current) {
        topScrollRef.current.scrollLeft = left;
      }
      if (source !== 'bottom' && bottomScrollRef.current) {
        bottomScrollRef.current.scrollLeft = left;
      }

      setScrollMetrics((prev) =>
        Math.abs(prev.scrollLeft - left) > 1 ? { ...prev, scrollLeft: left } : prev
      );

      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    },
    []
  );

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

  const scrollHorizontallyTo = (targetLeft: number) => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  // 1. Build Searchable Options for Customers (All 540 rows, prioritizing named customers & current customer)
  const customerOptions = React.useMemo<ComboboxOption[]>(() => {
    const list = customers.map((c) => ({
      value: c.customerId,
      label: c.shortName,
      sublabel: c.salesmanName
        ? `${c.customerName} • Sales: ${c.salesmanName}`
        : c.customerName,
      badge: c.customerId,
      badgeColor: (c.shortName !== c.customerName ? 'emerald' : 'slate') as
        | 'emerald'
        | 'slate',
      keywords: `${c.customerId} ${c.shortName} ${c.customerName} ${c.salesmanName || ''}`
    }));
    // Ensure active revision customer is always present even if custom
    if (
      revision.customer &&
      !list.some((o) => o.value === revision.customer.customerId)
    ) {
      list.unshift({
        value: revision.customer.customerId,
        label: revision.customer.shortName,
        sublabel: revision.customer.salesmanName
          ? `${revision.customer.customerName} • Sales: ${revision.customer.salesmanName}`
          : revision.customer.customerName,
        badge: revision.customer.customerId,
        badgeColor: 'emerald',
        keywords: `${revision.customer.customerId} ${revision.customer.shortName} ${revision.customer.customerName} ${revision.customer.salesmanName || ''}`
      });
    }
    return list;
  }, [customers, revision.customer]);

  // 2. Build Searchable Options for Application Steps
  const stepOptions = React.useMemo<ComboboxOption[]>(() => {
    const base = stepsMaster
      .filter((s) => s.stepName !== 'SANDING')
      .map((s) => ({
        value: s.stepName,
        label: s.stepName,
        badge: `Bước chuẩn #${s.sortOrder}`,
        badgeColor: 'blue' as const
      }));
    return base;
  }, [stepsMaster]);

  // 3. Build Searchable Options for Application Methods
  const methodOptions = React.useMemo<ComboboxOption[]>(
    () =>
      methodsMaster.map((m) => ({
        value: m.methodName,
        label: `${m.methodName} (${Math.round(m.efficiency * 100)}%)`,
        sublabel: `Hiệu suất thu hồi: ${Math.round(m.efficiency * 100)}%`,
        badge: `${Math.round(m.efficiency * 100)}%`,
        badgeColor: m.methodName === 'SPRAY' ? 'blue' : 'amber'
      })),
    [methodsMaster]
  );

  // 4. Build Searchable Options for Product Codes (Strictly restricted to the active customer's quotation)
  const productOptions = React.useMemo<ComboboxOption[]>(() => {
    const custCode = (revision.customer?.customerId || '').trim();
    if (!custCode) return [];

    const seenCodes = new Set<string>();
    const options: ComboboxOption[] = [];

    for (const q of quotations) {
      if (
        q.sapCustomerCode.trim() === custCode &&
        !seenCodes.has(q.materialCode)
      ) {
        seenCodes.add(q.materialCode);
        const displayName = q.materialName || q.materialCode;
        options.push({
          value: q.materialCode,
          label: displayName,
          sublabel:
            q.materialName && q.materialName !== q.materialCode
              ? q.materialCode
              : undefined,
          badge: 'Báo giá KH',
          badgeColor: 'emerald',
          keywords: `${q.materialCode} ${q.materialName || ''}`
        });
      }
    }

    return options;
  }, [quotations, revision.customer?.customerId]);

  const reindexSteps = (rawSteps: ScheduleStep[]): ScheduleStep[] => {
    let chemNo = 1;
    return rawSteps.map((s, idx) => {
      const isSanding = s.rowType === 'SANDING';
      const parsedCa = isSanding
        ? { caMin: null, caMax: null, caAvg: 0 }
        : parseCaInput(s.caInputRaw);
      const eff =
        isSanding || !s.methodName
          ? null
          : methodsMaster.find((m) => m.methodName === s.methodName)?.efficiency ??
            s.efficiencySnapshot ??
            null;
      const stepVisco = isSanding
        ? null
        : s.visco !== null && s.visco !== undefined && String(s.visco).trim() !== ''
          ? String(s.visco).trim()
          : s.items?.[0]?.visco !== null &&
              s.items?.[0]?.visco !== undefined &&
              String(s.items[0].visco).trim() !== ''
            ? String(s.items[0].visco).trim()
            : null;

      return {
        ...s,
        stepOrder: idx + 1,
        stepNumber: isSanding ? null : chemNo++,
        visco: stepVisco,
        caMin: parsedCa.caMin,
        caMax: parsedCa.caMax,
        caAvg: isSanding ? null : parsedCa.caAvg,
        efficiencySnapshot: eff,
        items: s.items.map((it, iIdx) => ({
          ...it,
          visco:
            it.visco !== null && it.visco !== undefined && String(it.visco).trim() !== ''
              ? String(it.visco).trim()
              : iIdx === 0
                ? stepVisco
                : it.visco ?? null,
          itemOrder: iIdx + 1
        }))
      };
    });
  };

  const handleHeaderChange = (
    field: keyof ProjectRevision,
    value: string | number
  ) => {
    if (isLocked) return;
    onChangeRevision({
      ...revision,
      [field]: value
    });
  };

  const handleCustomerSelect = (customerId: string) => {
    if (isLocked) return;
    const found = customers.find(
      (c) => c.id === customerId || c.customerId === customerId
    );
    if (!found) return;

    const updatedSteps = revision.steps.map((step) => ({
      ...step,
      items: step.items.map((item) => {
        const q = quotations.find(
          (quot) =>
            quot.sapCustomerCode === found.customerId &&
            quot.materialCode === item.materialCode
        );
        return {
          ...item,
          materialName: q?.materialName ?? item.materialName,
          priceSnapshotVnd: q ? q.priceUnitVnd : item.priceSnapshotVnd,
          packingDesc: q?.packingDesc ?? item.packingDesc,
          nettWeight: q?.nett ?? item.nettWeight
        };
      })
    }));

    onChangeRevision({
      ...revision,
      customer: found,
      steps: reindexSteps(updatedSteps)
    });
  };

  const createNewChemicalStepObject = (): ScheduleStep => {
    const stepId = `step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

    return {
      id: stepId,
      stepOrder: revision.steps.length + 1,
      stepNumber: 1,
      rowType: 'CHEMICAL_STEP',
      stepName: '',
      sandingSpec: null,
      visco: null,
      caInputRaw: '',
      caMin: null,
      caMax: null,
      caAvg: 0,
      methodName: '',
      efficiencySnapshot: null,
      dryingTime: '',
      stepRemark: null,
      items: [
        {
          id: `${stepId}-item-1`,
          stepId,
          itemOrder: 1,
          materialCode: '',
          materialName: '',
          packingDesc: null,
          nettWeight: null,
          mixingRatio: 0,
          visco: null,
          priceSnapshotVnd: 0
        }
      ]
    };
  };

  const createNewSandingStepObject = (): ScheduleStep => ({
    id: `sanding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    stepOrder: revision.steps.length + 1,
    stepNumber: null,
    rowType: 'SANDING',
    stepName: 'SANDING',
    sandingSpec: '',
    caInputRaw: null,
    caMin: null,
    caMax: null,
    caAvg: null,
    methodName: null,
    efficiencySnapshot: null,
    dryingTime: null,
    stepRemark: null,
    items: []
  });

  // Insert step at end OR immediately after `afterIndex`
  const handleInsertChemicalStep = (afterIndex?: number) => {
    if (isLocked) return;
    const newStep = createNewChemicalStepObject();
    const nextSteps = [...revision.steps];
    if (afterIndex !== undefined && afterIndex >= 0) {
      nextSteps.splice(afterIndex + 1, 0, newStep);
    } else {
      nextSteps.push(newStep);
    }
    onChangeRevision({
      ...revision,
      steps: reindexSteps(nextSteps)
    });
  };

  const handleInsertSandingRow = (afterIndex?: number) => {
    if (isLocked) return;
    const sandingStep = createNewSandingStepObject();
    const nextSteps = [...revision.steps];
    if (afterIndex !== undefined && afterIndex >= 0) {
      nextSteps.splice(afterIndex + 1, 0, sandingStep);
    } else {
      nextSteps.push(sandingStep);
    }
    onChangeRevision({
      ...revision,
      steps: reindexSteps(nextSteps)
    });
  };

  const handleDuplicateStep = (index: number) => {
    if (isLocked) return;
    const source = revision.steps[index];
    if (!source) return;
    const newStepId = `step-dup-${Date.now().toString(36)}`;
    const duplicated: ScheduleStep = {
      ...source,
      id: newStepId,
      items: source.items.map((it, idx) => ({
        ...it,
        id: `${newStepId}-item-${idx + 1}`,
        stepId: newStepId
      }))
    };
    const nextSteps = [...revision.steps];
    nextSteps.splice(index + 1, 0, duplicated);
    onChangeRevision({
      ...revision,
      steps: reindexSteps(nextSteps)
    });
  };

  const handleMoveStep = (index: number, direction: -1 | 1) => {
    if (isLocked) return;
    const target = index + direction;
    if (target < 0 || target >= revision.steps.length) return;
    const cloned = [...revision.steps];
    const [removed] = cloned.splice(index, 1);
    cloned.splice(target, 0, removed);
    onChangeRevision({
      ...revision,
      steps: reindexSteps(cloned)
    });
  };

  const handleDeleteStep = (stepId: string) => {
    if (isLocked) return;
    onChangeRevision({
      ...revision,
      steps: reindexSteps(revision.steps.filter((s) => s.id !== stepId))
    });
  };

  const handleUpdateStepField = (
    stepId: string,
    field: keyof ScheduleStep,
    value: string | null
  ) => {
    if (isLocked) return;
    const updated = revision.steps.map((step) => {
      if (step.id !== stepId) return step;
      return {
        ...step,
        [field]: value
      };
    });
    onChangeRevision({
      ...revision,
      steps: reindexSteps(updated)
    });
  };

  const handleUpdateStepVisco = (stepId: string, val: string | null) => {
    if (isLocked) return;
    const cleanVal = val !== null && val.trim() !== '' ? val.trim() : null;
    const updated = revision.steps.map((step) => {
      if (step.id !== stepId) return step;
      return {
        ...step,
        visco: cleanVal,
        items: step.items.map((it, idx) => ({
          ...it,
          visco: idx === 0 ? cleanVal : it.visco
        }))
      };
    });
    onChangeRevision({
      ...revision,
      steps: reindexSteps(updated)
    });
  };

  const handleAddItemToStep = (stepId: string) => {
    if (isLocked) return;
    const updated = revision.steps.map((step) => {
      if (step.id !== stepId) return step;
      const newItem: ScheduleStepItem = {
        id: `${step.id}-item-${Date.now().toString(36)}`,
        stepId: step.id,
        itemOrder: step.items.length + 1,
        materialCode: '',
        materialName: '',
        packingDesc: null,
        nettWeight: null,
        mixingRatio: 0,
        visco: null,
        priceSnapshotVnd: 0
      };
      return {
        ...step,
        items: [...step.items, newItem]
      };
    });
    onChangeRevision({
      ...revision,
      steps: reindexSteps(updated)
    });
  };

  const handleDeleteItemFromStep = (stepId: string, itemId: string) => {
    if (isLocked) return;
    const updated = revision.steps.map((step) => {
      if (step.id !== stepId) return step;
      if (step.items.length <= 1) return step;
      return {
        ...step,
        items: step.items.filter((i) => i.id !== itemId)
      };
    });
    onChangeRevision({
      ...revision,
      steps: reindexSteps(updated)
    });
  };

  const handleUpdateItem = (
    stepId: string,
    itemId: string,
    patch: Partial<ScheduleStepItem>
  ) => {
    if (isLocked) return;
    const updated = revision.steps.map((step) => {
      if (step.id !== stepId) return step;
      return {
        ...step,
        items: step.items.map((item) => {
          if (item.id !== itemId) return item;
          const next = { ...item, ...patch };
          if (patch.materialCode !== undefined) {
            const codeTrimmed = patch.materialCode.trim();
            const custCode = (revision.customer?.customerId || '').trim();
            const matchedQuot = quotations.find(
              (q) =>
                q.sapCustomerCode.trim() === custCode &&
                q.materialCode.trim() === codeTrimmed
            );
            if (matchedQuot) {
              next.materialName = matchedQuot.materialName;
              next.packingDesc = matchedQuot.packingDesc;
              next.nettWeight = matchedQuot.nett;
              next.priceSnapshotVnd = matchedQuot.priceUnitVnd;
            }
          }
          return next;
        })
      };
    });
    onChangeRevision({
      ...revision,
      steps: reindexSteps(updated)
    });
  };

  return (
    <div className="space-y-5">
      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Phiên bản <strong>Rev {revCode}</strong> đã được phê duyệt (
            <strong>APPROVED</strong>). Để chỉnh sửa quy trình hoặc cập nhật đơn
            giá mới, hãy nhấn <strong>"Nhân bản sang Rev mới"</strong> trên
            thanh công cụ hoặc chuyển trạng thái về Draft.
          </span>
        </div>
      )}

      {/* 1. HEADER METADATA FORM (COLLAPSIBLE TO SAVE VERTICAL SCREEN SPACE) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-4 py-2.5 text-white rounded-t-xl">
          <div>
            <h2 className="text-sm md:text-base font-bold tracking-wide uppercase">
              COATING SCHEDULE (CS) / BẢNG LẬP LỊCH QUY TRÌNH SƠN
            </h2>
            <p className="text-[11px] text-slate-300">
              Auto real-time sync to CC & BOM / Mọi thay đổi tại đây tự động đồng bộ sang Coating Cost (CC) & BOM Summary
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-blue-600/30 border border-blue-400/40 px-2.5 py-1 font-semibold">
              SAP Cust ID / Mã SAP: {revision.customer.customerId}
            </span>
            <span
              className={`rounded border px-2.5 py-1 font-semibold ${
                isLocked
                  ? 'border-emerald-400/40 bg-emerald-600/30 text-emerald-200'
                  : 'border-amber-400/40 bg-amber-600/30 text-amber-200'
              }`}
            >
              Rev. / Phiên bản: {revCode} ({revision.status === 'LOCKED' || revision.status === 'APPROVED' ? 'APPROVED / ĐÃ PHÊ DUYỆT' : revision.status})
            </span>
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-100 hover:bg-slate-700 hover:text-white transition"
              title={
                isHeaderCollapsed
                  ? 'Expand Header / Mở rộng thông tin chung'
                  : 'Collapse Header / Thu gọn thông tin chung'
              }
            >
              {isHeaderCollapsed ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-blue-400" />
                  <span>Expand / Mở rộng thông tin</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-slate-300" />
                  <span>Collapse / Thu gọn thông tin</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isHeaderCollapsed ? (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2 text-xs text-slate-700 rounded-b-xl">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong className="text-slate-500">Customer / KH:</strong>{' '}
                <strong className="text-slate-900">
                  {revision.customer?.shortName || '—'}
                </strong>
                {revision.customer?.salesmanName && (
                  <span className="ml-1 text-slate-600">
                    ({revision.customer.salesmanName})
                  </span>
                )}
              </span>
              <span>
                <strong className="text-slate-500">Product / Sản phẩm:</strong>{' '}
                <strong className="text-slate-900">
                  {revision.productName || '—'}
                </strong>
              </span>
              <span>
                <strong className="text-slate-500">Color / Màu:</strong>{' '}
                <strong className="text-slate-900">
                  {revision.colorName || '—'}
                </strong>
              </span>
              <span>
                <strong className="text-slate-500">Substrate / Gỗ:</strong>{' '}
                <strong className="text-slate-900">
                  {revision.substrate || '—'}
                </strong>
              </span>
              <span>
                <strong className="text-slate-500">System / Hệ sơn:</strong>{' '}
                <strong className="text-slate-900">
                  {revision.finishingSystem || '—'}
                </strong>
              </span>
              <span>
                <strong className="text-slate-500">No. / Mã HS:</strong>{' '}
                <strong className="text-blue-700">
                  {revision.projectCode || '—'}
                </strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed(false)}
              className="text-[11px] font-bold text-blue-600 hover:underline"
            >
              Edit Header / Chỉnh sửa thông tin
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            {/* Column 1 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Customer / Khách hàng (Search name or SAP ID / Tìm tên hoặc mã SAP)
                </label>
                <SearchableCombobox
                  disabled={isLocked}
                  value={revision.customer?.customerId || ''}
                  placeholder="-- Select Customer / Chọn Khách hàng --"
                  options={customerOptions}
                  onChange={(val) => handleCustomerSelect(val)}
                  searchPlaceholder="Search customer name or SAP code / Tìm tên KH hoặc mã SAP..."
                  popoverWidthClass="w-96"
                />
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                  {revision.customer?.customerName || 'No customer selected / Chưa chọn khách hàng'}
                  {revision.customer?.salesmanName && (
                    <span className="ml-2 font-semibold text-blue-700">
                      • Salesman: {revision.customer.salesmanName}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Product Item / Tên sản phẩm
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="Enter product name / Nhập tên sản phẩm..."
                  value={revision.productName}
                  onChange={(e) =>
                    handleHeaderChange('productName', e.target.value)
                  }
                  className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none disabled:bg-slate-100 ${
                    !revision.productName?.trim()
                      ? 'border-amber-400 bg-amber-50/60 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                      : 'border-slate-300 focus:border-blue-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Color / Màu sắc
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="Enter color / Nhập màu sắc..."
                  value={revision.colorName}
                  onChange={(e) =>
                    handleHeaderChange('colorName', e.target.value)
                  }
                  className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-medium focus:outline-none disabled:bg-slate-100 ${
                    !revision.colorName?.trim()
                      ? 'border-amber-400 bg-amber-50/60 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                      : 'border-slate-300 focus:border-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Column 2 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Substrate / Loại gỗ
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="Enter substrate / Nhập loại gỗ..."
                    value={revision.substrate}
                    onChange={(e) =>
                      handleHeaderChange('substrate', e.target.value)
                    }
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none disabled:bg-slate-100 ${
                      !revision.substrate?.trim()
                        ? 'border-amber-400 bg-amber-50/60 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Positioning / Vị trí áp dụng
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="e.g. Interior / Mid High"
                    value={revision.positioning}
                    onChange={(e) =>
                      handleHeaderChange('positioning', e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Finishing System / Hệ sơn
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="Enter system / Nhập hệ sơn..."
                    value={revision.finishingSystem}
                    onChange={(e) =>
                      handleHeaderChange('finishingSystem', e.target.value)
                    }
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none disabled:bg-slate-100 ${
                      !revision.finishingSystem?.trim()
                        ? 'border-amber-400 bg-amber-50/60 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Gloss Level / Độ bóng
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="e.g. 15±5 SHEEN"
                    value={revision.glossLevel}
                    onChange={(e) =>
                      handleHeaderChange('glossLevel', e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Reference / Tiêu chuẩn tham chiếu
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="Enter reference / Nhập tiêu chuẩn đối chiếu (nếu có)..."
                  value={revision.referenceStandard}
                  onChange={(e) =>
                    handleHeaderChange('referenceStandard', e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                />
              </div>
            </div>

            {/* Column 3 */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    No. / Mã hồ sơ
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="Enter code / Nhập mã hồ sơ..."
                    value={revision.projectCode}
                    onChange={(e) =>
                      handleHeaderChange('projectCode', e.target.value)
                    }
                    className={`mt-1 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold focus:outline-none disabled:bg-slate-100 ${
                      !revision.projectCode?.trim()
                        ? 'border-amber-400 bg-amber-50/60 placeholder:italic placeholder:text-amber-700 focus:border-blue-600'
                        : 'border-slate-300 focus:border-blue-600'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Date / Ngày lập
                  </label>
                  <input
                    type="date"
                    disabled={isLocked}
                    value={revision.scheduleDate}
                    onChange={(e) =>
                      handleHeaderChange('scheduleDate', e.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Finishing Conditions */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Finishing Condition / Điều kiện môi trường
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500">
                      MC Wood / Độ ẩm gỗ
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={revision.mcWood}
                      onChange={(e) =>
                        handleHeaderChange('mcWood', e.target.value)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500">
                      Humidity / Độ ẩm
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={revision.roomHumidity}
                      onChange={(e) =>
                        handleHeaderChange('roomHumidity', e.target.value)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500">
                      Room Temp / Nhiệt độ phòng
                    </label>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={revision.roomTemp}
                      onChange={(e) =>
                        handleHeaderChange('roomTemp', e.target.value)
                      }
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. DYNAMIC PROCESS TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 bg-slate-100 px-4 py-2.5 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-700 shrink-0" />
            <div>
              <h3 className="text-sm font-bold uppercase text-slate-800">
                Coating Process / Quy trình Thi công ({' '}
                {
                  revision.steps.filter((s) => s.rowType === 'CHEMICAL_STEP')
                    .length
                }{' '}
                Chemical Steps / Bước sơn,{' '}
                {revision.steps.filter((s) => s.rowType === 'SANDING').length}{' '}
                Sanding / Bước nhám)
              </h3>
              <p className="text-[11px] text-slate-500">
                Pinned columns & headers / Cột số thứ tự, thao tác và tiêu đề được ghim tự động khi cuộn.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle between Fixed Viewport Scroll vs Full Page Scroll */}
            <button
              type="button"
              onClick={() => setIsTableViewportPinned((prev) => !prev)}
              title={
                isTableViewportPinned
                  ? 'Pinned viewport active. Click to switch to Full Page / Đang ghim bảng trong khung cố định. Bấm để mở rộng toàn trang'
                  : 'Click to pin table in viewport / Bấm để ghim bảng trong khung màn hình cố định'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                isTableViewportPinned
                  ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isTableViewportPinned ? (
                <>
                  <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Full Page / Toàn trang</span>
                </>
              ) : (
                <>
                  <Minimize2 className="h-3.5 w-3.5 text-slate-600" />
                  <span>Pin Viewport / Ghim bảng</span>
                </>
              )}
            </button>

            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleInsertSandingRow()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  Insert SANDING / Chèn nhám
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertChemicalStep()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  + Add Step / + Thêm bước
                </button>
              </>
            )}
          </div>
        </div>

        {/* TOP SYNCED HORIZONTAL SCROLLBAR & QUICK PAN CONTROLS (Only visible when screen is narrower than table) */}
        {hasHorizontalOverflow && (
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
            <span className="text-[11px] font-bold text-slate-600 shrink-0">
              Quick Scroll / Cuộn ngang:
            </span>
            <button
              type="button"
              onClick={() => scrollHorizontallyTo(0)}
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              title="Về cột đầu tiên bên trái"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontallyBy(-220)}
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Left / Trái
            </button>

            <div
              ref={topScrollRef}
              onScroll={(e) =>
                syncScrollPositions('top', e.currentTarget.scrollLeft)
              }
              className="flex-1 overflow-x-auto overflow-y-hidden h-3.5 rounded bg-slate-200/70"
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
              className="inline-flex items-center gap-0.5 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Right / Phải
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                scrollHorizontallyTo(
                  scrollMetrics.scrollWidth - scrollMetrics.clientWidth
                )
              }
              disabled={
                scrollMetrics.scrollLeft + scrollMetrics.clientWidth >=
                scrollMetrics.scrollWidth - 2
              }
              className="inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              title="Tới cột cuối cùng bên phải"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* MAIN TABLE CONTAINER */}
        <div
          ref={tableScrollRef}
          onScroll={(e) =>
            syncScrollPositions('table', e.currentTarget.scrollLeft)
          }
          className={
            isTableViewportPinned
              ? 'max-h-[calc(100vh-200px)] overflow-auto'
              : hasHorizontalOverflow
                ? 'overflow-x-auto'
                : 'overflow-visible'
          }
        >
          <table
            ref={tableElRef}
            className="w-full border-collapse text-left text-xs"
          >
            <thead
              className={
                isTableViewportPinned
                  ? 'sticky top-0 z-20 shadow-sm'
                  : !hasHorizontalOverflow
                    ? 'sticky top-[57px] z-20 shadow-sm'
                    : ''
              }
            >
              <tr className="bg-slate-800 text-white uppercase tracking-wider text-[10px]">
                <th className="sticky left-0 z-20 bg-slate-800 border border-slate-700 px-1.5 py-2.5 text-center w-12">
                  No. / STT
                </th>
                <th className="border border-slate-700 px-2 py-2.5 min-w-[140px] w-[16%]">
                  Application Step / Bước thi công
                </th>
                <th className="border border-slate-700 px-2 py-2.5 min-w-[195px] w-[25%]">
                  Product Name / Tên sản phẩm
                </th>
                <th className="border border-slate-700 px-1.5 py-2.5 text-center w-[74px] min-w-[68px]">
                  Mixing Ratio / Tỉ lệ
                </th>
                <th className="border border-slate-700 px-1.5 py-2.5 text-center w-[60px] min-w-[56px]">
                  Visco / Độ nhớt
                </th>
                <th className="border border-slate-700 px-1.5 py-2.5 text-center w-[92px] min-w-[86px]">
                  CA / Lượng sơn (g/m²)
                </th>
                <th className="border border-slate-700 px-2 py-2.5 text-center min-w-[125px] w-[13%]">
                  Application Method / Phương pháp
                </th>
                <th className="border border-slate-700 px-2 py-2.5 text-center min-w-[96px] w-[11%]">
                  Drying Time / TG khô
                </th>
                <th className="sticky right-0 z-20 bg-slate-800 border border-slate-700 px-1.5 py-2.5 text-center w-[116px] min-w-[110px] shadow-[-4px_0_8px_rgba(0,0,0,0.18)]">
                  Actions / Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {revision.steps.map((step, stepIdx) => {
                // Case A: Interleaved SANDING row (matching Excel CS layout)
                if (step.rowType === 'SANDING') {
                  return (
                    <tr
                      key={step.id}
                      className="bg-amber-50/90 hover:bg-amber-100/80 transition border-b border-slate-200"
                    >
                      <td className="sticky left-0 z-10 bg-amber-50 border border-slate-200 px-1.5 py-2 text-center font-bold text-amber-700">
                        —
                      </td>
                      <td className="border border-slate-200 px-2 py-2 font-bold text-amber-900">
                        SANDING / CHÀ NHÁM
                      </td>
                      <td
                        colSpan={4}
                        className="border border-slate-200 px-2 py-1.5 text-slate-400 italic"
                      />
                      <td
                        colSpan={2}
                        className="border border-slate-200 px-2 py-1.5"
                      >
                        <input
                          type="text"
                          disabled={isLocked}
                          value={step.sandingSpec || ''}
                          placeholder="Enter sanding spec (VD: SANDING PAPER #180-240)..."
                          onChange={(e) =>
                            handleUpdateStepField(
                              step.id,
                              'sandingSpec',
                              e.target.value
                            )
                          }
                          className={`w-full rounded border px-2 py-1 text-center text-xs font-semibold italic focus:outline-none ${
                            !step.sandingSpec?.trim()
                              ? 'border-red-400 bg-red-50/70 text-red-900 placeholder:text-red-500 focus:border-red-600'
                              : 'border-amber-300 bg-white text-amber-950 focus:border-amber-600'
                          }`}
                        />
                      </td>
                      <td className="sticky right-0 z-10 bg-amber-50 border border-slate-200 px-1.5 py-1.5 text-center shadow-[-4px_0_8px_rgba(0,0,0,0.04)]">
                        {!isLocked && (
                          <div className="flex flex-wrap items-center justify-center gap-0.5">
                            <button
                              type="button"
                              title="Chèn bước sơn ngay bên dưới hàng nhám này / Insert chemical step below"
                              onClick={() => handleInsertChemicalStep(stepIdx)}
                              className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                            >
                              <Plus className="h-3 w-3" />
                              + Step / + Bước
                            </button>
                            <button
                              type="button"
                              title="Di chuyển lên / Move up"
                              onClick={() => handleMoveStep(stepIdx, -1)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-200"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Di chuyển xuống / Move down"
                              onClick={() => handleMoveStep(stepIdx, 1)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-200"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Xóa hàng nhám / Delete sanding row"
                              onClick={() => handleDeleteStep(step.id)}
                              className="rounded p-1 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }

                // Case B: Multi-row CHEMICAL_STEP with Dynamic rowSpan
                const rowSpan = Math.max(1, step.items.length);
                const parsedCa = parseCaInput(step.caInputRaw);

                return step.items.map((item, itemIdx) => {
                  const isFirstRow = itemIdx === 0;
                  const isLastRow = itemIdx === step.items.length - 1;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/30 transition border-b border-slate-200"
                    >
                      {/* Col 1: No. (Merged via rowSpan & Sticky Left) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="sticky left-0 z-10 border border-slate-300 bg-slate-50 px-1.5 py-2 text-center align-middle font-bold text-slate-800 text-xs"
                        >
                          {step.stepNumber}
                        </td>
                      )}

                      {/* Col 2: Application Step Name ONLY (Clean, searchable, supports Quick Create) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/60 px-2 py-2 align-middle"
                        >
                          <SearchableCombobox
                            compact
                            disabled={isLocked}
                            value={step.stepName || ''}
                            placeholder="-- Select Step / Chọn bước --"
                            options={stepOptions}
                            onChange={(val) =>
                              handleUpdateStepField(step.id, 'stepName', val)
                            }
                            onCreateNew={async (customStepName) => {
                              const upper = customStepName.toUpperCase();
                              if (onQuickCreateStepMaster) {
                                await onQuickCreateStepMaster(upper);
                              }
                              handleUpdateStepField(step.id, 'stepName', upper);
                            }}
                            createNewLabel={(val) =>
                              `+ New Step / Tạo bước "${val.toUpperCase()}"`
                            }
                            searchPlaceholder="Search or create step / Tìm hoặc tạo bước mới..."
                            popoverWidthClass="w-72"
                          />
                        </td>
                      )}

                      {/* Col 3: Product Name ONLY (Clean name without packing, + Contextual "Thêm vật tư" on last row) */}
                      <td className="border border-slate-200 px-2 py-1.5 align-middle">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-[155px]">
                            <SearchableCombobox
                              compact
                              monoLabel
                              disabled={isLocked}
                              value={item.materialCode || ''}
                              displayValue={item.materialName || item.materialCode || ''}
                              placeholder="-- Select Material / Chọn mã vật tư --"
                              options={productOptions}
                              onChange={(val, opt) =>
                                handleUpdateItem(step.id, item.id, {
                                  materialCode: val,
                                  materialName: opt?.label || val
                                })
                              }
                              emptyMessage={`Customer ${revision.customer?.shortName || revision.customer?.customerId || ''} has no quotation items / KH chưa có vật tư trong báo giá`}
                              searchPlaceholder="Search material in quotation / Tìm vật tư trong báo giá..."
                              popoverWidthClass="w-96"
                            />
                          </div>
                          {!isLocked && rowSpan > 1 && (
                            <button
                              type="button"
                              title="Delete material item / Xóa dòng vật tư này"
                              onClick={() =>
                                handleDeleteItemFromStep(step.id, item.id)
                              }
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {!isLocked && isLastRow && (
                          <div className="mt-1">
                            <button
                              type="button"
                              onClick={() => handleAddItemToStep(step.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-dashed border-blue-400 bg-blue-50/80 px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition"
                            >
                              <Plus className="h-3 w-3" />
                              + Add Item / + Thêm vật tư (Step {step.stepNumber} — {rowSpan})
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Col 4: Mixing Ratio */}
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center align-middle">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          disabled={isLocked}
                          placeholder="Ratio / Tỷ lệ"
                          value={
                            item.mixingRatio && item.mixingRatio > 0
                              ? item.mixingRatio
                              : ''
                          }
                          onChange={(e) =>
                            handleUpdateItem(step.id, item.id, {
                              mixingRatio:
                                e.target.value === ''
                                  ? 0
                                  : parseFloat(e.target.value) || 0
                            })
                          }
                          className={`w-full min-w-[52px] rounded border px-1.5 py-1 text-center font-semibold focus:outline-none ${
                            !item.mixingRatio || item.mixingRatio <= 0
                              ? 'border-amber-400 bg-amber-50/60 text-amber-900 placeholder:italic placeholder:font-normal placeholder:text-amber-700 focus:border-blue-600'
                              : 'border-slate-300 bg-white text-slate-900 focus:border-blue-600'
                          }`}
                        />
                      </td>

                      {/* Col 5: Visco (one value per step, merged via rowSpan; stored on step and items) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/50 px-1.5 py-2 text-center align-middle"
                        >
                          <input
                            type="text"
                            disabled={isLocked}
                            placeholder="-"
                            value={step.visco ?? item.visco ?? ''}
                            onChange={(e) =>
                              handleUpdateStepVisco(step.id, e.target.value)
                            }
                            className="w-full min-w-[44px] rounded border border-slate-200 bg-white px-1 py-1 text-center text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                          />
                        </td>
                      )}

                      {/* Col 6: CA (g/m²) Range Input (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/50 px-1.5 py-2 text-center align-middle"
                        >
                          <input
                            type="text"
                            disabled={isLocked}
                            placeholder="100-120"
                            value={step.caInputRaw || ''}
                            onChange={(e) =>
                              handleUpdateStepField(
                                step.id,
                                'caInputRaw',
                                e.target.value
                              )
                            }
                            className={`w-full min-w-[72px] rounded border px-1.5 py-1 text-center font-semibold focus:outline-none ${
                              !step.caInputRaw?.trim()
                                ? 'border-amber-400 bg-amber-50/60 text-amber-900 placeholder:italic placeholder:font-normal placeholder:text-amber-700 focus:border-blue-600'
                                : 'border-slate-300 bg-white text-slate-900 focus:border-blue-600'
                            }`}
                          />
                          <div className="mt-1 text-[10px] leading-tight font-medium text-emerald-700">
                            Avg to CC / TB sang CC: <strong>{parsedCa.caAvg} g/m²</strong>
                          </div>
                        </td>
                      )}

                      {/* Col 7: Application Method (Searchable Combobox, Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/50 px-1.5 py-2 text-center align-middle"
                        >
                          <SearchableCombobox
                            compact
                            disabled={isLocked}
                            value={step.methodName || ''}
                            placeholder="-- Method / Phương pháp --"
                            options={methodOptions}
                            onChange={(val) =>
                              handleUpdateStepField(step.id, 'methodName', val)
                            }
                            searchPlaceholder="Select method / Chọn phương pháp..."
                            popoverWidthClass="w-60"
                            align="right"
                          />
                        </td>
                      )}

                      {/* Col 8: Drying Time (Merged via rowSpan) */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="border border-slate-300 bg-slate-50/50 px-1.5 py-2 text-center align-middle"
                        >
                          <input
                            type="text"
                            disabled={isLocked}
                            placeholder="Drying time / TG khô..."
                            value={step.dryingTime || ''}
                            onChange={(e) =>
                              handleUpdateStepField(
                                step.id,
                                'dryingTime',
                                e.target.value
                              )
                            }
                            className={`w-full min-w-[78px] rounded border px-1.5 py-1 text-center text-xs font-medium focus:outline-none ${
                              !step.dryingTime?.trim()
                                ? 'border-amber-400 bg-amber-50/60 text-amber-900 placeholder:italic placeholder:font-normal placeholder:text-amber-700 focus:border-blue-600'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-blue-600'
                            }`}
                          />
                        </td>
                      )}

                      {/* Col 9: Step Actions — Sticky Right so action buttons are always reachable */}
                      {isFirstRow && (
                        <td
                          rowSpan={rowSpan}
                          className="sticky right-0 z-10 border border-slate-300 bg-slate-50 px-1.5 py-2 text-center align-middle shadow-[-4px_0_8px_rgba(0,0,0,0.04)]"
                        >
                          {!isLocked && (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  title="Chèn thêm 1 bước sơn mới ngay bên dưới bước này / Insert step below"
                                  onClick={() =>
                                    handleInsertChemicalStep(stepIdx)
                                  }
                                  className="inline-flex items-center gap-0.5 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                  + Step / + Bước
                                </button>
                                <button
                                  type="button"
                                  title="Chèn hàng chà nhám (SANDING) ngay bên dưới bước này / Insert sanding below"
                                  onClick={() =>
                                    handleInsertSandingRow(stepIdx)
                                  }
                                  className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100"
                                >
                                  + Nhám
                                </button>
                              </div>

                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  title="Nhân bản bước thi công này xuống ngay bên dưới / Duplicate step"
                                  onClick={() => handleDuplicateStep(stepIdx)}
                                  className="rounded p-1 text-slate-600 hover:bg-slate-200"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Di chuyển bước lên / Move up"
                                  onClick={() => handleMoveStep(stepIdx, -1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Di chuyển bước xuống / Move down"
                                  onClick={() => handleMoveStep(stepIdx, 1)}
                                  className="rounded p-1 text-slate-500 hover:bg-slate-200"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Xóa toàn bộ bước này / Delete step"
                                  onClick={() => handleDeleteStep(step.id)}
                                  className="rounded p-1 text-red-600 hover:bg-red-100"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>

        {/* FLOATING STICKY BOTTOM HORIZONTAL SCROLLBAR (Always pinned to bottom of screen when table overflows horizontally) */}
        {hasHorizontalOverflow && !isTableViewportPinned && (
          <div className="sticky bottom-0 z-30 flex items-center gap-2 border-t border-blue-200 bg-slate-900/95 px-3 py-2 text-white shadow-[0_-4px_12px_rgba(0,0,0,0.15)] backdrop-blur">
            <span className="text-[11px] font-bold text-blue-300 shrink-0">
              Floating Scroll / Cuộn ngang nổi:
            </span>
            <button
              type="button"
              onClick={() => scrollHorizontallyTo(0)}
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center rounded bg-slate-800 px-1.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              title="Về cột đầu tiên bên trái"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => scrollHorizontallyBy(-220)}
              disabled={scrollMetrics.scrollLeft <= 2}
              className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Left / Trái
            </button>

            <div
              ref={bottomScrollRef}
              onScroll={(e) =>
                syncScrollPositions('bottom', e.currentTarget.scrollLeft)
              }
              className="flex-1 overflow-x-auto overflow-y-hidden h-4 rounded bg-slate-700"
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
              className="inline-flex items-center gap-0.5 rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            >
              Right / Phải
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                scrollHorizontallyTo(
                  scrollMetrics.scrollWidth - scrollMetrics.clientWidth
                )
              }
              disabled={
                scrollMetrics.scrollLeft + scrollMetrics.clientWidth >=
                scrollMetrics.scrollWidth - 2
              }
              className="inline-flex items-center rounded bg-slate-800 px-1.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              title="Tới cột cuối cùng bên phải"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* BOTTOM QUICK-INSERT BAR (Cho phép thêm bước ngay khi cuộn xuống cuối bảng) */}
        {!isLocked && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-blue-50/40 px-5 py-3">
            <span className="text-xs font-semibold text-slate-600">
              Quick Actions / Thao tác nhanh cuối bảng:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleInsertSandingRow()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Insert SANDING / Chèn nhám vào cuối
              </button>
              <button
                type="button"
                onClick={() => handleInsertChemicalStep()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="h-4 w-4" />
                + Add Next Step / + Thêm bước sơn tiếp theo (Bước{' '}
                {revision.steps.filter((s) => s.rowType === 'CHEMICAL_STEP')
                  .length + 1}
                )
              </button>
            </div>
          </div>
        )}

        {/* 3. FOOTER SIGNATURE NAMES */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 rounded-b-xl">
          <div className="mb-2 text-xs font-bold uppercase text-slate-600">
            Approval & Signature / Thông tin Phê duyệt & Chữ ký (Printed on A4 & Excel / Hiển thị trên A4 & Excel)
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                CUSTOMER / KHÁCH HÀNG (Xác nhận)
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={revision.customerConfirmName || ''}
                onChange={(e) =>
                  handleHeaderChange('customerConfirmName', e.target.value)
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                APPROVED BY / PHÊ DUYỆT (PD/PM)
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={revision.approvedByPdPm || ''}
                onChange={(e) =>
                  handleHeaderChange('approvedByPdPm', e.target.value)
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                PREPARED BY / NGƯỜI LẬP (TA — Kỹ thuật viên)
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={revision.preparedByTa || ''}
                onChange={(e) =>
                  handleHeaderChange('preparedByTa', e.target.value)
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500">
                CHECKED BY / NGƯỜI KIỂM TRA (PROJECT LEADER)
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={revision.checkedByLeader || ''}
                onChange={(e) =>
                  handleHeaderChange('checkedByLeader', e.target.value)
                }
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
