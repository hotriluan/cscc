---
title: "Phase 02: Full-Screen Login Page & User Profile Modal"
phase: 2
status: completed
effort: "0.5h"
tags: [frontend, login, modal, profile, auth]
---

# Phase 02: Full-Screen Login Page & User Profile Modal

## Context Links
- Plan Overview: [plan.md](./plan.md)
- API Client: [apps/frontend/src/api/client.ts](../../apps/frontend/src/api/client.ts)
- Existing Auth Modal: [apps/frontend/src/components/auth/UserAuthModal.tsx](../../apps/frontend/src/components/auth/UserAuthModal.tsx)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Xây dựng trang đăng nhập toàn màn hình (`LoginPage.tsx`) hiển thị khi người dùng chưa đăng nhập, và chuyển đổi `UserAuthModal.tsx` thành hộp thoại **Thông tin Tài khoản & Đổi mật khẩu cá nhân** (loại bỏ hoàn toàn 1-click demo login, mật khẩu mặc định điền sẵn và bảng quản lý User trùng lặp).

## Key Insights
- Quản trị danh sách tài khoản hệ thống (`ADMIN` thêm/sửa/xóa user, gán Salesman) đã có giao diện đầy đủ tại `Master Data -> Users` ([`MasterDataManager.tsx`](../../apps/frontend/src/components/master/MasterDataManager.tsx#L1813-L2113)).
- Do đó, khi đã đăng nhập, modal tài khoản trên Sidebar chỉ cần tập trung vào: hiển thị hồ sơ cá nhân đang đăng nhập (Họ tên, Email, Vai trò, Salesman phụ trách), biểu mẫu **Đổi mật khẩu cá nhân**, và nút **Đăng xuất**.

## Requirements
- **Functional**:
  - Thêm hàm `apiClient.changePassword(currentPassword, newPassword)` vào [`apps/frontend/src/api/client.ts`](../../apps/frontend/src/api/client.ts).
  - Tạo mới [`apps/frontend/src/components/auth/LoginPage.tsx`](../../apps/frontend/src/components/auth/LoginPage.tsx):
    - Giao diện toàn màn hình chuyên nghiệp với logo **ALKANA Coating**, tiêu đề hệ thống **CS & CC Automation System**.
    - Biểu mẫu nhập Email và Mật khẩu (trống mặc định, có nút ẩn/hiện mật khẩu, thông báo lỗi rõ ràng).
    - Không có bất kỳ danh sách tài khoản demo hay nút đăng nhập nhanh 1-click nào.
  - Cập nhật [`apps/frontend/src/components/auth/UserAuthModal.tsx`](../../apps/frontend/src/components/auth/UserAuthModal.tsx):
    - Hiển thị chi tiết tài khoản đang đăng nhập (`fullName`, `email`, `role`, `salesmanName`).
    - Form **Đổi mật khẩu / Change Password** (Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới).
    - Nút **Đăng xuất / Logout**.

## Related Code Files
- Modify: `apps/frontend/src/api/client.ts`
- Create: `apps/frontend/src/components/auth/LoginPage.tsx`
- Modify: `apps/frontend/src/components/auth/UserAuthModal.tsx`

## Implementation Steps
1. **Cập nhật `apps/frontend/src/api/client.ts`**:
   - Bổ sung `changePassword: (currentPassword: string, newPassword: string) => ...` gọi `POST /api/auth/change-password`.
2. **Tạo `apps/frontend/src/components/auth/LoginPage.tsx`**:
   - Thiết kế layout căn giữa toàn màn hình (`min-h-screen bg-slate-950`) với thẻ đăng nhập trang nhã, logo ALKANA, trường Email + Password, trạng thái loading và thông báo lỗi song ngữ Việt/Anh.
3. **Làm sạch và nâng cấp `apps/frontend/src/components/auth/UserAuthModal.tsx`**:
   - Xóa bỏ danh sách 1-Click Demo Login, xóa mật khẩu mặc định `123456`, xóa tab danh sách User trùng lặp.
   - Thiết kế lại thành hộp thoại **Tài khoản cá nhân & Đổi mật khẩu (Account Profile & Change Password)**.

## Todo List
- [x] Thêm `apiClient.changePassword` trong `apps/frontend/src/api/client.ts`
- [x] Tạo component `apps/frontend/src/components/auth/LoginPage.tsx`
- [x] Cập nhật `apps/frontend/src/components/auth/UserAuthModal.tsx` thành modal Hồ sơ & Đổi mật khẩu

## Success Criteria
- `LoginPage.tsx` không chứa bất kỳ thông tin tài khoản demo hay mật khẩu điền sẵn nào.
- `UserAuthModal.tsx` cho phép người dùng đang đăng nhập xem thông tin cá nhân, đổi mật khẩu thành công hoặc đăng xuất.

