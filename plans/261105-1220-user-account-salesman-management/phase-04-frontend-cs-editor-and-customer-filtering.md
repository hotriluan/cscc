---
title: "Phase 04: Frontend CS Editor, Customer & Quotation Filtering by Salesman (EN/VI)"
phase: 4
status: completed
effort: "1.5h"
tags: [frontend, schedule, quotation, filter, bilingual]
---

# Phase 04: Frontend CS Editor, Customer & Quotation Filtering by Salesman (EN/VI)

## Mục tiêu
Tích hợp cơ chế lọc tự động khách hàng và vật tư báo giá vào giao diện lập Qui trình sơn (Coating Schedule Editor) và màn hình Quản lý Dự án (Project Explorer View). Đảm bảo nhân sự nhóm Sales và Technical TA chỉ thao tác đúng phạm vi khách hàng của Sales man được chỉ định, kèm nhãn hiển thị trạng thái phân quyền song ngữ rõ ràng.

## Các bước thực hiện

### 1. Đồng bộ thông tin người dùng trong State chính (`apps/frontend/src/App.tsx`)
- Khi đăng nhập hoặc đổi role:
  - Lưu trữ thông tin `currentUser` (bao gồm `salesmanName`).
  - Khi tải danh mục Master Data (`reloadMasterData`): truyền token hoặc thông tin phân quyền của user hiện tại xuống Backend để nhận danh sách khách hàng và báo giá đã được lọc theo `salesmanName`.
- Hiển thị thông báo trạng thái tại Header:
  - Nếu user thuộc `SALES` hoặc `TECHNICAL` và có `salesmanName`: hiển thị badge `Salesman: [Tên Salesman] / Phụ trách: [Tên Salesman]`.

### 2. Cập nhật Giao diện Chọn Khách hàng trong Qui trình sơn (`CoatingScheduleEditor.tsx`)
- **Tập hợp danh sách khách hàng được phép chọn:**
  - Danh sách `customerOptions` chỉ hiển thị những khách hàng thuộc Sales man của user.
  - Trường hợp đang mở một Revision cũ mà khách hàng không thuộc Salesman hiện tại: hiển thị cảnh báo chỉ xem (Read-only view).
- **Nhãn hiển thị song ngữ:**
  - Label: `Customer / Khách hàng (Search name or SAP ID / Tìm tên hoặc mã SAP)`
  - Sublabel gợi ý: `Showing customers for Salesman: [Tên] / Đang hiển thị KH của Sales: [Tên]`
  - Nếu danh sách trống: `No customers assigned to this Salesman / Không có khách hàng nào thuộc Sales man này`.

### 3. Tra cứu Vật tư Báo giá trong các bước thi công (`CoatingScheduleEditor.tsx`)
- Khi người dùng thêm dòng hóa chất mới trong bước thi công:
  - Dropdown tìm kiếm `Product Code` tự động lọc theo danh mục `quotations` của khách hàng đang được chọn.
  - Do khách hàng đã bị giới hạn theo Salesman nên toàn bộ vật tư báo giá và đơn giá (đối với Sales) cũng tự động giới hạn chính xác theo khách hàng đó.

### 4. Cập nhật Màn hình Quản lý Dự án (`ProjectExplorerView.tsx`)
- Khi user thuộc nhóm `SALES` hoặc `TECHNICAL`:
  - Danh sách dự án (Projects & Revisions) chỉ hiển thị các dự án của những khách hàng thuộc Sales man tương ứng.
  - Dropdown lọc theo khách hàng trong Project Explorer chỉ bao gồm khách hàng của Sales man đó.
  - Nút `Create Project / Tạo dự án mới`: chỉ cho phép chọn khách hàng thuộc Sales man của user.

## Tiêu chí hoàn thành (Verification)
- [ ] Đăng nhập tài khoản Technical/Sales có Salesman "Nguyễn Văn A":
  - Mở dropdown chọn khách hàng: Chỉ thấy các khách hàng có `salesmanName === "Nguyễn Văn A"`.
  - Mở danh sách dự án: Chỉ thấy các dự án thuộc khách hàng của "Nguyễn Văn A".
- [ ] Đăng nhập tài khoản Admin/Project Leader:
  - Thấy đầy đủ tất cả khách hàng và dự án của toàn công ty.
- [ ] Mọi thông báo hướng dẫn và trạng thái đều có song ngữ `English / Tiếng Việt`.

