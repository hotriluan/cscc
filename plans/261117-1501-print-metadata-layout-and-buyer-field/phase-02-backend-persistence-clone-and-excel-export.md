# Phase 2 — Backend Persistence, Clone & Excel Export

## Context
Sau khi có định nghĩa `buyer` trong Prisma và Shared Types, tầng Backend cần tự động migrate cột `buyer` vào PostgreSQL hiện hữu, lưu/đọc/nhân bản (`clone`) trường `buyer` trên `ProjectRevision`, và đồng bộ xuất file Excel (`.xlsx`).

## Requirements
1. **Auto-Migration & CRUD (`apps/backend/src/store/data-store.ts`):**
   - Trong `init()`: thêm câu lệnh SQL an toàn:
     ```sql
     ALTER TABLE "ProjectRevision" ADD COLUMN IF NOT EXISTS "buyer" TEXT NOT NULL DEFAULT '';
     ```
   - Trong `seedFullDatabase()`: truyền `buyer: revision.buyer ?? ''` khi seed `ProjectRevision`.
   - Trong `getProjects()`: trả thêm `buyer: r.buyer ?? ''` trong `revisions` summary.
   - Trong `createProject(input)`: nhận `buyer?: string` (mặc định `String(input.buyer || '').trim()`) và lưu vào `tx.projectRevision.create`.
   - Trong `getRevisionById(id)`: trả về `buyer: r.buyer ?? ''`.
   - Trong `updateRevision(id, body)`: cập nhật `buyer: body.buyer !== undefined ? String(body.buyer ?? '') : (existing.buyer ?? '')`.
2. **Clone Revision (`apps/backend/src/services/revision.service.ts`):**
   - Trong `cloneRevision()`: sao chép `buyer: source.buyer ?? ''` sang phiên bản mới (`Rev XX`).
3. **Golden Dataset (`apps/backend/src/services/excel-importer.service.ts`):**
   - Trong `buildGoldenDatasetNtr001()`: khởi tạo `buyer: ''` cho `revision`.
4. **Excel Exporter (`apps/backend/src/services/excel-exporter.service.ts`):**
   - Cập nhật phần Header của cả 2 sheet `CS` và `CC` để bao gồm trường `Buyer / Nhà mua hàng: ${revision.buyer || ''}` và `Reference / Tiêu chuẩn tham chiếu: ${revision.referenceStandard || ''}` đồng bộ với bố cục mới.

## Files
- Modify: `apps/backend/src/store/data-store.ts`
- Modify: `apps/backend/src/services/revision.service.ts`
- Modify: `apps/backend/src/services/excel-importer.service.ts`
- Modify: `apps/backend/src/services/excel-exporter.service.ts`

## Steps
1. Cập nhật `data-store.ts` (auto-migration trong `init()`, `seedFullDatabase`, `getProjects`, `createProject`, `getRevisionById`, `updateRevision`).
2. Cập nhật `revision.service.ts` (`cloneRevision` copy `buyer`).
3. Cập nhật `excel-importer.service.ts` (`buildGoldenDatasetNtr001`).
4. Cập nhật `excel-exporter.service.ts` bổ sung hiển thị `Buyer / Nhà mua hàng:`.

## Validation
- `npm run typecheck --workspace=@cscc/backend` và `npm run build --workspace=@cscc/backend` thành công.

## Risk / Rollback
- Nếu cột `buyer` đã tồn tại trong DB, `ADD COLUMN IF NOT EXISTS` là no-op an toàn. Rollback: hoàn tác các file trong `apps/backend/src/`.
