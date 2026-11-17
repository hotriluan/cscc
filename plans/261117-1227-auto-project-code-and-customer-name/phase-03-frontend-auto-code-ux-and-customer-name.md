# Phase 3 — Frontend Auto-Code UX, Read-Only Code Field & `customerName` Display

## Context
Trên giao diện người dùng hiện tại:
- Modal **Create New Project** (`ProjectExplorerView.tsx`) và phần Header của **Coating Schedule** (`CoatingScheduleEditor.tsx`) đang bắt người dùng tự gõ tay `No. / Mã hồ sơ`.
- Khi đổi Khách hàng trên tab CS, hệ thống chưa kiểm tra `Short Name` 2–6 ký tự và chưa tự động cấp lại `projectCode` theo khách hàng mới.
- Tất cả các màn hình (CS, CC, Bản in A4, Project Explorer, Sidebar, Reports) đang hiển thị `customer.shortName` thay vì `customer.customerName`.

## Requirements
1. **API Client (`apps/frontend/src/api/client.ts`):**
   - Thêm hàm `getNextProjectCode(role: UserRole, customerId: string, excludeProjectId?: string)` gọi `GET /api/projects/next-code`.

2. **Modal Tạo Hồ Sơ Mới & Danh sách Dự án (`apps/frontend/src/components/projects/ProjectExplorerView.tsx`):**
   - Trong modal **Create New Project**:
     - Khi người dùng chọn Khách hàng (`newCustomerId`):
       - Kiểm tra ngay `isValidCustomerShortName(selectedCustomer.shortName, selectedCustomer.customerName)`.
       - Nếu **chưa hợp lệ** (ví dụ khách hàng cũ chưa rút gọn `Short Name` về 2–6 ký tự): Hiển thị cảnh báo nổi bật yêu cầu cập nhật `Short Name` (2–6 ký tự) cho khách hàng này tại mục **Master Data $\rightarrow$ Customers** trước, xóa mã dự kiến và khóa nút tạo hồ sơ.
       - Nếu **hợp lệ**: Tự động tính mã dự kiến bằng `computeNextCustomerProjectCode` (và đồng bộ qua `apiClient.getNextProjectCode`) để hiển thị ngay trong ô `No. / Mã Hồ sơ` (ví dụ `NTRI 0001`).
     - Chuyển ô `No. / Mã Hồ sơ` thành `readOnly` (nền xám nhạt + nhãn `"Auto / Tự động"`), không cho nhập tay.
   - Trên bảng danh sách dự án và các combobox chọn Khách hàng trong `ProjectExplorerView.tsx`:
     - Hiển thị chính là **`customer.customerName`**, kèm badge/sublabel hiển thị `Short Name: ${customer.shortName} • SAP: ${customer.customerId}`.

3. **Màn hình Coating Schedule (`apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`):**
   - **Ô `No. / Mã hồ sơ`:** Chuyển thành `readOnly` (`disabled`), hiển thị rõ đây là mã tự động theo khách hàng.
   - **Khi người dùng đổi Khách hàng trên hồ sơ `DRAFT` (`handleCustomerSelect`):**
     - Kiểm tra `isValidCustomerShortName(found.shortName, found.customerName)`.
     - Nếu khách hàng được chọn **chưa cập nhật `Short Name` (2–6 ký tự)**: Không cho phép đổi sang khách hàng đó và hiển thị thông báo cảnh báo ngay dưới combobox Khách hàng:
       `⚠️ Khách hàng "${found.customerName}" chưa cập nhật Short Name (2–6 ký tự). Vui lòng vào Master Data -> Customers cập nhật Short Name trước.`
     - Nếu **hợp lệ**: Gọi `apiClient.getNextProjectCode` (kèm fallback tính nhanh từ danh sách dự án/hàm shared) để lấy mã hồ sơ mới của khách hàng mới (VD: `IKEA 0001`), cập nhật đồng thời `customer: found` và `projectCode: nextCode` vào state `revision` và kích hoạt Auto-Save (`mode: 'discrete'`).
   - **Hiển thị Tên khách hàng:**
     - Combobox chọn khách hàng: `label` dùng `c.customerName`, `sublabel` hiển thị `Short: ${c.shortName} • SAP: ${c.customerId}${c.salesmanName ? ` • Sales: ${c.salesmanName}` : ''}`, `badge` hiển thị `${c.shortName} (${c.customerId})`.
     - Thanh thu gọn Header (dòng 763) và thông báo thiếu báo giá (dòng 1446): Đổi từ `revision.customer?.shortName` sang `revision.customer?.customerName`.

4. **Màn hình Coating Cost (`apps/frontend/src/components/cost/CoatingCostTable.tsx`) & Bản in A4 (`apps/frontend/src/components/print/PrintableSheetA4.tsx`):**
   - Trong `CoatingCostTable.tsx` (dòng 130): Đổi `Customer Name / Khách hàng:` sang `{revision.customer.customerName}`.
   - Trong `PrintableSheetA4.tsx` (dòng 158): Đổi `Customer / Khách hàng:` sang `{revision.customer.customerName}`.

5. **Sidebar, Status History Modal, Master Data & Reports (`App.tsx`, `MasterDataManager.tsx`, `ReportsAnalyticsView.tsx`):**
   - `App.tsx`:
     - Sidebar danh sách dự án (dòng 1336, 1358): Hiển thị `{proj.projectCode} — {proj.customer.customerName}`.
     - Tìm kiếm Sidebar (dòng 564): Tìm kiếm trên cả `projectCode`, `customer.shortName`, `customer.customerName`, `customer.customerId`.
     - Status History Modal (dòng 2157): Hiển thị `{activeRevision.customer.customerName}`.
   - `MasterDataManager.tsx`:
     - Form Thêm/Sửa Customer: Tự động `toUpperCase()` khi gõ `Short Name`, placeholder `"Short Name (2-6 ký tự, VD: NTRI)"`, kiểm tra độ dài 2–6 ký tự trước khi lưu (hiển thị lỗi rõ ràng nếu < 2 hoặc > 6 ký tự).
     - Trên bảng Customer Master: Hiển thị badge cảnh báo nhỏ nếu dòng khách hàng cũ nào chưa rút gọn `Short Name` về 2–6 ký tự để người dùng dễ nhận biết và sửa.
     - Combobox chọn khách hàng ở tab Quotations: Hiển thị `${c.customerId} — ${c.customerName} (${c.shortName})`.
   - `ReportsAnalyticsView.tsx`:
     - Combobox lọc khách hàng và các bảng hiển thị khách hàng: Hiển thị `customerName` đầy đủ.

## Files
- Modify: `apps/frontend/src/api/client.ts`
- Modify: `apps/frontend/src/components/projects/ProjectExplorerView.tsx`
- Modify: `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`
- Modify: `apps/frontend/src/components/cost/CoatingCostTable.tsx`
- Modify: `apps/frontend/src/components/print/PrintableSheetA4.tsx`
- Modify: `apps/frontend/src/components/master/MasterDataManager.tsx`
- Modify: `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx`
- Modify: `apps/frontend/src/App.tsx`

## Steps
1. Cập nhật `apps/frontend/src/api/client.ts` thêm `getNextProjectCode`.
2. Cập nhật `ProjectExplorerView.tsx` và `CoatingScheduleEditor.tsx` cho luồng tự động sinh mã, khóa ô nhập tay `No. / Mã hồ sơ`, tự cấp lại mã khi đổi KH ở tab CS, và cảnh báo khi KH chưa có `Short Name` 2–6 ký tự.
3. Cập nhật `CoatingCostTable.tsx`, `PrintableSheetA4.tsx`, `App.tsx`, `MasterDataManager.tsx`, và `ReportsAnalyticsView.tsx` chuyển hiển thị tên khách hàng sang `customerName` và kiểm tra độ dài `Short Name` 2–6 ký tự.

## Validation
- Chạy `npm run typecheck --workspace=@cscc/frontend` và `npm run build --workspace=@cscc/frontend` thành công 100%.

## Risk / Rollback
- Chỉ thay đổi tầng hiển thị và form tương tác trên Frontend. Rollback: hoàn tác các file trong `apps/frontend/src/`.
