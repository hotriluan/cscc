import {
  Customer,
  QuotationItem,
  PackingMapping,
  ApplicationStepMaster,
  ApplicationMethod,
  Project,
  ProjectRevision,
  ScheduleStep,
  RevisionStatus,
  StepRowType,
  UserAccount,
  UserRole,
  PaginatedResponse,
  parseCaInput,
  calculateCoatingCostTable
} from '@cscc/shared';
import { prisma } from './prisma';
import {
  ImportedMasterData,
  importMasterDataFromExcel,
  buildGoldenDatasetNtr001,
  resolveDefaultExcelPath
} from '../services/excel-importer.service';
import {
  DEFAULT_SEED_USERS,
  hashPassword,
  verifyPassword
} from '../services/auth.service';

export interface DatabaseCounts {
  users: number;
  customers: number;
  quotations: number;
  packingMappings: number;
  applicationSteps: number;
  applicationMethods: number;
  projects: number;
  revisions: number;
}

function mapCustomerDto(c: {
  id: string;
  customerId: string;
  shortName: string;
  customerName: string;
}): Customer {
  return {
    id: c.id,
    customerId: c.customerId,
    shortName: c.shortName,
    customerName: c.customerName
  };
}

function mapQuotationDto(q: {
  id: string;
  sapCustomerCode: string;
  customerName: string;
  sapProductCode: string;
  custProductKey: string;
  materialCode: string;
  materialName: string;
  packingDesc: string;
  nett: number;
  priceUnitVnd: number;
  validFrom: string | null;
  validTo: string | null;
}): QuotationItem {
  return {
    id: q.id,
    sapCustomerCode: q.sapCustomerCode,
    customerName: q.customerName,
    sapProductCode: q.sapProductCode,
    custProductKey: q.custProductKey,
    materialCode: q.materialCode,
    materialName: q.materialName,
    packingDesc: q.packingDesc,
    nett: q.nett,
    priceUnitVnd: q.priceUnitVnd,
    validFrom: q.validFrom,
    validTo: q.validTo
  };
}

function mapStepDto(step: {
  id: string;
  stepOrder: number;
  stepNumber: number | null;
  rowType: string;
  stepName: string;
  sandingSpec: string | null;
  caInputRaw: string | null;
  caMin: number | null;
  caMax: number | null;
  caAvg: number | null;
  methodName: string | null;
  efficiencySnapshot: number | null;
  dryingTime: string | null;
  stepRemark: string | null;
  items: Array<{
    id: string;
    stepId: string;
    itemOrder: number;
    materialCode: string;
    materialName: string;
    packingDesc: string | null;
    nettWeight: number | null;
    mixingRatio: number;
    visco: number | null;
    priceSnapshotVnd: number;
  }>;
}): ScheduleStep {
  return {
    id: step.id,
    stepOrder: step.stepOrder,
    stepNumber: step.stepNumber,
    rowType: step.rowType as StepRowType,
    stepName: step.stepName,
    sandingSpec: step.sandingSpec,
    caInputRaw: step.caInputRaw,
    caMin: step.caMin,
    caMax: step.caMax,
    caAvg: step.caAvg,
    methodName: step.methodName,
    efficiencySnapshot: step.efficiencySnapshot,
    dryingTime: step.dryingTime,
    stepRemark: step.stepRemark,
    items: [...step.items]
      .sort((a, b) => a.itemOrder - b.itemOrder)
      .map((it) => ({
        id: it.id,
        stepId: it.stepId,
        itemOrder: it.itemOrder,
        materialCode: it.materialCode,
        materialName: it.materialName,
        packingDesc: it.packingDesc,
        nettWeight: it.nettWeight,
        mixingRatio: it.mixingRatio,
        visco: it.visco,
        priceSnapshotVnd: it.priceSnapshotVnd
      }))
  };
}

class PostgresDataStore {
  private initialized = false;

  /**
   * Initializes connection to PostgreSQL and seeds Master Data + Golden Dataset NTR 001
   * if the database is empty or if `forceReimportFromExcel` is true.
   */
  public async init(forceReimportFromExcel = false): Promise<DatabaseCounts> {
    const [customerCount, ntrRev] = await Promise.all([
      prisma.customer.count(),
      prisma.projectRevision.findUnique({
        where: { id: 'rev-ntr001-00' },
        include: { steps: { include: { items: true } } }
      })
    ]);

    const hasCorruptedNtr001 =
      !ntrRev ||
      ntrRev.productName !== 'TABLE' ||
      ntrRev.steps.some((s) => s.items.some((it) => (it.nettWeight ?? 0) > 1000));

    if (forceReimportFromExcel || customerCount === 0 || hasCorruptedNtr001) {
      const excelPath = resolveDefaultExcelPath();
      const master = await importMasterDataFromExcel(excelPath);
      const { project, revision } = buildGoldenDatasetNtr001(master);
      await this.seedFullDatabase(master, project, revision);
    }

    await this.ensureDefaultUsersSeeded();

    this.initialized = true;
    return this.getCounts();
  }

  public async ensureDefaultUsersSeeded(): Promise<void> {
    const existingUsers = await prisma.user.findMany({
      select: { email: true }
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    for (const seedUser of DEFAULT_SEED_USERS) {
      if (!existingEmails.has(seedUser.email.toLowerCase())) {
        await prisma.user.create({
          data: {
            id: seedUser.id,
            email: seedUser.email.toLowerCase(),
            fullName: seedUser.fullName,
            passwordHash: hashPassword(seedUser.passwordPlain),
            role: seedUser.role
          }
        });
      }
    }
  }

  private async seedFullDatabase(
    master: ImportedMasterData,
    project: Project,
    revision: ProjectRevision
  ): Promise<void> {
    const customerCodeToId = new Map<string, string>(
      master.customers.map((c) => [c.customerId, c.id])
    );

    const allSteps = revision.steps.map((s) => ({
      id: s.id,
      revisionId: revision.id,
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
    }));

    const allStepItems = revision.steps.flatMap((s) =>
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

    await prisma.$transaction(async (tx) => {
      await tx.scheduleStepItem.deleteMany();
      await tx.scheduleStep.deleteMany();
      await tx.projectRevision.deleteMany();
      await tx.project.deleteMany();
      await tx.quotationItem.deleteMany();
      await tx.packingMapping.deleteMany();
      await tx.applicationStepMaster.deleteMany();
      await tx.applicationMethod.deleteMany();
      await tx.customer.deleteMany();

      if (master.customers.length > 0) {
        await tx.customer.createMany({
          data: master.customers.map((c) => ({
            id: c.id,
            customerId: c.customerId,
            shortName: c.shortName,
            customerName: c.customerName
          }))
        });
      }

      if (master.packingMappings.length > 0) {
        await tx.packingMapping.createMany({
          data: master.packingMappings.map((p) => ({
            id: p.id,
            code: p.code,
            description: p.description,
            unitType: p.unitType,
            nettWeight: p.nettWeight
          }))
        });
      }

      if (master.applicationSteps.length > 0) {
        await tx.applicationStepMaster.createMany({
          data: master.applicationSteps.map((s) => ({
            id: s.id,
            stepName: s.stepName,
            sortOrder: s.sortOrder
          }))
        });
      }

      if (master.applicationMethods.length > 0) {
        await tx.applicationMethod.createMany({
          data: master.applicationMethods.map((m) => ({
            id: m.id,
            methodName: m.methodName,
            efficiency: m.efficiency
          }))
        });
      }

      if (master.quotations.length > 0) {
        await tx.quotationItem.createMany({
          data: master.quotations.map((q) => ({
            id: q.id,
            sapCustomerCode: q.sapCustomerCode,
            customerName: q.customerName,
            sapProductCode: q.sapProductCode,
            custProductKey: q.custProductKey,
            materialCode: q.materialCode,
            materialName: q.materialName,
            packingDesc: q.packingDesc,
            nett: q.nett,
            priceUnitVnd: q.priceUnitVnd ?? 0,
            validFrom: q.validFrom ?? null,
            validTo: q.validTo ?? null,
            customerRefId: customerCodeToId.get(q.sapCustomerCode) ?? null
          }))
        });
      }

      await tx.project.create({
        data: {
          id: project.id,
          projectCode: project.projectCode,
          customerId: project.customerId,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }
      });

      await tx.projectRevision.create({
        data: {
          id: revision.id,
          projectId: project.id,
          revisionNo: revision.revisionNo,
          status: revision.status,
          scheduleDate: revision.scheduleDate,
          productName: revision.productName,
          colorName: revision.colorName,
          substrate: revision.substrate,
          positioning: revision.positioning,
          finishingSystem: revision.finishingSystem,
          glossLevel: revision.glossLevel,
          referenceStandard: revision.referenceStandard,
          mcWood: revision.mcWood,
          roomHumidity: revision.roomHumidity,
          roomTemp: revision.roomTemp,
          lineSpeed: revision.lineSpeed ?? null,
          dryingCondition: revision.dryingCondition ?? null,
          remark: revision.remark ?? null,
          defaultAreaM2: revision.defaultAreaM2,
          preparedByTa: revision.preparedByTa ?? null,
          checkedByLeader: revision.checkedByLeader ?? null,
          approvedByPdPm: revision.approvedByPdPm ?? null,
          customerConfirmName: revision.customerConfirmName ?? null,
          createdAt: new Date(revision.createdAt),
          updatedAt: new Date(revision.updatedAt)
        }
      });

      if (allSteps.length > 0) {
        await tx.scheduleStep.createMany({ data: allSteps });
      }
      if (allStepItems.length > 0) {
        await tx.scheduleStepItem.createMany({ data: allStepItems });
      }
    });
  }

  /**
   * Replaces/synchronizes the 5 Master Data tables from an imported Excel file
   * while preserving existing Projects and Revisions.
   */
  public async replaceMasterData(master: ImportedMasterData): Promise<DatabaseCounts> {
    await prisma.$transaction(async (tx) => {
      // Upsert customers so existing Project foreign keys remain intact
      for (const c of master.customers) {
        await tx.customer.upsert({
          where: { customerId: c.customerId },
          update: {
            shortName: c.shortName,
            customerName: c.customerName
          },
          create: {
            id: c.id,
            customerId: c.customerId,
            shortName: c.shortName,
            customerName: c.customerName
          }
        });
      }

      const dbCustomers = await tx.customer.findMany({
        select: { id: true, customerId: true }
      });
      const customerCodeToId = new Map<string, string>(
        dbCustomers.map((c) => [c.customerId, c.id])
      );

      await tx.quotationItem.deleteMany();
      await tx.packingMapping.deleteMany();
      await tx.applicationStepMaster.deleteMany();
      await tx.applicationMethod.deleteMany();

      if (master.packingMappings.length > 0) {
        await tx.packingMapping.createMany({
          data: master.packingMappings.map((p) => ({
            id: p.id,
            code: p.code,
            description: p.description,
            unitType: p.unitType,
            nettWeight: p.nettWeight
          }))
        });
      }

      if (master.applicationSteps.length > 0) {
        await tx.applicationStepMaster.createMany({
          data: master.applicationSteps.map((s) => ({
            id: s.id,
            stepName: s.stepName,
            sortOrder: s.sortOrder
          }))
        });
      }

      if (master.applicationMethods.length > 0) {
        await tx.applicationMethod.createMany({
          data: master.applicationMethods.map((m) => ({
            id: m.id,
            methodName: m.methodName,
            efficiency: m.efficiency
          }))
        });
      }

      if (master.quotations.length > 0) {
        await tx.quotationItem.createMany({
          data: master.quotations.map((q) => ({
            id: q.id,
            sapCustomerCode: q.sapCustomerCode,
            customerName: q.customerName,
            sapProductCode: q.sapProductCode,
            custProductKey: q.custProductKey,
            materialCode: q.materialCode,
            materialName: q.materialName,
            packingDesc: q.packingDesc,
            nett: q.nett,
            priceUnitVnd: q.priceUnitVnd ?? 0,
            validFrom: q.validFrom ?? null,
            validTo: q.validTo ?? null,
            customerRefId: customerCodeToId.get(q.sapCustomerCode) ?? null
          }))
        });
      }
    });

    return this.getCounts();
  }

  public async getCounts(): Promise<DatabaseCounts> {
    const [
      users,
      customers,
      quotations,
      packingMappings,
      applicationSteps,
      applicationMethods,
      projects,
      revisions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.customer.count(),
      prisma.quotationItem.count(),
      prisma.packingMapping.count(),
      prisma.applicationStepMaster.count(),
      prisma.applicationMethod.count(),
      prisma.project.count(),
      prisma.projectRevision.count()
    ]);

    return {
      users,
      customers,
      quotations,
      packingMappings,
      applicationSteps,
      applicationMethods,
      projects,
      revisions
    };
  }

  // ===========================================================================
  // 0. USERS & AUTHENTICATION (PostgreSQL `User` Table)
  // ===========================================================================
  public async getUsers(): Promise<UserAccount[]> {
    const rows = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' }
    });
    return rows.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role as UserRole,
      createdAt: u.createdAt.toISOString()
    }));
  }

  public async getUserById(id: string): Promise<UserAccount | null> {
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role as UserRole,
      createdAt: u.createdAt.toISOString()
    };
  }

  public async verifyUserCredentials(
    email: string,
    passwordPlain: string
  ): Promise<UserAccount | null> {
    const cleanEmail = email.trim().toLowerCase();
    const u = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!u) return null;
    if (!verifyPassword(passwordPlain, u.passwordHash)) {
      return null;
    }
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role as UserRole,
      createdAt: u.createdAt.toISOString()
    };
  }

  public async upsertUser(input: {
    email: string;
    fullName: string;
    passwordPlain?: string;
    role: UserRole;
  }): Promise<{ user: UserAccount; created: boolean }> {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.fullName.trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: cleanName,
          role: input.role,
          ...(input.passwordPlain?.trim()
            ? { passwordHash: hashPassword(input.passwordPlain.trim()) }
            : {})
        }
      });
      return {
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          role: updated.role as UserRole,
          createdAt: updated.createdAt.toISOString()
        },
        created: false
      };
    }

    const created = await prisma.user.create({
      data: {
        id: `user-${Date.now().toString(36)}`,
        email: cleanEmail,
        fullName: cleanName,
        passwordHash: hashPassword(input.passwordPlain?.trim() || '123456'),
        role: input.role
      }
    });

    return {
      user: {
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        role: created.role as UserRole,
        createdAt: created.createdAt.toISOString()
      },
      created: true
    };
  }

  public async deleteUser(id: string): Promise<{ ok: boolean; error?: string }> {
    const total = await prisma.user.count();
    if (total <= 1) {
      return { ok: false, error: 'Không thể xóa tài khoản cuối cùng trên hệ thống.' };
    }
    await prisma.user.deleteMany({ where: { id } });
    return { ok: true };
  }

  // ===========================================================================
  // 1. CUSTOMERS
  // ===========================================================================
  public async getCustomers(q = ''): Promise<Customer[]> {
    const search = q.trim();
    const rows = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { customerId: { contains: search, mode: 'insensitive' } },
              { shortName: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } }
            ]
          }
        : undefined
    });

    const mapped = rows.map(mapCustomerDto);
    mapped.sort((a, b) => {
      const aHasShort = a.shortName !== a.customerName ? 0 : 1;
      const bHasShort = b.shortName !== b.customerName ? 0 : 1;
      if (aHasShort !== bHasShort) return aHasShort - bHasShort;
      return a.shortName.localeCompare(b.shortName);
    });
    return mapped;
  }

  public async getCustomersPaginated(params: {
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<Customer>> {
    const search = (params.q || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(10, Number(params.pageSize) || 50), 500);

    const where = search
      ? {
          OR: [
            { customerId: { contains: search, mode: 'insensitive' as const } },
            { shortName: { contains: search, mode: 'insensitive' as const } },
            { customerName: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : undefined;

    const [total, rows] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ shortName: 'asc' }, { customerId: 'asc' }]
      })
    ]);

    return {
      items: rows.map(mapCustomerDto),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }

  public async upsertCustomer(input: {
    customerId: string;
    shortName?: string;
    customerName: string;
  }): Promise<{ customer: Customer; created: boolean }> {
    const cleanCode = input.customerId.trim();
    const cleanName = input.customerName.trim();
    const cleanShort = (input.shortName || cleanName).trim();

    const existing = await prisma.customer.findUnique({
      where: { customerId: cleanCode }
    });

    if (existing) {
      const updated = await prisma.customer.update({
        where: { id: existing.id },
        data: {
          shortName: cleanShort,
          customerName: cleanName
        }
      });
      return { customer: mapCustomerDto(updated), created: false };
    }

    const created = await prisma.customer.create({
      data: {
        id: `cust-${cleanCode}-${Date.now().toString(36)}`,
        customerId: cleanCode,
        shortName: cleanShort,
        customerName: cleanName
      }
    });
    return { customer: mapCustomerDto(created), created: true };
  }

  public async updateCustomer(
    id: string,
    input: Partial<Customer>
  ): Promise<Customer | null> {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        customerId:
          input.customerId !== undefined ? String(input.customerId).trim() : existing.customerId,
        shortName:
          input.shortName !== undefined ? String(input.shortName).trim() : existing.shortName,
        customerName:
          input.customerName !== undefined
            ? String(input.customerName).trim()
            : existing.customerName
      }
    });
    return mapCustomerDto(updated);
  }

  public async deleteCustomer(id: string): Promise<void> {
    await prisma.customer.deleteMany({ where: { id } });
  }

  // ===========================================================================
  // 2. QUOTATIONS
  // ===========================================================================
  public async getQuotations(params: {
    customerCode?: string;
    q?: string;
    limit?: number;
  }): Promise<QuotationItem[]> {
    const customerCode = (params.customerCode || '').trim();
    const q = (params.q || '').trim();
    const limit = Math.min(Number(params.limit) || 500, 3000);

    const rows = await prisma.quotationItem.findMany({
      where: {
        ...(customerCode ? { sapCustomerCode: customerCode } : {}),
        ...(q
          ? {
              OR: [
                { materialCode: { contains: q, mode: 'insensitive' } },
                { materialName: { contains: q, mode: 'insensitive' } },
                { sapCustomerCode: { contains: q, mode: 'insensitive' } },
                { customerName: { contains: q, mode: 'insensitive' } }
              ]
            }
          : {})
      },
      take: limit,
      orderBy: [{ sapCustomerCode: 'asc' }, { materialCode: 'asc' }]
    });

    return rows.map(mapQuotationDto);
  }

  public async getQuotationsPaginated(params: {
    customerCode?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<QuotationItem>> {
    const customerCode = (params.customerCode || '').trim();
    const q = (params.q || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(Math.max(10, Number(params.pageSize) || 50), 500);

    const where = {
      ...(customerCode ? { sapCustomerCode: customerCode } : {}),
      ...(q
        ? {
            OR: [
              { materialCode: { contains: q, mode: 'insensitive' as const } },
              { materialName: { contains: q, mode: 'insensitive' as const } },
              { sapCustomerCode: { contains: q, mode: 'insensitive' as const } },
              { customerName: { contains: q, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };

    const [total, rows] = await Promise.all([
      prisma.quotationItem.count({ where }),
      prisma.quotationItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sapCustomerCode: 'asc' }, { materialCode: 'asc' }]
      })
    ]);

    return {
      items: rows.map(mapQuotationDto),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    };
  }

  public async upsertQuotation(input: {
    sapCustomerCode: string;
    customerName?: string;
    sapProductCode?: string;
    materialCode: string;
    materialName?: string;
    packingDesc?: string;
    nett?: number;
    priceUnitVnd?: number;
  }): Promise<{ quotation: QuotationItem; created: boolean }> {
    const sapCustomerCode = String(input.sapCustomerCode).trim();
    const materialCode = String(input.materialCode).trim();
    const custProductKey = `${sapCustomerCode}${materialCode}`;

    const customerRef = await prisma.customer.findUnique({
      where: { customerId: sapCustomerCode },
      select: { id: true }
    });

    const existing = await prisma.quotationItem.findUnique({
      where: { custProductKey }
    });

    if (existing) {
      const updated = await prisma.quotationItem.update({
        where: { id: existing.id },
        data: {
          customerName:
            input.customerName !== undefined
              ? String(input.customerName).trim()
              : existing.customerName,
          materialName:
            input.materialName !== undefined
              ? String(input.materialName).trim()
              : existing.materialName,
          packingDesc:
            input.packingDesc !== undefined
              ? String(input.packingDesc).trim()
              : existing.packingDesc,
          nett: input.nett !== undefined ? Number(input.nett) : existing.nett,
          priceUnitVnd:
            input.priceUnitVnd !== undefined
              ? Number(input.priceUnitVnd)
              : existing.priceUnitVnd,
          customerRefId: customerRef?.id ?? existing.customerRefId
        }
      });
      return { quotation: mapQuotationDto(updated), created: false };
    }

    const created = await prisma.quotationItem.create({
      data: {
        id: `quot-${Date.now().toString(36)}`,
        sapCustomerCode,
        customerName: String(input.customerName || '').trim(),
        sapProductCode: String(input.sapProductCode || '').trim(),
        custProductKey,
        materialCode,
        materialName: String(input.materialName || materialCode).trim(),
        packingDesc: String(input.packingDesc || '20 Kg').trim(),
        nett: Number(input.nett) || 20,
        priceUnitVnd: Number(input.priceUnitVnd) || 0,
        validFrom: null,
        validTo: null,
        customerRefId: customerRef?.id ?? null
      }
    });
    return { quotation: mapQuotationDto(created), created: true };
  }

  public async updateQuotation(
    id: string,
    input: Partial<QuotationItem>
  ): Promise<QuotationItem | null> {
    const existing = await prisma.quotationItem.findUnique({ where: { id } });
    if (!existing) return null;

    const sapCustomerCode =
      input.sapCustomerCode !== undefined
        ? String(input.sapCustomerCode).trim()
        : existing.sapCustomerCode;
    const materialCode =
      input.materialCode !== undefined
        ? String(input.materialCode).trim()
        : existing.materialCode;
    const custProductKey = `${sapCustomerCode}${materialCode}`;

    const updated = await prisma.quotationItem.update({
      where: { id },
      data: {
        sapCustomerCode,
        customerName:
          input.customerName !== undefined
            ? String(input.customerName).trim()
            : existing.customerName,
        materialCode,
        materialName:
          input.materialName !== undefined
            ? String(input.materialName).trim()
            : existing.materialName,
        packingDesc:
          input.packingDesc !== undefined
            ? String(input.packingDesc).trim()
            : existing.packingDesc,
        nett: input.nett !== undefined ? Number(input.nett) : existing.nett,
        priceUnitVnd:
          input.priceUnitVnd !== undefined
            ? Number(input.priceUnitVnd)
            : existing.priceUnitVnd,
        custProductKey
      }
    });
    return mapQuotationDto(updated);
  }

  public async deleteQuotation(id: string): Promise<void> {
    await prisma.quotationItem.deleteMany({ where: { id } });
  }

  // ===========================================================================
  // 3. APPLICATION STEPS MASTER
  // ===========================================================================
  public async getApplicationSteps(): Promise<ApplicationStepMaster[]> {
    const rows = await prisma.applicationStepMaster.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    return rows.map((s) => ({
      id: s.id,
      stepName: s.stepName,
      sortOrder: s.sortOrder
    }));
  }

  public async upsertApplicationStep(input: {
    stepName: string;
    sortOrder?: number;
  }): Promise<{ step: ApplicationStepMaster; created: boolean }> {
    const stepName = input.stepName.trim().toUpperCase();
    const existing = await prisma.applicationStepMaster.findUnique({
      where: { stepName }
    });
    if (existing) {
      return {
        step: {
          id: existing.id,
          stepName: existing.stepName,
          sortOrder: existing.sortOrder
        },
        created: false
      };
    }

    const total = await prisma.applicationStepMaster.count();
    const created = await prisma.applicationStepMaster.create({
      data: {
        id: `step-master-${Date.now().toString(36)}`,
        stepName,
        sortOrder: Number(input.sortOrder) || total + 1
      }
    });
    return {
      step: {
        id: created.id,
        stepName: created.stepName,
        sortOrder: created.sortOrder
      },
      created: true
    };
  }

  public async updateApplicationStep(
    id: string,
    input: Partial<ApplicationStepMaster>
  ): Promise<ApplicationStepMaster | null> {
    const existing = await prisma.applicationStepMaster.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.applicationStepMaster.update({
      where: { id },
      data: {
        stepName:
          input.stepName !== undefined
            ? String(input.stepName).trim().toUpperCase()
            : existing.stepName,
        sortOrder:
          input.sortOrder !== undefined ? Number(input.sortOrder) : existing.sortOrder
      }
    });
    return {
      id: updated.id,
      stepName: updated.stepName,
      sortOrder: updated.sortOrder
    };
  }

  public async deleteApplicationStep(id: string): Promise<void> {
    await prisma.applicationStepMaster.deleteMany({ where: { id } });
  }

  // ===========================================================================
  // 4. APPLICATION METHODS
  // ===========================================================================
  public async getApplicationMethods(): Promise<ApplicationMethod[]> {
    const rows = await prisma.applicationMethod.findMany({
      orderBy: { methodName: 'asc' }
    });
    return rows.map((m) => ({
      id: m.id,
      methodName: m.methodName,
      efficiency: m.efficiency
    }));
  }

  public async upsertApplicationMethod(input: {
    methodName: string;
    efficiency: number;
  }): Promise<{ method: ApplicationMethod; created: boolean }> {
    const methodName = input.methodName.trim().toUpperCase();
    const efficiency = Number(input.efficiency);
    const existing = await prisma.applicationMethod.findUnique({
      where: { methodName }
    });
    if (existing) {
      const updated = await prisma.applicationMethod.update({
        where: { id: existing.id },
        data: { efficiency }
      });
      return {
        method: {
          id: updated.id,
          methodName: updated.methodName,
          efficiency: updated.efficiency
        },
        created: false
      };
    }

    const created = await prisma.applicationMethod.create({
      data: {
        id: `method-${Date.now().toString(36)}`,
        methodName,
        efficiency
      }
    });
    return {
      method: {
        id: created.id,
        methodName: created.methodName,
        efficiency: created.efficiency
      },
      created: true
    };
  }

  public async updateApplicationMethod(
    id: string,
    input: Partial<ApplicationMethod>
  ): Promise<ApplicationMethod | null> {
    const existing = await prisma.applicationMethod.findUnique({ where: { id } });
    if (!existing) return null;

    const updated = await prisma.applicationMethod.update({
      where: { id },
      data: {
        methodName:
          input.methodName !== undefined
            ? String(input.methodName).trim().toUpperCase()
            : existing.methodName,
        efficiency:
          input.efficiency !== undefined ? Number(input.efficiency) : existing.efficiency
      }
    });
    return {
      id: updated.id,
      methodName: updated.methodName,
      efficiency: updated.efficiency
    };
  }

  public async deleteApplicationMethod(id: string): Promise<void> {
    await prisma.applicationMethod.deleteMany({ where: { id } });
  }

  // ===========================================================================
  // 5. PACKING MAPPINGS
  // ===========================================================================
  public async getPackingMappings(): Promise<PackingMapping[]> {
    const rows = await prisma.packingMapping.findMany({
      orderBy: { code: 'asc' }
    });
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      description: p.description,
      unitType: p.unitType as 'KG' | 'LTR' | 'SET',
      nettWeight: p.nettWeight
    }));
  }

  // ===========================================================================
  // 6. PROJECTS & REVISIONS
  // ===========================================================================
  public async getProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({
      include: {
        customer: true,
        revisions: {
          include: {
            steps: {
              include: {
                items: {
                  orderBy: { itemOrder: 'asc' }
                }
              },
              orderBy: { stepOrder: 'asc' }
            }
          },
          orderBy: { revisionNo: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((proj) => ({
      id: proj.id,
      projectCode: proj.projectCode,
      customerId: proj.customerId,
      customer: mapCustomerDto(proj.customer),
      revisions: proj.revisions.map((r) => {
        const mappedSteps = r.steps.map(mapStepDto);
        const cost = calculateCoatingCostTable(r.id, mappedSteps);
        const chemCount = mappedSteps.filter((s) => s.rowType === 'CHEMICAL_STEP').length;
        return {
          id: r.id,
          revisionNo: r.revisionNo,
          status: r.status as RevisionStatus,
          scheduleDate: r.scheduleDate,
          productName: r.productName,
          colorName: r.colorName,
          substrate: r.substrate,
          finishingSystem: r.finishingSystem,
          stepCount: chemCount,
          totalCoatingCostDisplay: cost.totalCoatingCostDisplay,
          updatedAt: r.updatedAt.toISOString()
        };
      }),
      createdAt: proj.createdAt.toISOString(),
      updatedAt: proj.updatedAt.toISOString()
    }));
  }

  public async createProject(input: {
    projectCode?: string;
    customerId?: string;
    productName?: string;
    colorName?: string;
    substrate?: string;
    positioning?: string;
    finishingSystem?: string;
    glossLevel?: string;
    referenceStandard?: string;
  }): Promise<{ project: Project; revision: ProjectRevision }> {
    const customerRecord =
      (input.customerId
        ? await prisma.customer.findFirst({
            where: {
              OR: [{ id: input.customerId }, { customerId: input.customerId }]
            }
          })
        : null) ?? (await prisma.customer.findFirst({ orderBy: { shortName: 'asc' } }));

    if (!customerRecord) {
      throw new Error('Valid customer is required');
    }

    const totalProjects = await prisma.project.count();
    const now = new Date();
    const nowIso = now.toISOString();
    const projId = `proj-${Date.now().toString(36)}`;
    const revId = `rev-${projId}-00`;
    let code = String(input.projectCode || `PRJ-${totalProjects + 1}`).trim();

    // Ensure unique projectCode if user supplied an existing one
    const existingCode = await prisma.project.findUnique({ where: { projectCode: code } });
    if (existingCode) {
      code = `${code}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }

    const stepId = `${revId}-step-1`;
    const itemId = `${revId}-step-1-item-1`;

    await prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: projId,
          projectCode: code,
          customerId: customerRecord.id,
          createdAt: now,
          updatedAt: now
        }
      });

      await tx.projectRevision.create({
        data: {
          id: revId,
          projectId: projId,
          revisionNo: 0,
          status: 'DRAFT',
          scheduleDate: nowIso.slice(0, 10),
          productName: String(input.productName || 'SẢN PHẨM MỚI').trim(),
          colorName: String(input.colorName || 'STANDARD').trim(),
          substrate: String(input.substrate || 'OAK / TẦN BÌ').trim(),
          positioning: String(input.positioning || 'MID HIGH').trim(),
          finishingSystem: String(input.finishingSystem || 'NC-PU').trim(),
          glossLevel: String(input.glossLevel || '30± 3 GU').trim(),
          referenceStandard: String(input.referenceStandard || 'THEO MẪU KHÁCH HÀNG').trim(),
          mcWood: '<12%',
          roomHumidity: '<80%',
          roomTemp: '<35 oC',
          lineSpeed: '',
          dryingCondition: 'Đủ nhiệt và gió trong phòng sấy',
          remark: '',
          defaultAreaM2: 100,
          preparedByTa: '',
          checkedByLeader: '',
          approvedByPdPm: '',
          customerConfirmName: '',
          createdAt: now,
          updatedAt: now
        }
      });

      await tx.scheduleStep.create({
        data: {
          id: stepId,
          revisionId: revId,
          stepOrder: 1,
          stepNumber: 1,
          rowType: 'CHEMICAL_STEP',
          stepName: '',
          sandingSpec: null,
          caInputRaw: '',
          caMin: null,
          caMax: null,
          caAvg: 0,
          methodName: '',
          efficiencySnapshot: null,
          dryingTime: '',
          stepRemark: null
        }
      });

      await tx.scheduleStepItem.create({
        data: {
          id: itemId,
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
      });
    });

    const revision = await this.getRevisionById(revId);
    const projects = await this.getProjects();
    const project = projects.find((p) => p.id === projId)!;
    return { project, revision: revision! };
  }

  public async deleteProject(id: string): Promise<{ ok: boolean; error?: string }> {
    const count = await prisma.project.count();
    if (count <= 1) {
      return {
        ok: false,
        error: 'Không thể xóa hồ sơ dự án cuối cùng trên hệ thống.'
      };
    }
    await prisma.project.deleteMany({ where: { id } });
    return { ok: true };
  }

  public async getRevisionById(id: string): Promise<ProjectRevision | null> {
    const r = await prisma.projectRevision.findUnique({
      where: { id },
      include: {
        project: {
          include: { customer: true }
        },
        steps: {
          include: {
            items: {
              orderBy: { itemOrder: 'asc' }
            }
          },
          orderBy: { stepOrder: 'asc' }
        }
      }
    });

    if (!r) return null;

    return {
      id: r.id,
      projectId: r.projectId,
      projectCode: r.project.projectCode,
      customer: mapCustomerDto(r.project.customer),
      revisionNo: r.revisionNo,
      status: r.status as RevisionStatus,
      scheduleDate: r.scheduleDate,
      productName: r.productName,
      colorName: r.colorName,
      substrate: r.substrate,
      positioning: r.positioning,
      finishingSystem: r.finishingSystem,
      glossLevel: r.glossLevel,
      referenceStandard: r.referenceStandard,
      mcWood: r.mcWood,
      roomHumidity: r.roomHumidity,
      roomTemp: r.roomTemp,
      lineSpeed: r.lineSpeed,
      dryingCondition: r.dryingCondition,
      remark: r.remark,
      defaultAreaM2: r.defaultAreaM2,
      preparedByTa: r.preparedByTa,
      checkedByLeader: r.checkedByLeader,
      approvedByPdPm: r.approvedByPdPm,
      customerConfirmName: r.customerConfirmName,
      steps: r.steps.map(mapStepDto),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  public async deleteRevision(
    id: string
  ): Promise<{ ok: boolean; status?: number; error?: string }> {
    const rev = await prisma.projectRevision.findUnique({ where: { id } });
    if (!rev) {
      return { ok: false, status: 404, error: 'Revision not found' };
    }
    if (rev.status === 'LOCKED') {
      return {
        ok: false,
        status: 400,
        error: 'Không thể xóa phiên bản đã khóa (LOCKED).'
      };
    }
    const siblingCount = await prisma.projectRevision.count({
      where: { projectId: rev.projectId }
    });
    if (siblingCount <= 1) {
      return {
        ok: false,
        status: 400,
        error: 'Hồ sơ phải có ít nhất 1 phiên bản (Rev 00).'
      };
    }
    await prisma.projectRevision.delete({ where: { id } });
    return { ok: true };
  }

  public async updateRevision(
    id: string,
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
    message?: string;
    revision?: ProjectRevision;
  }> {
    const existing = await this.getRevisionById(id);
    if (!existing) {
      return { ok: false, status: 404, error: 'Revision not found' };
    }
    if (existing.status === 'LOCKED') {
      return {
        ok: false,
        status: 400,
        error: 'REVISION_LOCKED',
        message:
          'Phiên bản này đã bị khóa (LOCKED). Vui lòng nhân bản (Clone) sang Rev mới để chỉnh sửa.'
      };
    }

    let activeCustomerCode = existing.customer.customerId;
    let newCustomerId: string | undefined;

    if (body.customerId && typeof body.customerId === 'string') {
      const foundCustomer = await prisma.customer.findFirst({
        where: {
          OR: [{ id: body.customerId }, { customerId: body.customerId }]
        }
      });
      if (foundCustomer) {
        newCustomerId = foundCustomer.id;
        activeCustomerCode = foundCustomer.customerId;
      }
    }

    const newProjectCode =
      body.projectCode !== undefined ? String(body.projectCode).trim() : undefined;

    const enrichedSteps = Array.isArray(body.steps)
      ? await this.enrichRevisionStepsWithMasterData(
          activeCustomerCode,
          body.steps as ScheduleStep[],
          true
        )
      : null;

    await prisma.$transaction(async (tx) => {
      if (newCustomerId || newProjectCode) {
        await tx.project.update({
          where: { id: existing.projectId },
          data: {
            ...(newCustomerId ? { customerId: newCustomerId } : {}),
            ...(newProjectCode ? { projectCode: newProjectCode } : {})
          }
        });
      }

      await tx.projectRevision.update({
        where: { id },
        data: {
          scheduleDate:
            body.scheduleDate !== undefined
              ? String(body.scheduleDate)
              : existing.scheduleDate,
          productName:
            body.productName !== undefined
              ? String(body.productName)
              : existing.productName,
          colorName:
            body.colorName !== undefined ? String(body.colorName) : existing.colorName,
          substrate:
            body.substrate !== undefined ? String(body.substrate) : existing.substrate,
          positioning:
            body.positioning !== undefined
              ? String(body.positioning)
              : existing.positioning,
          finishingSystem:
            body.finishingSystem !== undefined
              ? String(body.finishingSystem)
              : existing.finishingSystem,
          glossLevel:
            body.glossLevel !== undefined ? String(body.glossLevel) : existing.glossLevel,
          referenceStandard:
            body.referenceStandard !== undefined
              ? String(body.referenceStandard)
              : existing.referenceStandard,
          mcWood: body.mcWood !== undefined ? String(body.mcWood) : existing.mcWood,
          roomHumidity:
            body.roomHumidity !== undefined
              ? String(body.roomHumidity)
              : existing.roomHumidity,
          roomTemp:
            body.roomTemp !== undefined ? String(body.roomTemp) : existing.roomTemp,
          lineSpeed:
            body.lineSpeed !== undefined
              ? body.lineSpeed === null
                ? null
                : String(body.lineSpeed)
              : existing.lineSpeed,
          dryingCondition:
            body.dryingCondition !== undefined
              ? body.dryingCondition === null
                ? null
                : String(body.dryingCondition)
              : existing.dryingCondition,
          remark:
            body.remark !== undefined
              ? body.remark === null
                ? null
                : String(body.remark)
              : existing.remark,
          defaultAreaM2:
            body.defaultAreaM2 !== undefined
              ? Number(body.defaultAreaM2) || 100
              : existing.defaultAreaM2,
          preparedByTa:
            body.preparedByTa !== undefined
              ? body.preparedByTa === null
                ? null
                : String(body.preparedByTa)
              : existing.preparedByTa,
          checkedByLeader:
            body.checkedByLeader !== undefined
              ? body.checkedByLeader === null
                ? null
                : String(body.checkedByLeader)
              : existing.checkedByLeader,
          approvedByPdPm:
            body.approvedByPdPm !== undefined
              ? body.approvedByPdPm === null
                ? null
                : String(body.approvedByPdPm)
              : existing.approvedByPdPm,
          customerConfirmName:
            body.customerConfirmName !== undefined
              ? body.customerConfirmName === null
                ? null
                : String(body.customerConfirmName)
              : existing.customerConfirmName
        }
      });

      if (enrichedSteps) {
        await tx.scheduleStepItem.deleteMany({
          where: { step: { revisionId: id } }
        });
        await tx.scheduleStep.deleteMany({
          where: { revisionId: id }
        });

        const stepRows = enrichedSteps.map((s, sIdx) => ({
          id: `${id}-step-${sIdx + 1}-${Date.now().toString(36)}`,
          revisionId: id,
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
          stepRemark: s.stepRemark ?? null,
          _items: s.items
        }));

        if (stepRows.length > 0) {
          await tx.scheduleStep.createMany({
            data: stepRows.map(({ _items: _, ...rest }) => rest)
          });

          const itemRows = stepRows.flatMap((sr) =>
            sr._items.map((it, iIdx) => ({
              id: `${sr.id}-item-${iIdx + 1}`,
              stepId: sr.id,
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

          if (itemRows.length > 0) {
            await tx.scheduleStepItem.createMany({ data: itemRows });
          }
        }
      }
    });

    const updated = await this.getRevisionById(id);
    return { ok: true, revision: updated! };
  }

  public async refreshRevisionPrices(
    id: string
  ): Promise<{ ok: boolean; status?: number; error?: string; revision?: ProjectRevision }> {
    const existing = await this.getRevisionById(id);
    if (!existing) {
      return { ok: false, status: 404, error: 'Revision not found' };
    }
    if (existing.status === 'LOCKED') {
      return {
        ok: false,
        status: 400,
        error: 'Cannot refresh prices on a LOCKED revision'
      };
    }

    const refreshedSteps = await this.enrichRevisionStepsWithMasterData(
      existing.customer.customerId,
      existing.steps,
      false
    );

    const result = await this.updateRevision(id, { steps: refreshedSteps });
    return result;
  }

  /**
   * Resolves Price/nett and Packing for a customer + materialCode from PostgreSQL Master Data,
   * and resolves Application Efficiency for a methodName.
   */
  public async enrichRevisionStepsWithMasterData(
    customerCode: string,
    steps: ScheduleStep[],
    preserveExistingSnapshots = true
  ): Promise<ScheduleStep[]> {
    const materialCodes = Array.from(
      new Set(
        steps
          .flatMap((s) => (s.items || []).map((it) => (it.materialCode || '').trim()))
          .filter(Boolean)
      )
    );

    const [methods, quotations] = await Promise.all([
      prisma.applicationMethod.findMany(),
      materialCodes.length > 0
        ? prisma.quotationItem.findMany({
            where: {
              OR: [
                { sapCustomerCode: customerCode, materialCode: { in: materialCodes } },
                { materialCode: { in: materialCodes } }
              ]
            }
          })
        : Promise.resolve([])
    ]);

    const quotByKey = new Map(quotations.map((q) => [q.custProductKey, q]));
    const quotByCode = new Map(quotations.map((q) => [q.materialCode, q]));

    let chemCounter = 1;

    return steps.map((step, idx) => {
      const isSanding = step.rowType === 'SANDING';
      const parsedCa = isSanding
        ? { caMin: null, caMax: null, caAvg: 0 }
        : parseCaInput(step.caInputRaw);
      const methodObj = step.methodName
        ? methods.find((m) => m.methodName.toUpperCase() === step.methodName!.toUpperCase())
        : undefined;

      const efficiencySnapshot = isSanding
        ? null
        : preserveExistingSnapshots &&
            typeof step.efficiencySnapshot === 'number' &&
            step.efficiencySnapshot > 0 &&
            (!methodObj || methodObj.efficiency === step.efficiencySnapshot)
          ? step.efficiencySnapshot
          : (methodObj?.efficiency ?? step.efficiencySnapshot ?? 0.6);

      const stepId = step.id || `step-${idx + 1}`;
      const items = isSanding
        ? []
        : (step.items || []).map((item, itemIdx) => {
            const code = (item.materialCode || '').trim();
            const key = `${customerCode}${code}`;
            const quot = quotByKey.get(key) ?? quotByCode.get(code);

            const priceSnapshotVnd =
              preserveExistingSnapshots &&
              typeof item.priceSnapshotVnd === 'number' &&
              item.priceSnapshotVnd > 0 &&
              !quot
                ? item.priceSnapshotVnd
                : (quot?.priceUnitVnd ?? item.priceSnapshotVnd ?? 0);

            return {
              ...item,
              id: item.id || `${stepId}-item-${itemIdx + 1}`,
              stepId,
              itemOrder: itemIdx + 1,
              materialCode: code,
              materialName: item.materialName || quot?.materialName || '',
              packingDesc: item.packingDesc ?? quot?.packingDesc ?? null,
              nettWeight: item.nettWeight ?? quot?.nett ?? null,
              mixingRatio: Number(item.mixingRatio) || 0,
              visco:
                item.visco !== null && item.visco !== undefined && String(item.visco) !== ''
                  ? Number(item.visco)
                  : null,
              priceSnapshotVnd
            };
          });

      return {
        ...step,
        id: stepId,
        stepOrder: idx + 1,
        stepNumber: isSanding ? null : chemCounter++,
        caMin: parsedCa.caMin,
        caMax: parsedCa.caMax,
        caAvg: isSanding ? null : parsedCa.caAvg,
        efficiencySnapshot,
        items
      };
    });
  }

  public async disconnect(): Promise<void> {
    await prisma.$disconnect();
  }
}

export const dataStore = new PostgresDataStore();
