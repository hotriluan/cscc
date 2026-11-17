# Phase 1 — Shared Types & Prisma Database Schema

## Context
Trường mới `Buyer / Nhà mua hàng` (`buyer`) cần được định nghĩa thống nhất trong gói `@cscc/shared` và schema PostgreSQL (`apps/backend/prisma/schema.prisma`) trước khi tầng Backend và Frontend sử dụng.

## Requirements
1. **Shared Types (`packages/shared/src/types.ts`):**
   - Trong `ProjectRevisionSummary`: bổ sung `buyer?: string;` (tùy chọn để hiển thị/tìm kiếm nhanh trên danh sách dự án).
   - Trong `ProjectRevision`: bổ sung `buyer?: string;` (mặc định `""` khi khởi tạo hoặc đọc từ DB).
2. **Prisma Schema (`apps/backend/prisma/schema.prisma`):**
   - Trong model `ProjectRevision`: bổ sung cột `buyer String @default("")` ngay cạnh nhóm Header metadata (`productName`, `colorName`, `substrate`, `positioning`, `finishingSystem`, `glossLevel`, `referenceStandard`).

## Files
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/backend/prisma/schema.prisma`

## Steps
1. Cập nhật `packages/shared/src/types.ts` thêm `buyer?: string;` vào `ProjectRevisionSummary` và `ProjectRevision`.
2. Cập nhật `apps/backend/prisma/schema.prisma` thêm `buyer String @default("")` vào `ProjectRevision`.
3. Chạy `npx prisma generate` trong `apps/backend` và build lại `@cscc/shared`.

## Validation
- `npm run build --workspace=@cscc/shared` thành công 100%.
- `npx prisma generate --schema=apps/backend/prisma/schema.prisma` thành công.

## Risk / Rollback
- Trường `buyer` có giá trị mặc định `""` và là optional trên DTO nên hoàn toàn tương thích ngược với mọi payload cũ. Rollback: hoàn tác thay đổi trên 2 file.
