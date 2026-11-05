---
title: "Phase 02: Backend RBAC & Data Filtering APIs"
phase: 2
status: planned
effort: "2h"
tags: [backend, rbac, api, filter, security]
---

# Phase 02: Backend RBAC & Data Filtering APIs

## Mục tiêu
Thiết lập Middleware chặn quyền quản lý User Account (chỉ cho phép `ADMIN`), bổ sung API lấy danh sách Salesman tự động từ cơ sở dữ liệu khách hàng, và áp dụng bộ lọc dữ liệu tự động tại tầng DataStore cho các đối tượng: Khách hàng (Customers), Báo giá (Quotations), và Dự án (Projects).

## Các bước thực hiện

### 1. Xây dựng Middleware Quản trị (`apps/backend/src/middleware/auth-rbac.middleware.ts`)
- Tạo middleware `requireAdminMiddleware`:
  ```typescript
  export function requireAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({
        error: 'FORBIDDEN_ADMIN_ACCESS',
        message: 'Chỉ có tài khoản Quản trị viên (ADMIN) mới có quyền truy cập và thao tác Quản lý Tài khoản (User Accounts).'
      });
      return;
    }
    next();
  }
  ```

### 2. Bổ sung API Danh mục Salesman & Bảo vệ API Users (`apps/backend/src/app.ts`)
- **API Lấy danh sách Salesman:** `GET /api/auth/salesmen`
  - Đọc danh sách các tên Salesman không trùng lặp (`DISTINCT salesmanName`) từ bảng `Customer` qua DataStore.
  - Trả về danh sách chuỗi đã được sắp xếp tăng dần theo bảng chữ cái.
- **Bảo vệ các API Quản lý User bằng `requireAdminMiddleware`:**
  - `GET /api/auth/users`: Chỉ Admin mới được xem toàn bộ danh sách tài khoản.
  - `POST /api/auth/users`: Chỉ Admin mới được tạo mới hoặc lưu tài khoản.
  - `PUT /api/auth/users/:id`: Chỉ Admin mới được chỉnh sửa thông tin hoặc đặt lại mật khẩu.
  - `DELETE /api/auth/users/:id`: Chỉ Admin mới được xóa tài khoản.

### 3. Bộ lọc Khách hàng, Báo giá & Dự án theo Salesman (`apps/backend/src/store/data-store.ts`)
- **Lọc Khách hàng (`getCustomers` & `getCustomersPaginated`):**
  - Nhận thêm tham số `salesmanFilter?: string | null`.
  - Nếu người dùng có role là `SALES` hoặc `TECHNICAL` và có `salesmanName`: ép điều kiện truy vấn `salesmanName: { equals: salesmanFilter, mode: 'insensitive' }`.
- **Lọc Báo giá (`getQuotations` & `getQuotationsPaginated`):**
  - Nếu có `salesmanFilter`: chỉ lấy các `QuotationItem` có `customer.salesmanName` trùng khớp hoặc `sapCustomerCode` thuộc danh sách khách hàng của Salesman đó.
- **Lọc Dự án (`getProjects`):**
  - Nếu có `salesmanFilter`: chỉ trả về các dự án mà khách hàng của dự án đó (`project.customer.salesmanName`) thuộc về Salesman của người dùng.
- **Tài khoản `ADMIN` và `PROJECT_LEADER`:**
  - `salesmanFilter` không được áp dụng, trả về toàn bộ dữ liệu.

## Tiêu chí hoàn thành (Verification)
- [ ] Gọi `GET /api/auth/users` bằng token Role `TECHNICAL` hoặc `SALES` trả về mã lỗi `403 Forbidden`.
- [ ] Gọi `GET /api/auth/users` bằng token Role `ADMIN` trả về danh sách đầy đủ kèm trường `salesmanName`.
- [ ] Endpoint `GET /api/auth/salesmen` trả về danh sách các Salesman có trong bảng Customer.
- [ ] Gọi `GET /api/master/customers` với user Technical có Salesman "Nguyễn Văn A" chỉ trả về khách hàng của "Nguyễn Văn A".

