---
title: "Phase 03: Frontend Navigation & Core Reports 1–2 (EN/VI)"
phase: 3
status: completed
effort: "2.5h"
tags: [frontend, react, reports, bilingual, ui]
---

# Phase 03: Frontend Navigation & Core Reports 1–2 (EN/VI)

## Mục tiêu
Tích hợp mục **Reports & Analytics / Báo cáo & Phân tích** vào thanh điều hướng chính của `App.tsx`, cập nhật `apiClient` và xây dựng giao diện `ReportsAnalyticsView.tsx` cho Thanh Bộ Lọc Toàn Cục cùng 2 báo cáo cốt lõi:
1. **Product Usage & Where-Used Report (`Theo Sản phẩm Sơn`)**
2. **Customer CS/CC Portfolio Report (`Theo Khách hàng`)**

## Các file cần tạo/sửa đổi
- `apps/frontend/src/api/client.ts`
- `apps/frontend/src/App.tsx`
- `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx` (Mới)

## Các bước thực hiện

### 1. Mở rộng `apiClient` (`apps/frontend/src/api/client.ts`)
- Bổ sung hàm `getReportsOverview(role, query)` gọi `GET /api/reports/overview`.
- Bổ sung hàm `calculateAggregatedBomForecast(role, payload)` gọi `POST /api/reports/bom-forecast`.
- Bổ sung hàm `getReportExportExcelUrl(role, query)` trả về đường dẫn tải file `.xlsx` kèm `role`, `salesmanName` và các tham số lọc.

### 2. Tích hợp vào `App.tsx`
- Mở rộng kiểu `MainSection = 'WORKSPACE' | 'PROJECTS' | 'REPORTS' | 'MASTER_DATA'`.
- Đồng bộ trạng thái `section=REPORTS` và `reportTab` lên URL query params & `localStorage`.
- Thêm nút điều hướng chính **"Reports & Analytics / Báo cáo"** với icon `BarChart3` trên Top Header Bar.
- Cho phép click vào bất kỳ bản Revision nào từ trong bảng Báo cáo để mở trực tiếp Revision đó trong màn hình `WORKSPACE` (Drill-down to CS/CC).

### 3. Xây dựng Bộ lọc Toàn cục & Báo cáo 1, 2 trong `ReportsAnalyticsView.tsx`
- **Thanh Bộ lọc Toàn cục (Global Filter Bar - Song ngữ EN/VI)**:
  - **Revision Scope Switcher**:
    - `All Revisions / Tất cả Rev` (`ALL`)
    - `Latest Rev Only / Chỉ Rev mới nhất` (`LATEST`)
    - `Approved Only / Chỉ bản Đã duyệt` (`APPROVED`)
  - **Salesman Scope**:
    - Nếu là `ADMIN` hoặc `PROJECT_LEADER`: Combobox lọc theo Salesman (`All Salesmen / Tất cả Salesman` hoặc chọn 1 Salesman cụ thể).
    - Nếu là `SALES` hoặc `TECHNICAL`: Hiển thị thẻ khóa cố định `Scoped to Salesman / Phạm vi Salesman: <tên salesman>`.
  - **Customer Filter & Finishing System Filter**.
  - **Nút Xuất Excel (`Export Report Excel / Xuất Excel Báo cáo`)**.
- **Tab 1: Product Usage & Where-Used (`Báo cáo Sử dụng Sản phẩm Sơn`)**:
  - Combobox chọn **Chemical Product (`materialCode — materialName`)** + bộ lọc phụ theo **Furniture Product (`productName`)**.
  - Thẻ KPI tổng hợp: Số khách hàng sử dụng, Số Project, Số bản CS/CC (`APPROVED` / `DRAFT`), Định mức tiêu hao trung bình (`g/m²`), và Chi phí trung bình (`VND/m²` — ẩn khi là `TECHNICAL`).
  - Bảng chi tiết từng CS/CC có sử dụng sản phẩm đó: Khách hàng, Salesman, Mã HS (`projectCode`), Tên SP & Màu, Số `Rev`, Trạng thái, Công đoạn (`Step`), Phương pháp (`Method`), Tỷ lệ pha, Định mức cả hao hụt (`g/m²`), Đơn giá Snapshot (`VND/Kg` — ẩn với `TECHNICAL`), Chi phí bước sơn (`VND/m²` — ẩn với `TECHNICAL`), Tổng CC của qui trình (`VND/m²` — ẩn với `TECHNICAL`), và nút Mở nhanh (`Open CS/CC`).
- **Tab 2: Customer CS/CC Portfolio (`Báo cáo Hồ sơ & Chi phí theo Khách hàng`)**:
  - Bảng Master thống kê từng Khách hàng: Mã SAP, Tên viết tắt, Tên đầy đủ, Salesman, Số Project, Tổng số CS/CC (`APPROVED` / `DRAFT`), Số mã hóa chất sử dụng, Định mức TB (`g/m²`), Coating Cost `Min / Avg / Max (VND/m²)` (ẩn với `TECHNICAL`).
  - Cho phép mở rộng (Expand) hoặc chọn 1 Khách hàng để xem toàn bộ danh sách các bản CS/CC chi tiết của khách hàng đó.

## Tiêu chí hoàn thành (Verification)
- [ ] Giao diện hiển thị chuẩn song ngữ EN/VI, chuyển đổi mượt giữa các bộ lọc Revision Scope (`ALL`, `LATEST`, `APPROVED`).
- [ ] Tài khoản `TECHNICAL` không nhìn thấy bất kỳ cột giá tiền nào trên Tab 1 và Tab 2.

