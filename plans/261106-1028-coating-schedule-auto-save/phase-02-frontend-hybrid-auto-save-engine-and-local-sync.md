---
title: "Phase 02: Frontend Hybrid Auto-Save Engine & Local State Sync"
phase: 2
status: completed
effort: "1.5h"
tags: [frontend, auto-save, state-sync, debounce, single-flight, performance]
---

# Phase 02: Frontend Hybrid Auto-Save Engine & Local State Sync

## Mục tiêu
Xây dựng bộ máy Auto-Save thông minh tại [`App.tsx`](../../apps/frontend/src/App.tsx) hỗ trợ phân loại thay đổi (`discrete` 300ms vs `typing` 800ms + `blur` flush 0ms), hàng đợi Single-Flight chống chồng chéo request, cập nhật Sidebar `projects` trực tiếp trên bộ nhớ (không gọi `GET /api/projects`), và bảo vệ tuyệt đối focus con trỏ của người dùng.

## Các bước thực hiện

### 1. Định nghĩa Trạng thái & Chữ ký Dữ liệu (Dirty Signature) (`apps/frontend/src/App.tsx`)
- Tạo kiểu trạng thái Auto-Save:
  ```ts
  export type AutoSaveStatus = 'IDLE' | 'PENDING' | 'SAVING' | 'SAVED' | 'ERROR';
  ```
- Bổ sung các state và ref điều phối trong `App.tsx`:
  - `autoSaveStatus`: `'IDLE' | 'PENDING' | 'SAVING' | 'SAVED' | 'ERROR'`
  - `lastSavedAt`: `string | null` (lưu giờ `HH:mm:ss` của lần lưu thành công gần nhất)
  - `autoSaveError`: `string | null`
  - `lastSavedSignatureRef`: `React.useRef<string>('')` — hàm `computeRevisionSignature(rev: ProjectRevision, area: number): string` tạo chuỗi JSON chuẩn hóa của các trường có thể chỉnh sửa trên Revision (`customer.id`, `projectCode`, `scheduleDate`, `productName`, `colorName`, `substrate`, `positioning`, `finishingSystem`, `glossLevel`, `referenceStandard`, `mcWood`, `roomHumidity`, `roomTemp`, `lineSpeed`, `dryingCondition`, `remark`, `defaultAreaM2 / area`, chữ ký và mảng `steps` + `items`).
  - Mỗi khi nạp một Revision từ Server (`loadAllData`, `onSelectRevision`, `popstate`, `handleCloneRevision`), cập nhật ngay `lastSavedSignatureRef.current = computeRevisionSignature(loadedRev, loadedArea)` và đặt `autoSaveStatus = 'IDLE'`.

### 2. Cơ chế Single-Flight Queue & Local State Patching (`apps/frontend/src/App.tsx`)
- Xây dựng hàm `performAutoSave(revToSave: ProjectRevision, areaToSave: number)`:
  - Kiểm tra điều kiện được phép lưu:
    - `revToSave` tồn tại và `revToSave.status === 'DRAFT'`.
    - Không bị khóa bởi phạm vi Salesman (`!isCustomerOutOfScope`).
  - Kiểm tra chữ ký: nếu `computeRevisionSignature(revToSave, areaToSave) === lastSavedSignatureRef.current`, chuyển trạng thái về `'SAVED'` (hoặc `'IDLE'`) và thoát ngay, **không gọi API**.
  - **Single-Flight Lock (`inFlightSaveRef`)**:
    - Nếu `inFlightSaveRef.current === true`: ghi nhận bản mới nhất vào `queuedSaveRef.current = { rev: revToSave, area: areaToSave }` rồi thoát. Khi request đang chạy hoàn tất (trong khối `finally`), nếu `queuedSaveRef.current` có dữ liệu thì tự động chạy tiếp 1 lần cho bản mới nhất đó.
  - Khi gọi `apiClient.updateRevision(role, revToSave.id, { ...revToSave, customerId: revToSave.customer.id, defaultAreaM2: areaToSave })`:
    - Cập nhật `lastSavedSignatureRef.current = sentSignature`.
    - **Không gọi `setActiveRevision(res.revision)` đè lên state đang gõ** nếu người dùng vẫn đang ở cùng Revision đó (chỉ đồng bộ nhẹ các trường giá/tên vật tư được enrich nếu ở client đang trống, hoặc vì `CoatingScheduleEditor` đã tự enrich `materialName`, `priceSnapshotVnd`, `packingDesc`, `nettWeight`, `efficiencySnapshot` và `caAvg` ngay tại client khi người dùng chọn vật tư/phương pháp, nên state tại client đã đầy đủ 100%).
    - **Local Sidebar State Patching (Thay thế `apiClient.getProjects(role)`)**:
      - Cập nhật trực tiếp mảng `projects` trong bộ nhớ bằng `setProjects((prev) => ...)`:
        - Cập nhật `projectCode` và `customer` nếu người dùng đổi Mã hồ sơ hoặc Khách hàng ở phần Header.
        - Cập nhật phần tử revision tương ứng trong `project.revisions`: `productName`, `colorName`, `substrate`, `finishingSystem`, `scheduleDate`, `stepCount` (số bước `CHEMICAL_STEP`), `totalCoatingCostDisplay` (từ `res.costSummary?.totalCoatingCostDisplay` hoặc `liveCostSummary`), và `updatedAt: res.revision.updatedAt`.

### 3. Bộ hẹn giờ Hybrid (300ms Discrete / 800ms Typing / 0ms Flush) (`apps/frontend/src/App.tsx`)
- Khi `CoatingScheduleEditor` gọi `onChangeRevision(updated, mode)`:
  - Cập nhật `setActiveRevision(updated)` ngay lập tức để UI và bảng tính Coating Cost (`CC`) / `BOM` nhảy số real-time.
  - Đặt `autoSaveStatus = 'PENDING'`.
  - Xóa timer cũ (`clearTimeout(autoSaveTimerRef.current)`).
  - Đặt timer mới:
    - Nếu `mode === 'discrete'` (thêm/xóa/di chuyển bước, thêm/xóa SP, chọn combobox): **300ms**.
    - Nếu `mode === 'typing'` (gõ phím vào ô input): **800ms**.
- Hàm `flushAutoSave()`:
  - Nếu đang có timer chờ (`autoSaveTimerRef.current`), hủy timer và gọi `performAutoSave(latestRevisionRef.current, latestAreaRef.current)` ngay lập tức (0ms).
  - Gắn `flushAutoSave()` vào:
    1. Sự kiện `onFlushAutoSave` từ `CoatingScheduleEditor` (khi người dùng rời ô input `onBlurCapture` hoặc nhấn `Ctrl+S`).
    2. Trước khi chuyển sang Revision khác ở Sidebar / Project Explorer / Reports.
    3. Trước khi gọi `handleCloneRevision` hoặc `handleOpenStatusChangeModal('APPROVED')`.

### 4. Tách bạch Kiểm tra Bắt buộc (`validateRevisionBeforeSave`)
- Trong lúc làm nháp (`DRAFT`), Auto-Save **không** gọi `validateRevisionBeforeSave` để chặn lưu.
- Khi người dùng bấm **`Approve / Phê duyệt (APPROVED)`**:
  - Gọi `await flushAutoSave()` để đảm bảo thay đổi cuối cùng đã nằm trên DB.
  - Chạy `validateRevisionBeforeSave(activeRevision)` — nếu còn trường bắt buộc bị bỏ trống, hiển thị khung cảnh báo `validationErrors` và cuộn tới phần cần điền.

## Tiêu chí hoàn thành (Verification)
- [x] Sửa nhiều ô liên tiếp chỉ tạo các request `PUT /api/revisions/:id` đã được gom nhóm, tuyệt đối không gọi `GET /api/projects`.
- [x] Chuyển qua lại giữa các Revision hoặc bấm `Approve` luôn tự động lưu hết các thay đổi vừa gõ trước đó.

