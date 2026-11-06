---
title: "Phase 01: Database Schema & Shared Types"
phase: 1
status: completed
effort: "1h"
tags: [database, prisma, schema, shared-types, postgresql]
---

# Phase 01: Database Schema & Shared Types

## Mục tiêu
Bổ sung giá trị `INACTIVE` vào enum `RevisionStatus`, thiết kế bảng lịch sử `RevisionStatusHistory` trong Prisma Schema và PostgreSQL, đồng thời cập nhật các kiểu dữ liệu dùng chung tại `@cscc/shared`.

## Các bước thực hiện

### 1. Cập nhật Prisma Schema (`apps/backend/prisma/schema.prisma`)
- Mở rộng `enum RevisionStatus`:
  ```prisma
  enum RevisionStatus {
    DRAFT
    APPROVED
    INACTIVE
    LOCKED
  }
  ```
- Bổ sung quan hệ `statusHistory RevisionStatusHistory[]` vào model `ProjectRevision`.
- Thêm model `RevisionStatusHistory`:
  ```prisma
  model RevisionStatusHistory {
    id              String          @id @default(uuid())
    revisionId      String
    revision        ProjectRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
    fromStatus      RevisionStatus?
    toStatus        RevisionStatus
    changedByUserId String?
    changedByName   String
    changedByRole   UserRole
    note            String
    isAutoSupersede Boolean         @default(false)
    changedAt       DateTime        @default(now())

    @@index([revisionId, changedAt(sort: Desc)])
  }
  ```
- Chạy `npx prisma generate` để sinh lại Prisma Client.

### 2. Bổ sung Idempotent Startup DDL (`apps/backend/src/store/data-store.ts`)
- Tại hàm `dataStore.init()`, bổ sung các câu lệnh SQL an toàn để tự động nâng cấp cơ sở dữ liệu PostgreSQL hiện hành mà không làm mất dữ liệu:
  - `ALTER TYPE "RevisionStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';`
  - `CREATE TABLE IF NOT EXISTS "RevisionStatusHistory" (...)` cùng khóa ngoại `ON DELETE CASCADE` tới `"ProjectRevision"("id")` và index `("revisionId", "changedAt" DESC)`.

### 3. Cập nhật Shared Types (`packages/shared/src/types.ts`)
- Mở rộng kiểu `RevisionStatus`:
  ```typescript
  export type RevisionStatus = 'DRAFT' | 'APPROVED' | 'INACTIVE' | 'LOCKED';
  ```
- Bổ sung interface `RevisionStatusHistoryEntry`:
  ```typescript
  export interface RevisionStatusHistoryEntry {
    id: string;
    revisionId: string;
    fromStatus: RevisionStatus | null;
    toStatus: RevisionStatus;
    changedByUserId?: string | null;
    changedByName: string;
    changedByRole: UserRole;
    note: string;
    isAutoSupersede?: boolean;
    changedAt: string;
  }
  ```
- Bổ sung trường `statusHistory?: RevisionStatusHistoryEntry[]` vào `ProjectRevision`.
- Build lại package shared: `npm run build -w @cscc/shared`.

## Tiêu chí hoàn thành (Verification)
- [x] `npx prisma generate` và `npm run build -w @cscc/shared` chạy thành công không có lỗi biên dịch.
- [x] Khi khởi động backend, PostgreSQL tự động có giá trị `INACTIVE` trong enum `"RevisionStatus"` và bảng `"RevisionStatusHistory"`.

