---
title: "Phase 01: Database Schema Migration & Shared Types"
phase: 1
status: completed
effort: "1.5h"
tags: [database, prisma, schema, shared-types]
---

# Phase 01: Database Schema Migration & Shared Types

## Mục tiêu
Bổ sung trường `salesmanName` vào cơ sở dữ liệu `User` PostgreSQL thông qua Prisma Schema, cập nhật kiểu dữ liệu dùng chung tại `@cscc/shared`, nâng cấp cấu trúc JWT Payload và cập nhật danh sách người dùng mặc định (`DEFAULT_SEED_USERS`).

## Các bước thực hiện

### 1. Cập nhật Prisma Schema (`apps/backend/prisma/schema.prisma`)
- Bổ sung trường `salesmanName String?` vào model `User`:
  ```prisma
  model User {
    id           String   @id @default(uuid())
    email        String   @unique
    fullName     String
    passwordHash String
    role         UserRole @default(TECHNICAL)
    salesmanName String?  // Salesman liên kết (Bắt buộc cho SALES/TECHNICAL, NULL cho ADMIN/LEADER)
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
  }
  ```
- Chạy lệnh `npx prisma generate` để cập nhật TypeScript types của `@prisma/client`.

### 2. Cập nhật Shared Types (`packages/shared/src/types.ts`)
- Cập nhật interface `UserAccount`:
  ```typescript
  export interface UserAccount {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    salesmanName?: string | null;
    createdAt: string;
  }
  ```
- Build lại package shared: `npm run build -w @cscc/shared`.

### 3. Cập nhật Dịch vụ Xác thực (`apps/backend/src/services/auth.service.ts`)
- Cập nhật interface `JwtPayload` và `DefaultSeedUser` để nhận `salesmanName?: string | null`.
- Hàm `signJwtToken` bổ sung `salesmanName: user.salesmanName ?? null` vào payload token.
- Cập nhật danh sách seed mẫu `DEFAULT_SEED_USERS`:
  - `user-leader-01` (`PROJECT_LEADER`): `salesmanName: null`
  - `user-sales-01` (`SALES`): `salesmanName: 'Nguyễn Văn A'`
  - `user-tech-01` (`TECHNICAL`): `salesmanName: 'Nguyễn Văn A'`
  - `user-admin-01` (`ADMIN`): `salesmanName: null`

### 4. Cập nhật DataStore User Methods (`apps/backend/src/store/data-store.ts`)
- Cập nhật `mapUserDto` để chuyển đổi `salesmanName: u.salesmanName ?? null`.
- Cập nhật `upsertUser` nhận tham số `salesmanName?: string | null`.
- Đảm bảo khi role là `ADMIN` hoặc `PROJECT_LEADER`, `salesmanName` tự động gán về `null`.

## Tiêu chí hoàn thành (Verification)
- [ ] Chạy `npm run build` ở backend và shared không gặp lỗi TypeScript.
- [ ] Prisma Client nhận diện được trường `salesmanName` trên đối tượng `prisma.user`.
- [ ] Seed user mẫu tạo thành công tài khoản có `salesmanName`.

