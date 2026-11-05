---
title: "Phase 05: Automated Testing & End-to-End Verification"
phase: 5
status: planned
effort: "1h"
tags: [testing, e2e, verification, rbac, regression]
---

# Phase 05: Automated Testing & End-to-End Verification

## Mục tiêu
Xây dựng bộ kiểm thử tự động (Unit Test, API RBAC Test, Data Isolation Test) và thực hiện kiểm thử quy trình toàn diện (End-to-End) trên hệ thống để bảo đảm không xảy ra bất kỳ lỗi hồi quy nào đối với các tính năng CS, CC, BOM và xuất file hiện tại.

## Các kịch bản kiểm thử (Test Scenarios)

### 1. Kiểm thử Unit Test & DataStore (`apps/backend/test/user-salesman-rbac.test.ts`)
- **Tạo tài khoản với Salesman:**
  - Tạo user role `TECHNICAL` kèm `salesmanName: 'Nguyễn Văn A'` -> Thành công, lưu đúng vào DB.
  - Tạo user role `SALES` kèm `salesmanName: 'Trần Thị B'` -> Thành công.
  - Tạo user role `ADMIN` kèm `salesmanName: 'Bất kỳ'` -> Hệ thống tự động chuẩn hóa về `salesmanName: null`.
  - Tạo user role `PROJECT_LEADER` -> `salesmanName: null`.

### 2. Kiểm thử API RBAC Chặn quyền Quản trị User
- Gọi `GET /api/auth/users` với header `x-user-role: TECHNICAL` -> Kết quả nhận `403 Forbidden`.
- Gọi `POST /api/auth/users` với header `x-user-role: SALES` -> Kết quả nhận `403 Forbidden`.
- Gọi `POST /api/auth/users` với header `x-user-role: PROJECT_LEADER` -> Kết quả nhận `403 Forbidden`.
- Gọi `POST /api/auth/users` với header `x-user-role: ADMIN` -> Kết quả nhận `201 Created` / `200 OK`.

### 3. Kiểm thử Phân vùng Dữ liệu (Data Isolation Test)
- Giả lập cơ sở dữ liệu có 3 khách hàng:
  - Khách hàng 1: `NITORI-HCM`, `salesmanName: 'Nguyễn Văn A'`
  - Khách hàng 2: `IKEA-VN`, `salesmanName: 'Trần Thị B'`
  - Khách hàng 3: `AN-CUONG`, `salesmanName: 'Nguyễn Văn A'`
- Query `getCustomers` với context user có `salesmanName: 'Nguyễn Văn A'`:
  - Kết quả trả về chính xác 2 khách hàng (`NITORI-HCM` và `AN-CUONG`).
  - Không xuất hiện `IKEA-VN`.
- Query `getQuotations` với context user có `salesmanName: 'Nguyễn Văn A'`:
  - Chỉ trả về danh mục vật tư của `NITORI-HCM` và `AN-CUONG`.
- Query với context `ADMIN` hoặc `PROJECT_LEADER`:
  - Trả về toàn bộ 3 khách hàng và tất cả báo giá.

### 4. Kiểm thử Build & Type Check Toàn bộ Dự án
- Chạy `npm run test` ở backend để đảm bảo toàn bộ test case cũ và mới đều PASS (kể cả test `customer-salesman.test.ts` và bộ test tính toán CSCC).
- Chạy `npm run build` ở packages/shared, apps/backend và apps/frontend để bảo đảm TypeScript biên dịch sạch 100%, không có lỗi type.

## Tiêu chí hoàn thành (Verification)
- [ ] File test `user-salesman-rbac.test.ts` hoàn thành và pass 100%.
- [ ] Toàn bộ các test cũ (`customer-salesman.test.ts`, `calculator.test.ts`) đều pass, không có regression.
- [ ] Build thành công toàn bộ monorepo không có lỗi TypeScript hay cú pháp.
- [ ] Giao diện trực quan trên browser chạy mượt mà, phân quyền chính xác.

