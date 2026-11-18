# Phase 1 — Shared Types & Prisma Database Schema

## Context
Bảng Master mới `FinishingSystemMaster` cần có định nghĩa kiểu dùng chung trong `@cscc/shared` và model trong Prisma Schema (`apps/backend/prisma/schema.prisma`) với cấu trúc đồng bộ hoàn toàn với `ApplicationStepMaster` (`id`, `systemName`, `sortOrder`).

## Requirements
1. **Shared Types (`packages/shared/src/types.ts`):**
   - Bổ sung interface `FinishingSystemMaster` ngay bên dưới `ApplicationStepMaster`:
     ```ts
     export interface FinishingSystemMaster {
       id: string;
       systemName: string;
       sortOrder: number;
     }
     ```
2. **Prisma Schema (`apps/backend/prisma/schema.prisma`):**
   - Bổ sung model `FinishingSystemMaster` ngay cạnh `ApplicationStepMaster`:
     ```prisma
     model FinishingSystemMaster {
       id         String @id @default(uuid())
       systemName String @unique // e.g., "WATERBASE", "NC-PU", "PU", "UV"
       sortOrder  Int    @default(0)
     }
     ```

## Files
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/backend/prisma/schema.prisma`

## Steps
1. Cập nhật `packages/shared/src/types.ts` thêm `FinishingSystemMaster`.
2. Cập nhật `apps/backend/prisma/schema.prisma` thêm model `FinishingSystemMaster`.
3. Chạy `npm run build --workspace=@cscc/shared` và `npx prisma generate --schema=apps/backend/prisma/schema.prisma`.

## Validation
- `npm run build --workspace=@cscc/shared` thành công 100%.
- `npx prisma generate --schema=apps/backend/prisma/schema.prisma` sinh Prisma Client có `prisma.finishingSystemMaster`.

## Risk / Rollback
- Thêm model độc lập không làm thay đổi các bảng hiện có. Rollback: hoàn tác thay đổi trên 2 file.
