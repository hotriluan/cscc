---
title: "Phase 03: Toolbar Auto-Save Status Pill & Editor Event Wiring"
phase: 3
status: completed
effort: "1h"
tags: [frontend, ui, ux, coating-schedule, toolbar]
---

# Phase 03: Toolbar Auto-Save Status Pill & Editor Event Wiring

## Mục tiêu
Thay thế nút `Save / Lưu hồ sơ` thủ công trên thanh công cụ bằng `Auto-Save Status Pill` hiện đại, trực quan; đồng thời gắn phân loại sự kiện (`discrete` vs `typing`), sự kiện chuyển field (`onBlurCapture`) và phím tắt `Ctrl+S` trong `CoatingScheduleEditor.tsx`.

## Các bước thực hiện

### 1. Nâng cấp `CoatingScheduleEditor.tsx` (`apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`)
- Mở rộng interface `CoatingScheduleEditorProps`:
  ```ts
  export type RevisionChangeMode = 'discrete' | 'typing';

  interface CoatingScheduleEditorProps {
    ...
    onChangeRevision: (updated: ProjectRevision, mode?: RevisionChangeMode) => void;
    onFlushAutoSave?: () => void;
  }
  ```
- **Chuẩn hóa ID khi tạo mới Bước / Vật tư / Nhân bản**:
  - `createNewChemicalStepObject`: đặt `stepId = "${revision.id}-step-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}"`.
  - `createNewSandingStepObject`: đặt `id = "${revision.id}-sanding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}"`.
  - `handleDuplicateStep`: đặt `newStepId = "${revision.id}-step-dup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}"`.
  - Nhờ đó, ID tạo ở Client khớp hoàn toàn với quy ước khóa chính của Backend và không bao giờ bị đổi sau khi lưu.
- **Gắn đúng `mode` cho từng nhóm thao tác**:
  - Truyền `'discrete'` cho:
    - `handleCustomerSelect` (chọn Khách hàng)
    - `handleInsertChemicalStep` (`+ Thêm bước`)
    - `handleInsertSandingRow` (`Chèn nhám`)
    - `handleDuplicateStep` (`Nhân bản bước`)
    - `handleMoveStep` (`Di chuyển bước lên/xuống`)
    - `handleDeleteStep` (`Xóa bước`)
    - `handleAddItemToStep` (`+ Thêm vật tư`)
    - `handleDeleteItemFromStep` (`Xóa vật tư`)
    - Chọn `stepName` từ `SearchableCombobox`
    - Chọn `methodName` từ `SearchableCombobox`
    - Chọn `materialCode` từ `SearchableCombobox`
    - Đổi `scheduleDate` (`<input type="date">`)
  - Truyền `'typing'` cho:
    - Gõ vào các ô text/number ở Header, bảng Steps/Items (`sandingSpec`, `mixingRatio`, `visco`, `caInputRaw`, `dryingTime`) và phần Chữ ký cuối bảng.
- **Tự động Flush khi chuyển Field (`onBlurCapture`)**:
  - Trên thẻ bao ngoài của `CoatingScheduleEditor`, bắt sự kiện `onBlurCapture={(e) => ...}`: khi sự kiện blur phát sinh từ một thẻ `<input>`, `<textarea>`, hoặc `<select>` (tức người dùng vừa nhấn `Tab` sang ô khác hoặc click ra ngoài sau khi gõ), gọi `onFlushAutoSave?.()` để lưu ngay lập tức các thay đổi đang chờ debounce.

### 2. Thay nút Save bằng `Auto-Save Status Pill` & Phím tắt `Ctrl+S` (`apps/frontend/src/App.tsx`)
- Đăng ký lắng nghe phím tắt `Ctrl+S` / `Cmd+S` (`window.addEventListener('keydown', ...)` khi đang ở `WORKSPACE`):
  - Gọi `e.preventDefault()` để chặn hộp thoại lưu trang của trình duyệt.
  - Gọi `flushAutoSave()` để lưu tức thì và hiển thị trạng thái `✓ Đã tự động lưu`.
- Trên thanh Header Toolbar của `WORKSPACE` (dòng ~1273 của `App.tsx`):
  - Xóa nút `<button>Save / Lưu hồ sơ</button>` cũ.
  - Khi hồ sơ đang ở trạng thái `DRAFT` (có quyền sửa), hiển thị **`Auto-Save Status Pill`**:
    - Trạng thái `PENDING` / `SAVING`:
      - Giao diện: Viên thuốc (pill) viền xanh dương nhạt `bg-blue-50 text-blue-700 border-blue-200`, biểu tượng đồng bộ xoay nhẹ (`Loader2` hoặc `RefreshCw animate-spin`), nội dung: **`Saving... / Đang tự động lưu...`** (cho phép click vào để flush ngay).
    - Trạng thái `SAVED` / `IDLE`:
      - Giao diện: Viên thuốc viền xanh ngọc dịu `bg-emerald-50/80 text-emerald-800 border-emerald-200`, biểu tượng `CheckCircle2`, nội dung: **`Auto-saved / Đã tự động lưu`** (kèm giờ lưu `lastSavedAt` ở `title` tooltip).
    - Trạng thái `ERROR`:
      - Giao diện: Nút cảnh báo `bg-red-50 text-red-700 border-red-300 hover:bg-red-100`, biểu tượng `AlertTriangle`, nội dung: **`Save failed — Retry / Lỗi tự động lưu — Thử lại`** (bấm vào gọi `flushAutoSave()`).

## Tiêu chí hoàn thành (Verification)
- [x] Thanh công cụ không còn nút Save truyền thống, thay bằng `Auto-Save Status Pill` rõ ràng, tinh tế.
- [x] Khi đang gõ ở 1 ô và nhấn `Tab` chuyển sang ô kế tiếp, `onBlurCapture` kích hoạt lưu ngay mà con trỏ ở ô kế tiếp vẫn gõ tiếp mượt mà.
- [x] Nhấn `Ctrl+S` trên bàn phím kích hoạt flush lưu ngay và không bị bật cửa sổ Save As của trình duyệt.

