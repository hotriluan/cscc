---
title: "User Account Management with Salesman Linking & Role Data Isolation"
description: "Phân hệ Quản lý Tài khoản (User Accounts) cho phép Admin tạo/sửa user, phân quyền RBAC và liên kết Sales man cho nhóm Sales/Technical, giới hạn hiển thị Khách hàng & Báo giá theo Sales man song ngữ EN/VI."
status: completed
priority: P1
effort: "8h"
tags: [feature, rbac, auth, master-data, frontend, backend, database]
blockedBy: []
blocks: []
created: 2026-11-05
---

# User Account Management with Salesman Linking & Role Data Isolation

## Overview

Xây dựng phân hệ **Quản lý Tài khoản Người Dùng (User Account Management)** với cơ chế bảo mật nghiêm ngặt và phân vùng dữ liệu (Data Isolation):
1. **Chỉ vai trò `ADMIN`** mới có quyền truy cập và thao tác quản lý tài khoản người dùng.
2. Mỗi tài khoản thuộc nhóm **`SALES`** hoặc **`TECHNICAL`** được liên kết với **1 Sales man cụ thể** (lấy tự động từ danh mục khách hàng).
3. Tài khoản **`PROJECT_LEADER`** và **`ADMIN`** không cần chọn Sales man (mặc định toàn quyền truy cập toàn bộ dữ liệu).
4. Khi làm việc trên hệ thống (lập Qui trình sơn CS, tra cứu Báo giá CC, xem Dự án): người dùng thuộc nhóm `SALES` hoặc `TECHNICAL` **chỉ được thấy và chọn các Khách hàng & Báo giá thuộc về Sales man đã gán**.
5. Giao diện người dùng tuân thủ 100% quy chuẩn **Song ngữ English / Tiếng Việt (EN/VI)** đồng bộ với toàn bộ dự án CSCC.

## Architecture & Data Flow

```text
[ PostgreSQL User Table ]
  + id, email, fullName, role, passwordHash
  + salesmanName String? (NULL for ADMIN & PROJECT_LEADER)
             ▲
             │ (Admin Only CRUD & Token Generation)
             ▼
[ Backend Express API & RBAC Middleware ]
  ├─ requireAdminMiddleware: Chặn 403 nếu không phải ADMIN khi gọi /api/auth/users
  ├─ GET /api/auth/salesmen: Trả về danh sách DISTINCT salesmanName từ bảng Customer
  ├─ GET /api/master/customers: Tự động lọc { salesmanName: user.salesmanName } nếu role là SALES/TECHNICAL
  ├─ GET /api/master/quotations: Tự động lọc vật tư của khách hàng thuộc Sales man
  └─ GET /api/projects: Tự động lọc dự án của khách hàng thuộc Sales man
             ▲
             │ (JWT Bearer Token with role & salesmanName)
             ▼
[ Frontend React + Tailwind UI (Bilingual EN/VI) ]
  ├─ Master Data Tab: "User Accounts / Quản lý Tài khoản" (Chỉ hiển thị cho ADMIN)
  ├─ Add/Edit Form: Bắt buộc chọn Sales man khi chọn SALES hoặc TECHNICAL; khóa khi chọn ADMIN/LEADER
  ├─ CS Editor: Dropdown Khách hàng & Vật tư chỉ hiển thị danh sách của Sales man phụ trách
  └─ Project Explorer: Danh sách dự án giới hạn theo phạm vi khách hàng của Sales man
```

## Phases Roadmap

| # | Phase | Effort | Status | Description |
|---|-------|--------|--------|-------------|
| 1 | [Database Schema Migration & Shared Types](./phase-01-database-schema-and-shared-types.md) | 1.5h | Completed | Bổ sung `salesmanName` vào Prisma `User`, cập nhật Shared Types, JWT Payload và Seed Data. |
| 2 | [Backend RBAC & Data Filtering APIs](./phase-02-backend-rbac-and-filtering-apis.md) | 2h | Completed | `requireAdminMiddleware`, endpoint lấy danh sách Salesman, và bộ lọc DataStore cho Customers/Quotations/Projects. |
| 3 | [Frontend User Management Tab & Form (Admin Only, EN/VI)](./phase-03-frontend-user-management-tab.md) | 2h | Completed | Tab "User Accounts / Quản lý Tài khoản" trong Master Data, form Thêm/Sửa tài khoản với dropdown chọn Salesman song ngữ. |
| 4 | [Frontend CS Editor & Customer Filtering by Salesman (EN/VI)](./phase-04-frontend-cs-editor-and-customer-filtering.md) | 1.5h | Completed | Ràng buộc dropdown chọn khách hàng và vật tư báo giá trong CS Editor & Project Explorer theo `user.salesmanName`. |
| 5 | [Automated Testing & End-to-End Verification](./phase-05-automated-testing-and-verification.md) | 1h | Completed | Kiểm thử tự động (Unit test, RBAC API test, Data Isolation test) và kiểm tra tính nhất quán song ngữ. |

## Dependencies

- Prisma Schema: `apps/backend/prisma/schema.prisma`
- Shared Package: `packages/shared/src/types.ts`
- Backend Core: `apps/backend/src/store/data-store.ts`, `apps/backend/src/app.ts`
- Frontend Core: `apps/frontend/src/components/master/MasterDataManager.tsx`, `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`

## Success Criteria

- [x] Model `User` lưu trữ và truy xuất chính xác `salesmanName`.
- [x] Chỉ có `ADMIN` mới gọi được các API thêm/sửa/xóa user; các role khác nhận mã lỗi `403 Forbidden`.
- [x] Dropdown chọn Salesman hiển thị danh sách chính xác các Salesman từ dữ liệu khách hàng.
- [x] Khi đăng nhập bằng tài khoản Sales hoặc Technical có Salesman "Nguyễn Văn A", hệ thống chỉ cho phép chọn khách hàng và xem báo giá thuộc "Nguyễn Văn A".
- [x] Tài khoản Admin và Project Leader tiếp tục truy cập toàn bộ khách hàng và báo giá không bị hạn chế.
- [x] Toàn bộ nhãn, thông báo, nút bấm, bảng biểu trên giao diện Quản lý User và Lọc dữ liệu đều là song ngữ `English / Tiếng Việt`.

<!-- slug: user-account-salesman-management -->

