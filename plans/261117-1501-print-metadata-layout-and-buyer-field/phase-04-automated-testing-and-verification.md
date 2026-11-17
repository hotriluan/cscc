# Phase 4 — Automated Testing & End-to-End Verification

## Context
Đảm bảo trường `buyer` mới (kể cả khi nhập giá trị hoặc khi để trống) hoạt động chính xác qua toàn bộ vòng đời Dự án (Tạo mới $\rightarrow$ Cập nhật CS $\rightarrow$ Clone Rev $\rightarrow$ Xuất Excel) và không ảnh hưởng tới bất kỳ bài test hiện có nào.

## Requirements
1. **Unit / Integration Tests (`apps/backend/test/`):**
   - Kiểm tra tạo dự án mới không truyền `buyer` (mặc định `""`) và có truyền `buyer` (VD `"IKEA"`).
   - Kiểm tra `PUT /api/revisions/:id` cập nhật `buyer` và `referenceStandard`.
   - Kiểm tra `POST /api/revisions/:id/clone` sao chép nguyên vẹn `buyer` sang phiên bản mới.
   - Kiểm tra xuất file Excel (`generateRevisionWorkbook`) có chứa nhãn `Buyer / Nhà mua hàng:` và giá trị tương ứng.
2. **Full Monorepo Verification:**
   - Chạy toàn bộ test suite và build cho `@cscc/shared`, `@cscc/backend`, `@cscc/frontend`.

## Files
- Modify: `apps/backend/test/auto-project-code.test.ts`

## Steps
1. Bổ sung test case kiểm tra vòng đời trường `buyer` (optional create, update, clone, export) vào `apps/backend/test/auto-project-code.test.ts`.
2. Chạy `npm test`, `npm run typecheck` và `npm run build` trên toàn bộ workspace.

## Validation
- Toàn bộ bài test trong `packages/shared` và `apps/backend` PASS 100%.
- `npm run build` thành công cho cả 3 workspace.

## Risk / Rollback
- Không có rủi ro phá vỡ logic hiện hữu.
