---
title: "Phase 01: Backend Stable IDs & Lightweight Draft Save"
phase: 1
status: completed
effort: "1h"
tags: [backend, prisma, performance, stable-ids, auto-save]
---

# Phase 01: Backend Stable IDs & Lightweight Draft Save

## Mục tiêu
Đảm bảo giao dịch `dataStore.updateRevision` tại Backend (`PUT /api/revisions/:id`) bảo toàn ID ổn định (`step.id` và `item.id`) do Client gửi lên thay vì sinh lại ID ngẫu nhiên theo `Date.now()` sau mỗi lần lưu, đồng thời cho phép lưu nháp (`DRAFT`) mượt mà ngay cả khi bước sơn hoặc vật tư mới thêm chưa điền đủ thông tin.

## Các bước thực hiện

### 1. Bảo toàn `step.id` và `item.id` trong `updateRevision` (`apps/backend/src/store/data-store.ts`)
- Hiện tại tại dòng ~2092 của [`data-store.ts`](../../apps/backend/src/store/data-store.ts):
  ```ts
  id: `${id}-step-${sIdx + 1}-${Date.now().toString(36)}`
  ```
  Việc luôn tạo ID mới khiến mọi bản ghi trả về từ `PUT /api/revisions/:id` hoặc `GET /api/revisions/:id` có `step.id` và `item.id` khác với state đang mở trên trình duyệt.
- **Cách nâng cấp**:
  - Khi chuẩn bị `stepRows` và `itemRows` trong `updateRevision`:
    - Sử dụng một `Set<string>` (`usedStepIds`, `usedItemIds`) để kiểm tra tính duy nhất trong phạm vi revision.
    - Nếu `s.id` từ client là chuỗi hợp lệ, không rỗng và chưa trùng, **giữ nguyên `s.id`** (nếu `s.id` chưa có tiền tố revisionId và có nguy cơ đụng với revision khác khi clone, chuẩn hóa thành `${id}__${s.id}` hoặc giữ nguyên nếu đã bắt đầu bằng `${id}` / `step-` / `sanding-` duy nhất; để an toàn tuyệt đối với khóa chính toàn bảng `ScheduleStep.id` và `ScheduleStepItem.id`, chuẩn hóa: nếu `s.id` đã bắt đầu bằng `${id}-` thì giữ nguyên `s.id`, hoặc ở Frontend khi tạo bước mới trong `CoatingScheduleEditor.tsx` tạo ID có tiền tố `${revision.id}-step-...` để Backend giữ nguyên 100% `s.id` và `it.id`).
    - Kiểm tra trong DB hoặc dùng tiền tố `${id}-`: khi `CoatingScheduleEditor.tsx` tạo `step.id` theo mẫu `${revision.id}-step-${Date.now().toString(36)}-${rand}` và `item.id` theo mẫu `${stepId}-item-...`, ID này vừa duy nhất toàn cục trên PostgreSQL vừa thuộc riêng về revision `id`. Khi đó Backend chỉ cần giữ nguyên `s.id` (nếu bắt đầu bằng `${id}-` và chưa trùng trong `usedStepIds`) và `it.id` (nếu bắt đầu bằng `${sr.id}-` và chưa trùng trong `usedItemIds`).

### 2. Đảm bảo `enrichRevisionStepsWithMasterData` xử lý an toàn các dòng nháp rỗng (`apps/backend/src/store/data-store.ts`)
- Kiểm tra khi `step.stepName === ''`, `step.methodName === ''`, `step.caInputRaw === ''`, `item.materialCode === ''`, `item.mixingRatio === 0`:
  - Nếu `step.methodName` rỗng (`''` hoặc `null`), giữ `efficiencySnapshot: null` thay vì gán cứng `0.6` khi chưa chọn phương pháp, giúp giao diện `CoatingScheduleEditor` phản ánh đúng trạng thái chưa chọn phương pháp thi công.
  - Chỉ bỏ qua truy vấn `prisma.quotationItem.findMany` khi `materialCodes.length === 0` (đã có sẵn, giữ nguyên).

## Tiêu chí hoàn thành (Verification)
- [x] Gọi `PUT /api/revisions/:id` với `step.id` và `item.id` có tiền tố `${revisionId}-...` trả về chính xác cùng `step.id` và `item.id` đó sau khi lưu.
- [x] Lưu một Revision `DRAFT` vừa mới thêm 1 bước sơn trống và 1 bước nhám trống thành công (`200 OK`) mà không phát sinh lỗi.

