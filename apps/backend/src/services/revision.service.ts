import { ProjectRevision, RevisionStatus } from '@cscc/shared';
import { prisma } from '../store/prisma';
import { dataStore } from '../store/data-store';

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
        s.items.map((it) => ({
          id: it.id,
          stepId: s.id,
          itemOrder: it.itemOrder,
          materialCode: it.materialCode,
          materialName: it.materialName,
          packingDesc: it.packingDesc ?? null,
          nettWeight: it.nettWeight ?? null,
          mixingRatio: it.mixingRatio,
          visco: it.visco ?? null,
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
 * Updates revision status (`DRAFT` -> `APPROVED` -> `LOCKED`) in PostgreSQL.
 */
export async function updateRevisionStatus(
  revisionId: string,
  status: RevisionStatus
): Promise<ProjectRevision> {
  const existing = await prisma.projectRevision.findUnique({
    where: { id: revisionId }
  });
  if (!existing) {
    throw new Error(`Revision not found: ${revisionId}`);
  }

  await prisma.projectRevision.update({
    where: { id: revisionId },
    data: { status }
  });

  const updated = await dataStore.getRevisionById(revisionId);
  if (!updated) {
    throw new Error(`Revision not found after update: ${revisionId}`);
  }
  return updated;
}
