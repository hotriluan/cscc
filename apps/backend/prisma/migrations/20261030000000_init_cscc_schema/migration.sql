-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TECHNICAL', 'SALES', 'PROJECT_LEADER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');

-- CreateEnum
CREATE TYPE "StepRowType" AS ENUM ('CHEMICAL_STEP', 'SANDING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingMapping" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unitType" TEXT NOT NULL,
    "nettWeight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PackingMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStepMaster" (
    "id" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ApplicationStepMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationMethod" (
    "id" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "efficiency" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ApplicationMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "sapCustomerCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "sapProductCode" TEXT NOT NULL,
    "custProductKey" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "packingDesc" TEXT NOT NULL,
    "nett" DOUBLE PRECISION NOT NULL,
    "priceUnitVnd" DOUBLE PRECISION NOT NULL,
    "validFrom" TEXT,
    "validTo" TEXT,
    "customerRefId" TEXT,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRevision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL DEFAULT 0,
    "status" "RevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduleDate" TEXT NOT NULL DEFAULT '',
    "productName" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "substrate" TEXT NOT NULL,
    "positioning" TEXT NOT NULL,
    "finishingSystem" TEXT NOT NULL,
    "glossLevel" TEXT NOT NULL,
    "referenceStandard" TEXT NOT NULL,
    "mcWood" TEXT NOT NULL DEFAULT '<12%',
    "roomHumidity" TEXT NOT NULL DEFAULT '<80%',
    "roomTemp" TEXT NOT NULL DEFAULT '<35 oC',
    "lineSpeed" TEXT,
    "dryingCondition" TEXT,
    "remark" TEXT,
    "defaultAreaM2" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "preparedByTa" TEXT,
    "checkedByLeader" TEXT,
    "approvedByPdPm" TEXT,
    "customerConfirmName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleStep" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "stepNumber" INTEGER,
    "rowType" "StepRowType" NOT NULL DEFAULT 'CHEMICAL_STEP',
    "stepName" TEXT NOT NULL,
    "sandingSpec" TEXT,
    "caInputRaw" TEXT,
    "caMin" DOUBLE PRECISION,
    "caMax" DOUBLE PRECISION,
    "caAvg" DOUBLE PRECISION,
    "methodName" TEXT,
    "efficiencySnapshot" DOUBLE PRECISION,
    "dryingTime" TEXT,
    "stepRemark" TEXT,

    CONSTRAINT "ScheduleStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleStepItem" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "itemOrder" INTEGER NOT NULL,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "packingDesc" TEXT,
    "nettWeight" DOUBLE PRECISION,
    "mixingRatio" DOUBLE PRECISION NOT NULL,
    "visco" DOUBLE PRECISION,
    "priceSnapshotVnd" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScheduleStepItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerId_key" ON "Customer"("customerId");

-- CreateIndex
CREATE INDEX "Customer_shortName_idx" ON "Customer"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "PackingMapping_code_key" ON "PackingMapping"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationStepMaster_stepName_key" ON "ApplicationStepMaster"("stepName");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationMethod_methodName_key" ON "ApplicationMethod"("methodName");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationItem_custProductKey_key" ON "QuotationItem"("custProductKey");

-- CreateIndex
CREATE INDEX "QuotationItem_sapCustomerCode_idx" ON "QuotationItem"("sapCustomerCode");

-- CreateIndex
CREATE INDEX "QuotationItem_materialCode_idx" ON "QuotationItem"("materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationItem_sapCustomerCode_materialCode_key" ON "QuotationItem"("sapCustomerCode", "materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRevision_projectId_revisionNo_key" ON "ProjectRevision"("projectId", "revisionNo");

-- CreateIndex
CREATE INDEX "ScheduleStep_revisionId_stepOrder_idx" ON "ScheduleStep"("revisionId", "stepOrder");

-- CreateIndex
CREATE INDEX "ScheduleStepItem_stepId_itemOrder_idx" ON "ScheduleStepItem"("stepId", "itemOrder");

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_customerRefId_fkey" FOREIGN KEY ("customerRefId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRevision" ADD CONSTRAINT "ProjectRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleStep" ADD CONSTRAINT "ScheduleStep_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ProjectRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleStepItem" ADD CONSTRAINT "ScheduleStepItem_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ScheduleStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

