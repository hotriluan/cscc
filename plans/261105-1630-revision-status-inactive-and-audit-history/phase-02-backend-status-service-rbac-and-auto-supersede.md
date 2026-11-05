---
title: "Phase 02: Backend Status Service, RBAC & Auto-Supersede"
phase: 2
status: pending
effort: "2h"
tags: [backend, rbac, status-workflow, transaction, auto-supersede]
---

# Phase 02: Backend Status Service, RBAC & Auto-Supersede

## Mục tiêu
Triển khai kiểm soát phân quyền RBAC (chặn `TECHNICAL` và `SALES` thay đổi trạng thái), kiểm tra quy tắc chuyển đổi trạng thái hợp lệ (chỉ chuyển sang `INACTIVE` từ `APPROVED`, bắt buộc có lý do), tự động chuyển các bản `APPROVED` cũ trong cùng Project sang `INACTIVE` khi duyệt bản mới, và khóa chỉnh sửa/xóa đối với bản `INACTIVE`.

## Các bước thực hiện

### 1. Bổ sung Middleware Phân quyền Đổi Trạng thái (`apps/backend/src/middleware/auth-rbac.middleware.ts`)
- Tạo `requireStatusChangeAccessMiddleware`:
  - Kiểm tra `req.userRole`: nếu là `TECHNICAL` hoặc `SALES` (tức không phải `PROJECT_LEADER` và `ADMIN`), trả về `403 Forbidden`:
    ```json
    {
      "error": "FORBIDDEN_STATUS_CHANGE",
      "message": "Tài khoản Kỹ thuật viên (TECHNICAL) và Kinh doanh (SALES) không có quyền thay đổi trạng thái phê duyệt của hồ sơ. Chỉ Project Leader và Admin mới được phép thực hiện."
    }
    ```

### 2. Nâng cấp Logic Đổi Trạng thái & Auto-Supersede (`apps/backend/src/services/revision.service.ts`)
- Cập nhật hàm `updateRevisionStatus(params)` nhận:
  - `revisionId: string`
  - `targetStatus: RevisionStatus` (`'DRAFT' | 'APPROVED' | 'INACTIVE'`)
  - `note: string` (Lý do thay đổi — **bắt buộc**)
  - `actor: { userId?: string | null; fullName: string; role: UserRole }`
- **Kiểm tra hợp lệ (Validation)**:
  1. Kiểm tra `note.trim()`: nếu rỗng, ném lỗi `REASON_REQUIRED` (`400 Bad Request`: *"Vui lòng nhập lý do thay đổi trạng thái hồ sơ."*).
  2. Nếu `existing.status === targetStatus`: ném lỗi `SAME_STATUS` (`400 Bad Request`).
  3. **Quy tắc chuyển sang `INACTIVE`**: Nếu `targetStatus === 'INACTIVE'` và `existing.status !== 'APPROVED' && existing.status !== 'LOCKED'`, ném lỗi `INVALID_STATUS_TRANSITION` (`400 Bad Request`: *"Chỉ có thể chuyển sang trạng thái Ngưng hiệu lực (INACTIVE) từ hồ sơ đang Đã duyệt (APPROVED)."*).
- **Thực thi Transaction (`prisma.$transaction`)**:
  1. Cập nhật `ProjectRevision` hiện tại sang `targetStatus`.
  2. Tạo bản ghi `RevisionStatusHistory` cho Revision hiện tại (`fromStatus: existing.status`, `toStatus: targetStatus`, `note: note.trim()`, `isAutoSupersede: false`, cùng thông tin người thực hiện).
  3. **Auto-supersede khi `targetStatus === 'APPROVED'`**:
     - Tìm tất cả các `ProjectRevision` khác trong cùng `projectId` (`id !== revisionId`) đang có `status IN ('APPROVED', 'LOCKED')`.
     - Nếu có, cập nhật toàn bộ các Revision đó sang `status = 'INACTIVE'`.
     - Với mỗi Revision cũ vừa bị thay thế, tạo 1 bản ghi `RevisionStatusHistory` với:
       - `fromStatus: 'APPROVED'`, `toStatus: 'INACTIVE'`
       - `isAutoSupersede: true`
       - `note: "Tự động chuyển sang INACTIVE do phiên bản Rev XX được phê duyệt thay thế. Lý do duyệt Rev XX: <note>"`
       - Thông tin `changedByUserId`, `changedByName`, `changedByRole` của người vừa bấm duyệt.
- Bổ sung hàm `getRevisionStatusHistory(revisionId: string)` và tích hợp `statusHistory` vào `dataStore.getRevisionById(id)`.

### 3. Khóa Chỉnh sửa / Xóa / Làm mới giá cho Hồ sơ `INACTIVE` (`apps/backend/src/store/data-store.ts`)
- Cập nhật các hàm kiểm tra khóa hồ sơ tại `dataStore`:
  - `deleteRevision`: chặn xóa nếu `rev.status === 'APPROVED' || rev.status === 'INACTIVE' || rev.status === 'LOCKED'`.
  - `updateRevision`: chặn chỉnh sửa nếu `existing.status === 'APPROVED' || existing.status === 'INACTIVE' || existing.status === 'LOCKED'`.
  - `refreshRevisionPrices`: chặn làm mới giá nếu `existing.status === 'APPROVED' || existing.status === 'INACTIVE' || existing.status === 'LOCKED'`.

### 4. Cập nhật API Endpoints (`apps/backend/src/app.ts`) & Báo cáo (`apps/backend/src/services/report.service.ts`)
- Tại `PATCH /api/revisions/:id/status`:
  - Gắn `requireStatusChangeAccessMiddleware`.
  - Lấy thông tin người thao tác từ `req.authUser` (hoặc tên mặc định theo `req.userRole` khi dùng chế độ demo role switcher).
  - Truyền `status`, `note` vào `updateRevisionStatus` và trả về mã `400` cho các lỗi nghiệp vụ (`REASON_REQUIRED`, `INVALID_STATUS_TRANSITION`).
- Bổ sung `GET /api/revisions/:id/status-history` để lấy danh sách lịch sử thay đổi trạng thái của một Revision.
- Tại `report.service.ts`: đảm bảo bộ lọc `scope === 'APPROVED'` chỉ giữ lại các bản đang `APPROVED` (có hiệu lực), không tính các bản `INACTIVE` vào số lượng `approvedRevisions` đang hiệu lực.

## Tiêu chí hoàn thành (Verification)
- [ ] `PATCH /api/revisions/:id/status` trả về `403` khi gọi bằng `TECHNICAL` hoặc `SALES`.
- [ ] `PATCH /api/revisions/:id/status` trả về `400` khi thiếu `note` hoặc khi chuyển từ `DRAFT` sang `INACTIVE`.
- [ ] Khi duyệt `Rev 01` sang `APPROVED`, `Rev 00` (đang `APPROVED` cùng Project) tự động đổi thành `INACTIVE` và cả 2 đều có lịch sử trong `RevisionStatusHistory`.
- [ ] Hồ sơ `INACTIVE` bị chặn sửa, xóa và làm mới giá tại Backend.

