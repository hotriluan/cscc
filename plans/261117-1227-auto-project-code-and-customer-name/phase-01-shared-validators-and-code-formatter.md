# Phase 1 — Shared Validators & Project Code Formatter (`@cscc/shared`)

## Context
Cả Backend (`apps/backend`) và Frontend (`apps/frontend`) đều cần kiểm tra tính hợp lệ của `Customer.shortName` (linh hoạt 2–6 ký tự) và tính toán/định dạng mã hồ sơ tự động `[shortName] [0001]`. Đặt các hàm nguyên tử này trong `packages/shared` đảm bảo một nguồn chân lý duy nhất (Single Source of Truth).

## Requirements
1. **Chuẩn hóa & Kiểm tra `shortName` (`packages/shared/src/calculator.ts`):**
   - `normalizeCustomerShortName(raw: string | null | undefined): string`: cắt khoảng trắng 2 đầu, chuyển thành chữ in hoa (`trim().toUpperCase()`).
   - `isValidCustomerShortName(shortName: string | null | undefined, customerName?: string | null): boolean`:
     - Sau khi chuẩn hóa, độ dài phải nằm trong khoảng **từ 2 đến 6 ký tự** (`2 <= len <= 6`).
     - Chỉ chứa chữ cái/chữ số/ký tự gạch ngang cơ bản (không chứa khoảng trắng ở giữa để không làm hỏng cấu trúc `[shortName] [0001]`, hoặc chuẩn hóa gọn).
     - Nếu `customerName` dài hơn 6 ký tự mà `shortName` vẫn bằng nguyên `customerName` (chưa rút gọn) thì tự động rơi vào điều kiện `len > 6` $\rightarrow$ trả về `false`.
2. **Định dạng & Tách số thứ tự `projectCode`:**
   - `formatCustomerProjectCode(shortName: string, sequenceNumber: number): string`:
     - Trả về `${normalizeCustomerShortName(shortName)} ${String(Math.max(1, Math.floor(sequenceNumber))).padStart(4, '0')}` (ví dụ: `NTRI 0001`, `IKEA 0012`).
   - `parseCustomerProjectSequence(projectCode: string, shortName: string): number | null`:
     - Kiểm tra xem `projectCode` (không phân biệt hoa thường) có bắt đầu bằng `${shortName} ` theo sau bởi các chữ số `(\d+)` hay không. Nếu khớp thì trả về số nguyên đó (ví dụ `NTRI 0001` $\rightarrow$ `1`, `NTR 001` với `shortName = "NTR"` $\rightarrow$ `1`), ngược lại trả về `null`.
   - `computeNextCustomerProjectCode(shortName: string, existingProjectCodes: string[]): string`:
     - Tìm giá trị lớn nhất `maxSeq` từ danh sách `existingProjectCodes` của khách hàng đó (hoặc có cùng prefix `shortName`).
     - Trả về `formatCustomerProjectCode(shortName, maxSeq + 1)` (nếu chưa có hồ sơ nào thì `maxSeq = 0` $\rightarrow$ trả về `${shortName} 0001`).

## Files
- Modify: `packages/shared/src/calculator.ts`
- Modify: `packages/shared/src/calculator.test.ts`

## Steps
1. Mở `packages/shared/src/calculator.ts` và bổ sung các hàm `normalizeCustomerShortName`, `isValidCustomerShortName`, `formatCustomerProjectCode`, `parseCustomerProjectSequence`, `computeNextCustomerProjectCode`.
2. Mở `packages/shared/src/calculator.test.ts` và thêm bộ unit test kiểm tra:
   - Validate `shortName` hợp lệ (`NTRI`, `IKEA`, `ACG`, `AB`, `ABCDEF`) và không hợp lệ (`A` - 1 ký tự, `NITORI-HO CHI MINH` - >6 ký tự, chuỗi rỗng).
   - Sinh mã đầu tiên `NTRI 0001`, mã tiếp theo `NTRI 0002`, và trường hợp xóa mã ở giữa (`['NTRI 0001', 'NTRI 0003']` $\rightarrow$ sinh `NTRI 0004`).
3. Build gói `@cscc/shared` và chạy unit test.

## Validation
- Chạy `npm test --workspace=@cscc/shared` và `npm run build --workspace=@cscc/shared` thành công 100%.

## Risk / Rollback
- Chỉ thêm hàm tiện ích mới vào `@cscc/shared`, không ảnh hưởng tới bất kỳ hàm tính toán hiện có nào. Rollback: hoàn tác commit trên `packages/shared`.
