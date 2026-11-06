import {
  ProjectRevision,
  RevisionStatus,
  RevisionStatusHistoryEntry,
  UserRole
} from '@cscc/shared';
import { prisma } from '../store/prisma';
import { dataStore } from '../store/data-store';

export class RevisionStatusDomainError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'RevisionStatusDomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Clones an existing revision into a new `Rev XX` (e.g., `Rev 00` -> `Rev 01`) in PostgreSQL,
 * copying all steps and snapshotting current prices and application efficiencies.
 */
export async function cloneRevision(
  sourceRevisionId: string,
  refreshPricesFromMaster = true
): Promise<ProjectRevision> {
  const source = await dataStore.getRevisionById(sourceRevisionId);
  if (!source) {
    throw new Error(`Revision not found: ${sourceRevisionId}`);
  }

  const maxRevAgg = await prisma.projectRevision.aggregate({
    where: { projectId: source.projectId },
    _max: { revisionNo: true }
  });
  const nextRevNo = (maxRevAgg._max.revisionNo ?? 0) + 1;
  const newRevisionId = `rev-${source.projectId}-${String(nextRevNo).padStart(2, '0')}-${Date.now().toString(36)}`;
  const now = new Date();
  const nowIso = now.toISOString();

  const clonedSteps = source.steps.map((step, sIdx) => {
    const newStepId = `${newRevisionId}-step-${sIdx + 1}`;
    return {
      ...step,
      id: newStepId,
      items: step.items.map((item, iIdx) => ({
        ...item,
        id: `${newStepId}-item-${iIdx + 1}`,
        stepId: newStepId
      }))
    };
  });

  const enrichedSteps = await dataStore.enrichRevisionStepsWithMasterData(
    source.customer.customerId,
    clonedSteps,
    !refreshPricesFromMaster
  );

  await prisma.$transaction(async (tx) => {
    await tx.projectRevision.create({
      data: {
        id: newRevisionId,
        projectId: source.projectId,
        revisionNo: nextRevNo,
        status: 'DRAFT',
        scheduleDate: nowIso.slice(0, 10),
        productName: source.productName,
        colorName: source.colorName,
        substrate: source.substrate,
        positioning: source.positioning,
        finishingSystem: source.finishingSystem,
        glossLevel: source.glossLevel,
        referenceStandard: source.referenceStandard,
        mcWood: source.mcWood,
        roomHumidity: source.roomHumidity,
        roomTemp: source.roomTemp,
        lineSpeed: source.lineSpeed ?? null,
        dryingCondition: source.dryingCondition ?? null,
        remark: source.remark ?? null,
        defaultAreaM2: source.defaultAreaM2,
        preparedByTa: source.preparedByTa ?? null,
        checkedByLeader: source.checkedByLeader ?? null,
        approvedByPdPm: source.approvedByPdPm ?? null,
        customerConfirmName: source.customerConfirmName ?? null,
        createdAt: now,
        updatedAt: now
      }
    });

    if (enrichedSteps.length > 0) {
      await tx.scheduleStep.createMany({
        data: enrichedSteps.map((s) => ({
          id: s.id,
          revisionId: newRevisionId,
          stepOrder: s.stepOrder,
          stepNumber: s.stepNumber,
          rowType: s.rowType,
          stepName: s.stepName,
          sandingSpec: s.sandingSpec ?? null,
          visco: s.visco ? String(s.visco) : s.items?.[0]?.visco ? String(s.items[0].visco) : null,
          caInputRaw: s.caInputRaw ?? null,
          caMin: s.caMin ?? null,
          caMax: s.caMax ?? null,
          caAvg: s.caAvg ?? null,
          methodName: s.methodName ?? null,
          efficiencySnapshot: s.efficiencySnapshot ?? null,
          dryingTime: s.dryingTime ?? null,
          stepRemark: s.stepRemark ?? null
        }))
      });

      const allItems = enrichedSteps.flatMap((s) =>
        s.items.map((it, iIdx) => ({
          id: it.id,
          stepId: s.id,
          itemOrder: it.itemOrder,
          materialCode: it.materialCode,
          materialName: it.materialName,
          packingDesc: it.packingDesc ?? null,
          nettWeight: it.nettWeight ?? null,
          mixingRatio: it.mixingRatio,
          visco: it.visco ? String(it.visco) : iIdx === 0 && s.visco ? String(s.visco) : null,
          priceSnapshotVnd: it.priceSnapshotVnd ?? 0
        }))
      );

      if (allItems.length > 0) {
        await tx.scheduleStepItem.createMany({
          data: allItems
        });
      }
    }
  });

  const created = await dataStore.getRevisionById(newRevisionId);
  if (!created) {
    throw new Error(`Failed to load cloned revision: ${newRevisionId}`);
  }
  return created;
}

/**
 * Updates revision status (`DRAFT` | `APPROVED` | `INACTIVE`) in PostgreSQL
 * with mandatory reason validation, state transition rules, atomic auto-supersede
 * of older `APPROVED` revisions in the same Project, and `RevisionStatusHistory` logging.
 */
export async function updateRevisionStatus(params: {
  revisionId: string;
  targetStatus: RevisionStatus;
  note?: string | null;
  actor: {
    userId?: string | null;
    fullName: string;
    role: UserRole;
  };
}): Promise<ProjectRevision> {
  const { revisionId, actor } = params;
  const rawStatus = String(params.targetStatus || '').toUpperCase() as RevisionStatus;
  const normalizedTargetStatus: RevisionStatus =
    rawStatus === 'LOCKED' ? 'APPROVED' : rawStatus;

  if (
    normalizedTargetStatus !== 'DRAFT' &&
    normalizedTargetStatus !== 'APPROVED' &&
    normalizedTargetStatus !== 'INACTIVE'
  ) {
    throw new RevisionStatusDomainError(
      'INVALID_STATUS',
      `Invalid revision status: ${params.targetStatus} / Trạng thái không hợp lệ: ${params.targetStatus}`,
      400
    );
  }

  const cleanNote = (params.note ?? '').trim();
  if (!cleanNote) {
    throw new RevisionStatusDomainError(
      'REASON_REQUIRED',
      'Reason is required to change revision status / Vui lòng nhập lý do thay đổi trạng thái hồ sơ.',
      400
    );
  }

  const existing = await prisma.projectRevision.findUnique({
    where: { id: revisionId }
  });
  if (!existing) {
    throw new RevisionStatusDomainError(
      'REVISION_NOT_FOUND',
      `Revision not found: ${revisionId} / Không tìm thấy phiên bản hồ sơ.`,
      404
    );
  }

  const currentEffectiveStatus: RevisionStatus =
    existing.status === 'LOCKED' ? 'APPROVED' : (existing.status as RevisionStatus);

  if (currentEffectiveStatus === normalizedTargetStatus) {
    throw new RevisionStatusDomainError(
      'SAME_STATUS',
      `Revision is already in ${normalizedTargetStatus} status / Phiên bản hiện đã ở trạng thái ${normalizedTargetStatus}.`,
      400
    );
  }

  // Rule: Only an APPROVED (or legacy LOCKED) revision can transition to INACTIVE
  if (normalizedTargetStatus === 'INACTIVE' && currentEffectiveStatus !== 'APPROVED') {
    throw new RevisionStatusDomainError(
      'INVALID_STATUS_TRANSITION',
      'Only an APPROVED revision can be set to INACTIVE / Chỉ có thể chuyển sang trạng thái Ngưng hiệu lực (INACTIVE) từ hồ sơ đang Đã duyệt (APPROVED).',
      400
    );
  }

  const now = new Date();
  const targetRevCode = `Rev ${String(existing.revisionNo).padStart(2, '0')}`;

  await prisma.$transaction(async (tx) => {
    // 1. Update target revision status
    await tx.projectRevision.update({
      where: { id: revisionId },
      data: {
        status: normalizedTargetStatus,
        updatedAt: now
      }
    });

    // 2. Record status change history for target revision
    await tx.revisionStatusHistory.create({
      data: {
        id: `hist-${revisionId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        revisionId,
        fromStatus: currentEffectiveStatus,
        toStatus: normalizedTargetStatus,
        changedByUserId: actor.userId ?? null,
        changedByName: actor.fullName,
        changedByRole: actor.role,
        note: cleanNote,
        isAutoSupersede: false,
        changedAt: now
      }
    });

    // 3. Auto-supersede: When approving this revision, automatically set all other APPROVED revisions in the same Project to INACTIVE
    if (normalizedTargetStatus === 'APPROVED') {
      const siblingApprovedRevs = await tx.projectRevision.findMany({
        where: {
          projectId: existing.projectId,
          id: { not: revisionId },
          status: { in: ['APPROVED', 'LOCKED'] }
        },
        orderBy: { revisionNo: 'asc' }
      });

      if (siblingApprovedRevs.length > 0) {
        await tx.projectRevision.updateMany({
          where: {
            id: { in: siblingApprovedRevs.map((r) => r.id) }
          },
          data: {
            status: 'INACTIVE',
            updatedAt: now
          }
        });

        await tx.revisionStatusHistory.createMany({
          data: siblingApprovedRevs.map((oldRev, idx) => ({
            id: `hist-auto-${oldRev.id}-${Date.now().toString(36)}-${idx}`,
            revisionId: oldRev.id,
            fromStatus: 'APPROVED',
            toStatus: 'INACTIVE',
            changedByUserId: actor.userId ?? null,
            changedByName: actor.fullName,
            changedByRole: actor.role,
            note: `Auto-superseded to INACTIVE because ${targetRevCode} was approved. Reason for ${targetRevCode}: ${cleanNote} / Tự động chuyển sang INACTIVE do phiên bản ${targetRevCode} được phê duyệt thay thế. Lý do duyệt ${targetRevCode}: ${cleanNote}`,
            isAutoSupersede: true,
            changedAt: now
          }))
        });
      }
    }
  });

  const updated = await dataStore.getRevisionById(revisionId);
  if (!updated) {
    throw new Error(`Revision not found after update: ${revisionId}`);
  }
  return updated;
}

/**
 * Retrieves ordered status history entries (newest first) for a given revision.
 */
export async function getRevisionStatusHistory(
  revisionId: string
): Promise<RevisionStatusHistoryEntry[]> {
  const rows = await prisma.revisionStatusHistory.findMany({
    where: { revisionId },
    orderBy: { changedAt: 'desc' }
  });

  return rows.map((h) => ({
    id: h.id,
    revisionId: h.revisionId,
    fromStatus: (h.fromStatus as RevisionStatus | null) ?? null,
    toStatus: h.toStatus as RevisionStatus,
    changedByUserId: h.changedByUserId ?? null,
    changedByName: h.changedByName,
    changedByRole: h.changedByRole as UserRole,
    note: h.note,
    isAutoSupersede: h.isAutoSupersede,
    changedAt: h.changedAt.toISOString()
  }));
}
