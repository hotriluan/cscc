# Phase 2 — Backend Auto-Code Engine, Customer Switch & Excel/Report Updates

## Context
Hiện tại `dataStore.createProject` (`apps/backend/src/store/data-store.ts`) nhận `projectCode` nhập thủ công hoặc sinh `PRJ-${totalProjects + 1}`, và `updateRevision` cho phép sửa `projectCode` tùy ý nhưng không tự động cấp lại `projectCode` khi đổi `customerId`. Ngoài ra, `excel-exporter.service.ts`, `report.service.ts`, và `report-excel.service.ts` đang hiển thị `customer.shortName` thay vì `customer.customerName`.

## Requirements
1. **Hàm sinh mã tự động & Kiểm tra `shortName` trong `PostgresDataStore` (`apps/backend/src/store/data-store.ts`):**
   - Viết phương thức `previewNextProjectCode(customerIdOrCode: string, excludeProjectId?: string): Promise<{ customer: Customer; nextCode: string }>`:
     - Tìm bản ghi `Customer` theo `id` hoặc `customerId`. Nếu không tồn tại $\rightarrow$ báo lỗi 404.
     - Kiểm tra `isValidCustomerShortName(customer.shortName, customer.customerName)`. Nếu không hợp lệ (ví dụ khách hàng cũ chưa rút gọn `shortName` về 2–6 ký tự) $\rightarrow$ ném lỗi nghiệp vụ rõ ràng (mã `INVALID_CUSTOMER_SHORT_NAME`):
       `"Khách hàng \"${customer.customerName}\" (${customer.customerId}) chưa có Short Name hợp lệ (2–6 ký tự, hiện tại: \"${customer.shortName}\"). Vui lòng cập nhật Short Name cho khách hàng này tại mục Master Data -> Customers trước."`
     - Truy vấn tất cả `projectCode` hiện có của khách hàng này (hoặc có prefix `${shortName} `, trừ `excludeProjectId` nếu có), dùng `computeNextCustomerProjectCode` để tính mã tiếp theo (VD: `NTRI 0001`), kèm vòng lặp kiểm tra `unique` phòng trường hợp xung đột.
   - Trong `createProject`:
     - Tự động gọi logic sinh mã `[shortName] [0001]` cho khách hàng được chọn (nếu `shortName` của khách hàng chưa hợp lệ 2–6 ký tự thì chặn và trả về lỗi `INVALID_CUSTOMER_SHORT_NAME`).
   - Trong `updateRevision`:
     - Không cho phép ghi đè `projectCode` thủ công từ request body.
     - **Khi người dùng đổi Khách hàng (`newCustomerId && newCustomerId !== existing.customer.id`) trên hồ sơ `DRAFT`:**
       - Kiểm tra khách hàng mới phải có `shortName` hợp lệ (2–6 ký tự); nếu chưa có thì trả về lỗi 400 với thông báo nhắc cập nhật `Short Name` trước.
       - Tự động sinh `newProjectCode` mới theo khách hàng mới (ví dụ đổi sang `IKEA` $\rightarrow$ cấp `IKEA 0001`) và cập nhật cả `customerId` lẫn `projectCode` vào bảng `Project` trong Transaction.
   - Trong `upsertCustomer` và `updateCustomer`:
     - Chuẩn hóa `shortName = normalizeCustomerShortName(input.shortName)`.
     - Kiểm tra `isValidCustomerShortName(shortName)` khi tạo mới hoặc sửa khách hàng trực tiếp từ form Master Data; nếu không đạt 2–6 ký tự thì báo lỗi rõ ràng.
   - Trong `buildGoldenDatasetNtr001` (`apps/backend/src/services/excel-importer.service.ts`):
     - Cập nhật fallback `shortName` của khách hàng mẫu Nitori (`1200001169`) thành `'NTRI'` (hoặc chuẩn hóa trong seed nếu file Excel vẫn để tên dài cho khách hàng mẫu) để khách hàng mẫu hoạt động mượt mà ngay từ đầu.

2. **API Routes tại `apps/backend/src/app.ts`:**
   - Thêm endpoint `GET /api/projects/next-code?customerId=...` (hỗ trợ truyền thêm `&excludeProjectId=...`) trả về `{ nextCode, shortName, customerId, customerName }` hoặc HTTP 400 `{ error: 'INVALID_CUSTOMER_SHORT_NAME', message }` nếu khách hàng chưa cập nhật `Short Name` 2–6 ký tự.
   - Trong `POST /api/master/customers` và `PUT /api/master/customers/:id`, trả về HTTP 400 nếu `shortName` không nằm trong độ dài 2–6 ký tự.
   - Trong `GET /api/master/templates/customers`, cập nhật dòng mẫu Excel từ `'NITORI-HO CHI MINH'` thành `'NTRI'` để hướng dẫn đúng chuẩn 4 ký tự.

3. **Chuyển hiển thị Tên khách hàng sang `customerName` ở Backend Services:**
   - `apps/backend/src/services/excel-exporter.service.ts` (dòng 93):
     - Đổi `['Customer / Khách hàng:', revision.customer.shortName, ...]` thành `['Customer / Khách hàng:', revision.customer.customerName, ...]` (áp dụng đồng thời cho cả sheet `CS` và sheet `CC`).
   - `apps/backend/src/services/report.service.ts` & `apps/backend/src/services/report-excel.service.ts`:
     - Trên các dòng báo cáo (`ProductUsageRow`, `ProductUsageRevisionRow`, `ProjectRevisionVarianceRow`, `PriceDriftRow`, `BomForecastRevisionAllocation`, `CustomerPortfolioRow`), đảm bảo tên khách hàng hiển thị trên báo cáo và file Excel xuất ra sử dụng `customer.customerName` (tên đầy đủ), đồng thời vẫn giữ khả năng tìm kiếm (`q`) theo cả `shortName`, `customerName` và `customerId`.

## Files
- Modify: `apps/backend/src/store/data-store.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/services/excel-exporter.service.ts`
- Modify: `apps/backend/src/services/excel-importer.service.ts`
- Modify: `apps/backend/src/services/report.service.ts`
- Modify: `apps/backend/src/services/report-excel.service.ts`

## Steps
1. Cập nhật `data-store.ts`: thêm `previewNextProjectCode`, cập nhật `createProject`, `updateRevision` (tự sinh lại mã khi đổi khách hàng trên bản nháp `DRAFT`), và kiểm tra `shortName` 2–6 ký tự trong `upsertCustomer` / `updateCustomer`.
2. Cập nhật `app.ts`: thêm route `GET /api/projects/next-code`, cập nhật validation Customer CRUD và template Excel.
3. Cập nhật `excel-exporter.service.ts` để xuất `revision.customer.customerName` trên header `CS` và `CC`.
4. Cập nhật `report.service.ts` và `report-excel.service.ts` để hiển thị tên đầy đủ `customerName` của khách hàng.

## Validation
- Chạy `npm run typecheck --workspace=@cscc/backend` không có lỗi biên dịch.
- Test thử API `GET /api/projects/next-code`, `POST /api/projects`, và `PUT /api/revisions/:id` (khi đổi `customerId`).

## Risk / Rollback
- Không thay đổi cấu trúc bảng PostgreSQL nên không có rủi ro mất dữ liệu. Rollback: hoàn tác các file trong `apps/backend/src/`.
