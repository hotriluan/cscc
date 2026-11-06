---
title: "Phase 03: Frontend Status Workflow, Reason Modal & History Timeline UI"
phase: 3
status: completed
effort: "2h"
tags: [frontend, ui, status-modal, audit-history, rbac]
---

# Phase 03: Frontend Status Workflow, Reason Modal & History Timeline UI

## Mục tiêu
Cập nhật giao diện quản lý trạng thái và lịch sử phê duyệt trên thanh công cụ Workspace, khóa nút thay đổi trạng thái đối với `TECHNICAL` và `SALES`, xây dựng Modal nhập lý do bắt buộc khi đổi trạng thái, xây dựng Modal/Popover xem lịch sử thay đổi trạng thái và đồng bộ hiển thị `INACTIVE` trên toàn bộ các màn hình.

## Các bước thực hiện

### 1. Cập nhật API Client (`apps/frontend/src/api/client.ts`)
- Cập nhật `updateRevisionStatus`:
  ```typescript
  updateRevisionStatus: (
    role: UserRole,
    id: string,
    status: RevisionStatus,
    note: string
  ) =>
    request<ProjectRevision>(`/revisions/${id}/status`, role, {
      method: 'PATCH',
      body: JSON.stringify({ status, note })
    }),
  getRevisionStatusHistory: (role: UserRole, id: string) =>
    request<RevisionStatusHistoryEntry[]>(`/revisions/${id}/status-history`, role)
  ```

### 2. Giao diện Chọn Trạng thái, Modal Nhập Lý do & Xem Lịch sử (`apps/frontend/src/App.tsx`)
- **Phân quyền hiển thị trên thanh Action Header**:
  - Biến `canChangeStatus = role === 'PROJECT_LEADER' || role === 'ADMIN'`.
  - **Đối với `TECHNICAL` và `SALES` (`!canChangeStatus`)**:
    - Hiển thị Badge trạng thái hiện tại ở chế độ chỉ đọc (`DRAFT / Bản nháp`, `APPROVED / Đã duyệt (Đang hiệu lực)`, `INACTIVE / Đã duyệt (Hết hiệu lực)`), không cho bấm đổi trạng thái.
  - **Đối với `PROJECT_LEADER` và `ADMIN` (`canChangeStatus`)**:
    - Hiển thị nút trạng thái hiện tại kèm các hành động chuyển trạng thái hợp lệ:
      - Nếu đang `DRAFT`: nút **"Approve / Phê duyệt (`APPROVED`)"**.
      - Nếu đang `APPROVED`: nút **"Set Inactive / Ngưng hiệu lực (`INACTIVE`)"** và nút **"Reopen Draft / Mở lại Bản nháp (`DRAFT`)"**.
      - Nếu đang `INACTIVE`: nút **"Reactivate / Khôi phục hiệu lực (`APPROVED`)"** và nút **"Reopen Draft / Mở lại Bản nháp (`DRAFT`)"**.
- **Modal Xác nhận & Nhập Lý do Bắt buộc**:
  - Khi `PROJECT_LEADER` hoặc `ADMIN` chọn chuyển sang trạng thái mới:
    - Nếu chuyển sang `APPROVED` từ `DRAFT`, trước tiên chạy `validateRevisionBeforeSave(activeRevision)` để đảm bảo hồ sơ đầy đủ thông số kỹ thuật.
    - Mở Modal xác nhận hiển thị:
      - Trạng thái hiện tại ➔ Trạng thái mới (`DRAFT` / `APPROVED` / `INACTIVE`).
      - Cảnh báo tự động (nếu chuyển sang `APPROVED` và trong Project đang có bản `APPROVED` khác): *"Lưu ý: Các phiên bản APPROVED cũ của dự án này sẽ tự động chuyển sang INACTIVE."*
      - Ô nhập **Lý do thay đổi trạng thái (`note`)** có đánh dấu sao đỏ `*` (Bắt buộc). Nút "Xác nhận" chỉ cho phép gửi khi đã nhập lý do.
- **Nút & Modal Xem Lịch sử Trạng thái (`Status History`)**:
  - Hiển thị cho **tất cả các role** (`TECHNICAL`, `SALES`, `PROJECT_LEADER`, `ADMIN`) ngay cạnh nhãn trạng thái.
  - Bấm vào mở Modal hiển thị danh sách lịch sử (`statusHistory`) theo thứ tự mới nhất lên đầu:
    - Thời gian (`dd/mm/yyyy HH:mm`), Người thực hiện (`changedByName`) & Vai trò (`changedByRole`).
    - Badge chuyển đổi: `fromStatus` ➔ `toStatus` (kèm nhãn `Auto-supersede / Tự động thay thế` nếu `isAutoSupersede === true`).
    - Nội dung lý do (`note`).

### 3. Đồng bộ Trạng thái `INACTIVE` trên Sidebar, Editor, Explorer & Bản In A4
- **`apps/frontend/src/App.tsx`**:
  - Khóa nút `Save / Lưu hồ sơ` khi `activeRevision.status === 'APPROVED' || activeRevision.status === 'INACTIVE' || activeRevision.status === 'LOCKED'`.
  - Trên danh sách Revision ở Sidebar: hiển thị icon/màu sắc phân biệt rõ `DRAFT`, `APPROVED` (✅ xanh lá), `INACTIVE` (⏸️ cam/xám) và chặn nút xóa (`X`) đối với cả `APPROVED` lẫn `INACTIVE`.
- **`apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`**:
  - Cập nhật `isLocked = revision.status === 'LOCKED' || revision.status === 'APPROVED' || revision.status === 'INACTIVE' || isCustomerOutOfScope`.
  - Cập nhật banner thông báo khóa và nhãn trạng thái trên Header của bảng CS để hiển thị đúng khi hồ sơ là `INACTIVE (ĐÃ DUYỆT - HẾT HIỆU LỰC)`.
- **`apps/frontend/src/components/projects/ProjectExplorerView.tsx`**:
  - Bổ sung bộ lọc trạng thái `'ALL' | 'DRAFT' | 'APPROVED' | 'INACTIVE'` để người dùng dễ dàng lọc riêng các hồ sơ đang hiệu lực (`APPROVED`) hoặc đã ngưng hiệu lực (`INACTIVE`).
  - Hiển thị pill `Rev XX` với màu sắc phân biệt cho `INACTIVE` và ẩn nút xóa (`X`) trên các revision `INACTIVE`.
- **`apps/frontend/src/components/print/PrintableSheetA4.tsx`**:
  - Hiển thị rõ `INACTIVE / HẾT HIỆU LỰC` trên bản in A4 khi in hồ sơ ở trạng thái `INACTIVE`.

## Tiêu chí hoàn thành (Verification)
- [x] Khi chuyển sang role `TECHNICAL` hoặc `SALES`, nút đổi trạng thái bị khóa/ẩn, chỉ xem được trạng thái và mở xem được Lịch sử.
- [x] Khi ở role `PROJECT_LEADER` hoặc `ADMIN`, bấm đổi trạng thái sẽ hiện Modal yêu cầu nhập lý do bắt buộc; ở trạng thái `DRAFT` không có tùy chọn chuyển sang `INACTIVE`.
- [x] Màn hình Lịch sử hiển thị đầy đủ các lần chuyển trạng thái, bao gồm cả bản ghi tự động chuyển `INACTIVE` khi duyệt Revision mới.
- [x] Màn hình Editor, Sidebar, Project Explorer và Print A4 hiển thị đúng trạng thái `INACTIVE` và khóa toàn bộ ô chỉnh sửa.

