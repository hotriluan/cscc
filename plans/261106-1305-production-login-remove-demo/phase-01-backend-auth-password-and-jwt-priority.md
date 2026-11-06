---
title: "Phase 01: Backend JWT Priority & Change Password API"
phase: 1
status: completed
effort: "0.5h"
tags: [backend, auth, jwt, password, middleware]
---

# Phase 01: Backend JWT Priority & Change Password API

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Auth Middleware: [apps/backend/src/middleware/auth-rbac.middleware.ts](../../apps/backend/src/middleware/auth-rbac.middleware.ts)
- Data Store: [apps/backend/src/store/data-store.ts](../../apps/backend/src/store/data-store.ts)
- Express App Routes: [apps/backend/src/app.ts](../../apps/backend/src/app.ts)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Củng cố tầng xác thực Backend để khi có JWT hợp lệ (`Authorization: Bearer <token>`), hệ thống luôn khóa chặt `req.userRole` và `req.salesmanName` theo JWT payload (không cho phép header `x-user-role` ghi đè vai trò của người dùng đã đăng nhập), đồng thời bổ sung API `POST /api/auth/change-password` để người dùng tự đổi mật khẩu cá nhân.

## Key Insights
- Trong [`auth-rbac.middleware.ts`](../../apps/backend/src/middleware/auth-rbac.middleware.ts#L45-L55), hiện tại `explicitRole` (`x-user-role`) đang được xét trước `tokenRole`. Khi đảo thứ tự ưu tiên để `tokenRole` (từ JWT đã ký) luôn được ưu tiên cao nhất khi có Bearer token, người dùng đã đăng nhập trên trình duyệt sẽ không bao giờ bị lệch vai trò hay giả mạo header, trong khi các bài test tự động không gửi Bearer token vẫn tiếp tục hoạt động bình thường với `x-user-role`.
- Bảng `User` trong PostgreSQL đã lưu `passwordHash` bằng thuật toán `scrypt` (`hashPassword` / `verifyPassword` trong [`auth.service.ts`](../../apps/backend/src/services/auth.service.ts)).

## Requirements
- **Functional**:
  - Cập nhật `extractRoleMiddleware` ưu tiên `tokenRole` và `tokenSalesman` khi có JWT hợp lệ trong `Authorization: Bearer <token>`.
  - Thêm phương thức `changeUserPassword(userId, currentPassword, newPassword)` vào `PostgresDataStore` ([`data-store.ts`](../../apps/backend/src/store/data-store.ts)).
  - Thêm endpoint `POST /api/auth/change-password` trong [`app.ts`](../../apps/backend/src/app.ts) yêu cầu phiên JWT hợp lệ (`req.authUser`), kiểm tra mật khẩu hiện tại, độ dài mật khẩu mới (tối thiểu 6 ký tự) và cập nhật `passwordHash`.
- **Non-functional**:
  - Giữ toàn bộ các bài test hiện có trong `apps/backend/test/` pass 100% và bổ sung test cho `POST /api/auth/change-password` + ưu tiên JWT.

## Related Code Files
- Modify: `apps/backend/src/middleware/auth-rbac.middleware.ts`
- Modify: `apps/backend/src/store/data-store.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/test/user-salesman-rbac.test.ts`

## Implementation Steps
1. **Cập nhật `extractRoleMiddleware` trong `apps/backend/src/middleware/auth-rbac.middleware.ts`**:
   - Nếu `tokenRole` hợp lệ (từ `Authorization: Bearer <token>`), gán `req.userRole = tokenRole` và `req.salesmanName = tokenSalesman ?? null`.
   - Chỉ khi không có `tokenRole` mới fallback sang `explicitRole` (`x-user-role` / `role` query) phục vụ các bài kiểm thử tích hợp.
2. **Thêm `changeUserPassword` vào `apps/backend/src/store/data-store.ts`**:
   - Tìm user theo `userId`, kiểm tra `verifyPassword(currentPassword, user.passwordHash)`.
   - Nếu sai mật khẩu hiện tại, trả về `{ ok: false, error: 'INVALID_CURRENT_PASSWORD', message: 'Mật khẩu hiện tại không chính xác.' }`.
   - Nếu đúng, băm mật khẩu mới bằng `hashPassword(newPassword)` và lưu vào PostgreSQL.
3. **Thêm route `POST /api/auth/change-password` vào `apps/backend/src/app.ts`**:
   - Kiểm tra `req.authUser` (trả về `401 UNAUTHORIZED` nếu chưa đăng nhập).
   - Kiểm tra `currentPassword` và `newPassword` (tối thiểu 6 ký tự).
   - Gọi `dataStore.changeUserPassword(...)` và trả về `{ updated: true, message: '...' }`.

## Todo List
- [x] Cập nhật thứ tự ưu tiên JWT trong `auth-rbac.middleware.ts`
- [x] Thêm `changeUserPassword` trong `data-store.ts`
- [x] Thêm endpoint `POST /api/auth/change-password` trong `app.ts`
- [x] Bổ sung unit/integration test trong `user-salesman-rbac.test.ts`

## Success Criteria
- Khi gửi kèm JWT của `TECHNICAL` và header `x-user-role: ADMIN`, `req.userRole` vẫn là `TECHNICAL`.
- `POST /api/auth/change-password` hoạt động chính xác với JWT hợp lệ và từ chối mật khẩu cũ sai với mã `400`.

