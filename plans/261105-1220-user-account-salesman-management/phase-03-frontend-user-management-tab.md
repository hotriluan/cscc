---
title: "Phase 03: Frontend User Management Tab & Form (Admin Only, EN/VI)"
phase: 3
status: completed
effort: "2h"
tags: [frontend, ui, master-data, bilingual, admin]
---

# Phase 03: Frontend User Management Tab & Form (Admin Only, EN/VI)

## Mục tiêu
Xây dựng giao diện Quản lý Tài khoản (User Accounts) hoàn chỉnh, trực quan, tuân thủ 100% chuẩn song ngữ English / Tiếng Việt (EN/VI). Tab này được tích hợp vào màn hình Quản lý Dữ liệu nguồn (Master Data) và chỉ hiển thị khi tài khoản đang đăng nhập có vai trò `ADMIN`.

## Các bước thực hiện

### 1. Mở rộng API Client (`apps/frontend/src/api/client.ts`)
- Thêm hàm `getSalesmen(role: UserRole): Promise<string[]>` gọi đến `GET /api/auth/salesmen`.
- Cập nhật hàm `saveUser` và thêm `updateUser(role: UserRole, id: string, data: Partial<UserAccount & { password?: string }>)`.
- Thêm trường `salesmanName` vào `UserAccount` trên frontend.

### 2. Mở rộng Tabs trong Master Data Manager (`apps/frontend/src/components/master/MasterDataManager.tsx`)
- Mở rộng kiểu `MasterSubTab`:
  ```typescript
  export type MasterSubTab =
    | 'CUSTOMERS'
    | 'QUOTATIONS'
    | 'STEPS'
    | 'METHODS'
    | 'PACKINGS'
    | 'USERS'; // Chỉ hiển thị khi currentRole === 'ADMIN'
  ```
- Nút điều hướng Tab:
  - Nếu `currentRole === 'ADMIN'`, hiển thị thêm nút Tab:
    `User Accounts / Quản lý Tài khoản` với icon `ShieldCheck` hoặc `Users` nổi bật.
  - Nếu không phải `ADMIN`, ẩn hoàn toàn tab này khỏi thanh điều hướng.

### 3. Giao diện Biểu mẫu Thêm / Sửa Tài khoản (Bilingual Add/Edit User Form)
- **Email:** `Email / Email đăng nhập` (placeholder: `vd: sales02@alkana.vn`)
- **Họ và Tên:** `Full Name / Họ và tên` (placeholder: `vd: Trần Văn C`)
- **Mật khẩu:** `Password / Mật khẩu` (placeholder: `Mặc định / Default: 123456`)
- **Vai trò:** `System Role / Vai trò hệ thống`:
  - `ADMIN`: `🛡️ System Admin / Quản trị hệ thống (Toàn quyền)`
  - `PROJECT_LEADER`: `👔 Project Leader / Quản lý Dự án (Full CS + CC)`
  - `SALES`: `💼 Sales / Kinh doanh (CS + CC theo Sales)`
  - `TECHNICAL`: `🛠️ Technical TA / Kỹ thuật viên (Chỉ CS theo Sales — Ẩn giá)`
- **Trường chọn Sales man phụ trách (`Assigned Salesman / Sales man phụ trách`):**
  - Khi chọn `SALES` hoặc `TECHNICAL`:
    - Dropdown combobox cho phép tìm kiếm và chọn từ danh sách Salesman nạp từ `apiClient.getSalesmen()`.
    - Placeholder: `-- Select Salesman / Chọn Sales man phụ trách --`.
    - Dòng mô tả hướng dẫn: `Restricted to customers & quotations of this Salesman / Chỉ xem & làm báo giá cho khách hàng của Sales man này`.
  - Khi chọn `ADMIN` hoặc `PROJECT_LEADER`:
    - Input bị vô hiệu hóa (disabled) với nhãn: `All Access (No restriction) / Toàn quyền - Xem tất cả khách hàng`.
- **Nút hành động:**
  - Nút thêm mới: `Add User / Thêm tài khoản`
  - Nút cập nhật: `Save Changes / Lưu thay đổi`
  - Nút hủy: `Cancel / Hủy`

### 4. Bảng hiển thị danh sách Tài khoản (Bilingual User Accounts Table)
- Các cột hiển thị:
  - `Email / Hộp thư đăng nhập` (font-mono màu xanh đậm).
  - `Full Name / Họ và Tên` (font-semibold).
  - `System Role / Vai trò` (Badge màu riêng biệt cho từng role: Tím cho Admin, Xanh biển cho Leader, Vàng cam cho Sales, Xám ngọc cho Technical).
  - `Assigned Salesman / Sales man phụ trách` (hiển thị tên Salesman hoặc badge `Tất cả / All`).
  - `Created Date / Ngày tạo` (định dạng `DD/MM/YYYY`).
  - `Actions / Thao tác` (nút `Edit / Sửa` và nút `Delete / Xóa` có hộp thoại xác nhận an toàn).

### 5. Cập nhật Modal Xác thực & Đổi nhanh (`UserAuthModal.tsx`)
- Thẻ thông tin phiên làm việc hiện tại: hiển thị thêm thông tin `Assigned Salesman / Sales man: [Tên Salesman]` nếu tài khoản có gán Salesman.
- Nếu không phải Admin, ẩn tab quản lý danh sách user trong modal hoặc chỉ cho phép xem thông tin cá nhân.

## Tiêu chí hoàn thành (Verification)
- [ ] Tab `User Accounts / Quản lý Tài khoản` chỉ xuất hiện trên màn hình khi đang đăng nhập quyền `ADMIN`.
- [ ] Chọn Role `TECHNICAL` hoặc `SALES`: bắt buộc chọn Salesman từ danh sách có sẵn.
- [ ] Chọn Role `ADMIN` hoặc `PROJECT_LEADER`: trường Salesman tự động khóa.
- [ ] Thêm thành công một tài khoản mới và sửa lại thông tin tài khoản đó.
- [ ] Toàn bộ nhãn, placeholder, nút bấm đều là song ngữ `English / Tiếng Việt`.

