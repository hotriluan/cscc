-- AlterTable
ALTER TABLE "ScheduleStep" ADD COLUMN IF NOT EXISTS "visco" TEXT;

-- AlterTable
ALTER TABLE "ScheduleStepItem" ALTER COLUMN "visco" TYPE TEXT USING "visco"::TEXT;

