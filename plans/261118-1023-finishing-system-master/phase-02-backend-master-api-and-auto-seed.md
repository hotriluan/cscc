# Phase 2 — Backend Master Store, Auto-Seed & REST Endpoints

## Context
Tầng Backend cần tự động tạo bảng `FinishingSystemMaster` trong PostgreSQL nếu chưa có, quét toàn bộ giá trị `finishingSystem` đang có trong bảng `ProjectRevision` để nạp vào Master (tránh mất dữ liệu cũ), và cung cấp đầy đủ các API CRUD `/api/master/finishing-systems`.

## Requirements
1. **Auto-Migration & Auto-Backfill (`apps/backend/src/store/data-store.ts`):**
   - Trong `init()`:
     - Thực thi SQL an toàn tạo bảng và unique index:
       ```sql
       CREATE TABLE IF NOT EXISTS "FinishingSystemMaster" (
         "id" TEXT NOT NULL,
         "systemName" TEXT NOT NULL,
         "sortOrder" INTEGER NOT NULL DEFAULT 0,
         CONSTRAINT "FinishingSystemMaster_pkey" PRIMARY KEY ("id")
       );
       CREATE UNIQUE INDEX IF NOT EXISTS "FinishingSystemMaster_systemName_key"
       ON "FinishingSystemMaster"("systemName");
       ```
     - Gọi `await this.ensureFinishingSystemsSeeded()`:
       - Đọc toàn bộ bản ghi hiện có trong `prisma.finishingSystemMaster.findMany()` và toàn bộ `finishingSystem` từ `prisma.projectRevision.findMany({ select: { finishingSystem: true } })`.
       - Thu thập tất cả tên hệ sơn khác rỗng từ `ProjectRevision` (chuẩn hóa `.trim().toUpperCase()`). Nếu bảng `FinishingSystemMaster` đang hoàn toàn trống, bổ sung thêm các hệ sơn mặc định cơ bản (`WATERBASE`, `NC-PU`, `PU`, `NC`, `UV`, `ACRYLIC`) bên cạnh các hệ sơn quét từ `ProjectRevision`.
       - Với mỗi tên hệ sơn chưa tồn tại trong `FinishingSystemMaster`, tự động insert vào bảng với `sortOrder` tăng dần.
   - Bổ sung `finishingSystems: number` vào `StoreCounts` và `getCounts()`.
2. **CRUD Methods trong `DataStore` (`apps/backend/src/store/data-store.ts`):**
   - `getFinishingSystems(): Promise<FinishingSystemMaster[]>` — sắp xếp theo `sortOrder: 'asc'`, sau đó `systemName: 'asc'`.
   - `upsertFinishingSystem(input: { systemName: string; sortOrder?: number }): Promise<{ finishingSystem: FinishingSystemMaster; created: boolean }>` — chuẩn hóa `systemName.trim().toUpperCase()`, nếu đã tồn tại trả về bản ghi hiện có (`created: false`), nếu chưa có thì tạo mới (`id: 'fs-master-' + Date.now().toString(36)`).
   - `updateFinishingSystem(id: string, input: Partial<FinishingSystemMaster>): Promise<FinishingSystemMaster | null>` — cập nhật `systemName` (chuẩn hóa uppercase) và/hoặc `sortOrder`.
   - `deleteFinishingSystem(id: string): Promise<void>` — xóa bản ghi theo `id`.
3. **REST API Routes (`apps/backend/src/app.ts`):**
   - `GET /api/master/finishing-systems` $\rightarrow$ trả về danh sách `FinishingSystemMaster[]`.
   - `POST /api/master/finishing-systems` $\rightarrow$ kiểm tra `systemName` bắt buộc, gọi `dataStore.upsertFinishingSystem`, trả về `201` (mới) hoặc `200` (đã tồn tại).
   - `PUT /api/master/finishing-systems/:id` $\rightarrow$ gọi `dataStore.updateFinishingSystem`, trả về `404` nếu không tìm thấy.
   - `DELETE /api/master/finishing-systems/:id` $\rightarrow$ gọi `dataStore.deleteFinishingSystem`, trả về `{ deleted: true }`.

## Files
- Modify: `apps/backend/src/store/data-store.ts`
- Modify: `apps/backend/src/app.ts`

## Steps
1. Cập nhật `apps/backend/src/store/data-store.ts`: thêm DDL `CREATE TABLE IF NOT EXISTS "FinishingSystemMaster"`, hàm `ensureFinishingSystemsSeeded()`, cập nhật `getCounts()`, và thêm 4 hàm CRUD cho `FinishingSystemMaster`.
2. Cập nhật `apps/backend/src/app.ts`: thêm 4 endpoints `/api/master/finishing-systems` ngay sau nhóm `/api/master/steps`.
3. Chạy typecheck và build cho `@cscc/backend`.

## Validation
- `npm run typecheck --workspace=@cscc/backend` và `npm run build --workspace=@cscc/backend` thành công 100%.

## Risk / Rollback
- Nếu `upsertFinishingSystem` hoặc `updateFinishingSystem` đổi `systemName` trùng với một hệ sơn khác đã có trong bảng, cần kiểm tra trùng tên và ném `BusinessValidationError(409, 'DUPLICATE_FINISHING_SYSTEM', ...)` thay vì lỗi 500 từ Prisma. Rollback: hoàn tác `data-store.ts` và `app.ts`.
