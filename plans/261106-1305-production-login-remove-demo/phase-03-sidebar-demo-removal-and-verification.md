---
title: "Phase 03: Sidebar Demo Removal, Session Gate & E2E Verification"
phase: 3
status: completed
effort: "0.5h"
tags: [frontend, sidebar, app, verification, test]
---

# Phase 03: Sidebar Demo Removal, Session Gate & E2E Verification

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Main App Component: [apps/frontend/src/App.tsx](../../apps/frontend/src/App.tsx)
- Login Page: [apps/frontend/src/components/auth/LoginPage.tsx](../../apps/frontend/src/components/auth/LoginPage.tsx)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Tích hợp cổng kiểm tra đăng nhập bắt buộc (`authReady` / `currentUser`) vào `App.tsx`, khóa chặt `role = currentUser.role`, và xóa bỏ hoàn toàn khối Demo `Role Switcher / Chuyển nhanh vai trò` trên Sidebar như trong hình người dùng yêu cầu.

## Key Insights
- Trong [`App.tsx`](../../apps/frontend/src/App.tsx#L1032-L1106), khối `ACCOUNT & RBAC / TÀI KHOẢN & PHÂN QUYỀN` hiện chứa thẻ tài khoản, dropdown `Role Switcher / Chuyển nhanh vai trò:` và dòng chữ trạng thái demo.
- Khi thay thế bằng phiên đăng nhập thực tế:
  - Nếu đang kiểm tra token lúc mới tải trang (`authInitializing === true`), hiển thị màn hình chờ xác thực ngắn gọn.
  - Nếu `!currentUser`, render `<LoginPage />` toàn màn hình và không gọi API tải dữ liệu dự án/master data cho đến khi đăng nhập thành công.
  - Khi đã có `currentUser`, biến `role` được suy ra trực tiếp từ `currentUser.role` (không còn state `setRole` tự do).
  - Trên Sidebar, khối tài khoản hiển thị gọn gàng thông tin của `currentUser` (Họ tên, Email, Badge vai trò, Salesman phụ trách nếu có) cùng 2 nút: **Tài khoản / Đổi MK** và **Đăng xuất**.

## Requirements
- **Functional**:
  - Chặn truy cập toàn bộ `App.tsx` khi `currentUser === null` bằng `<LoginPage />`.
  - Chỉ gọi `loadAllData` sau khi `currentUser` đã được xác thực thành công.
  - Xóa hoàn toàn `<select>` `Role Switcher / Chuyển nhanh vai trò` và đoạn văn bản trạng thái demo bên dưới khỏi Sidebar.
  - Khi bấm **Đăng xuất**, xóa JWT khỏi `localStorage`, reset `currentUser = null`, dừng mọi timer auto-save và quay về màn hình `<LoginPage />`.
- **Non-functional**:
  - `npm run typecheck`, `npm run build`, và `npm test` đạt 100% pass.

## Related Code Files
- Modify: `apps/frontend/src/App.tsx`

## Implementation Steps
1. **Thiết lập Session Gate trong `apps/frontend/src/App.tsx`**:
   - Thay `const [role, setRole] = React.useState<UserRole>('PROJECT_LEADER')` bằng `const role: UserRole = currentUser?.role ?? 'TECHNICAL'`.
   - Thêm state `authChecking` (mặc định `true` nếu có token trong `localStorage`). Khi mount, gọi `apiClient.getMe()` để khôi phục `currentUser`; nếu lỗi hoặc không có token thì đặt `authChecking = false` và hiển thị `<LoginPage />`.
   - Chỉ kích hoạt `loadAllData` khi `currentUser !== null`.
2. **Xóa bỏ khối Demo Role Switcher trên Sidebar (`App.tsx`)**:
   - Xóa hoàn toàn phần `Role Switcher / Chuyển nhanh vai trò:` (`<select value={role} onChange={...}>`) và đoạn `<p>` trạng thái bên dưới.
   - Thiết kế lại thẻ tài khoản trên Sidebar hiển thị:
     - Họ tên (`currentUser.fullName`) & Email (`currentUser.email`)
     - Nhãn vai trò (`ADMIN`, `PROJECT_LEADER`, `SALES`, `TECHNICAL`) & Salesman phụ trách (`currentUser.salesmanName` nếu có)
     - Nút mở hộp thoại Tài khoản / Đổi mật khẩu và nút Đăng xuất nhanh.
3. **Kiểm thử & Xác nhận chất lượng (`Verification`)**:
   - Chạy `npm run typecheck` kiểm tra kiểu dữ liệu trên toàn monorepo.
   - Chạy `npm run build` đảm bảo đóng gói production không lỗi.
   - Chạy `npm test` đảm bảo toàn bộ test suite Backend & Shared pass 100%.

## Todo List
- [x] Thêm cổng kiểm tra phiên đăng nhập (`authChecking` + `<LoginPage />`) trong `App.tsx`
- [x] Khóa `role` theo `currentUser.role` và chỉ tải dữ liệu khi đã đăng nhập
- [x] Xóa khối `Role Switcher / Chuyển nhanh vai trò` trên Sidebar và cập nhật thẻ User Session
- [x] Chạy `npm run typecheck`, `npm run build`, và `npm test`

## Success Criteria
- Không thể vào màn hình chính nếu chưa đăng nhập; khối `Role Switcher` biến mất hoàn toàn khỏi Sidebar.
- Toàn bộ lệnh `npm run typecheck`, `npm run build`, và `npm test` đều thành công.

