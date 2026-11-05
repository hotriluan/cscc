---
title: "Reports & Analytics System with Role & Salesman Data Isolation"
description: "Phân hệ Báo cáo & Phân tích dữ liệu toàn diện (7 loại báo cáo CS/CC/BOM/Quotation), hỗ trợ lọc linh hoạt theo Revision (All/Latest/Approved), bảo mật giá đối với TECHNICAL, phân vùng dữ liệu theo Salesman cho SALES/TECHNICAL, xuất Excel và giao diện song ngữ EN/VI."
status: completed
priority: P1
effort: "10h"
tags: [feature, reports, analytics, rbac, excel-export, frontend, backend, shared]
blockedBy: []
blocks: []
created: 2026-11-05
---

# Reports & Analytics System with Role & Salesman Data Isolation

## Overview & Brainstorm Contract

### 1. Outcome (Kết quả đầu ra)
Xây dựng phân hệ **Reports & Analytics / Báo cáo & Phân tích** đồng bộ chuẩn song ngữ **English / Tiếng Việt (EN/VI)** với đầy đủ **7 báo cáo phân tích chuyên sâu** kèm tính năng **Xuất báo cáo Excel (`.xlsx`)**:
1. **Product Usage & Where-Used Report (`Báo cáo Tần suất & Chi phí theo Sản phẩm Sơn`)**: Chọn 1 Product (`materialCode` / `materialName` hoặc lọc theo `productName`) -> Thống kê số lượng CS/CC sử dụng, thuộc khách hàng nào, dự án nào, `Rev` bao nhiêu, công đoạn nào, định mức `g/m²` và chi phí `VND/m²`.
2. **Customer CS/CC Portfolio Report (`Báo cáo Thống kê Hồ sơ & Chi phí theo Khách hàng`)**: Thống kê mỗi khách hàng có bao nhiêu dự án, bao nhiêu bản CS/CC (tách rõ `APPROVED` / `DRAFT`), số mã hóa chất sử dụng, chi phí Coating Cost `Min / Avg / Max (VND/m²)` và danh sách chi tiết từng CS/CC.
3. **Revision Cost & Spec Variance Report (`Báo cáo So sánh Biến động giữa các Revision`)**: So sánh `Rev A` và `Rev B` của cùng dự án về biến động chi phí (`VND/m²`, `%`), biến động định mức (`g/m²`), số bước sơn và chi tiết từng dòng vật tư thêm/bớt/thay đổi.
4. **Price Drift & Quotation Alert Report (`Báo cáo Chênh lệch Giá Snapshot & Cảnh báo Báo giá`)**: Đối chiếu `priceSnapshotVnd` đang lưu trong CS/CC với `priceUnitVnd` mới nhất trong bảng giá `QuotationItem`, phát hiện các hồ sơ bị lệch giá hoặc báo giá hết hạn (`validTo`).
5. **Step & Finishing System Benchmark Report (`Báo cáo Cơ cấu Chi phí theo Công đoạn & Hệ sơn`)**: Phân tích tỷ trọng chi phí (`% VND/m²`) và định mức (`g/m²`) theo từng bước công đoạn (`stepName`) và so sánh chuẩn chi phí theo Hệ sơn (`finishingSystem`) / Loại gỗ (`substrate`).
6. **Aggregated Multi-Project BOM Forecast (`Báo cáo Dự báo Nhu cầu Vật tư BOM Tổng hợp`)**: Gộp nhu cầu vật tư hóa chất (`Kg/Ltr`, `Packs to Order`, `Thành tiền VND`) của nhiều bản CS/Revision cùng lúc theo diện tích `m²` tùy chỉnh.
7. **Salesman & Technical Activity Funnel (`Báo cáo Hiệu suất Hoạt động Sales & Kỹ thuật TA`)**: Thống kê số lượng khách hàng, dự án, số bản CS/CC, tỷ lệ duyệt (`Approval Rate %`), số lần sửa đổi trung bình (`Avg Revisions/Project`) theo từng Salesman và Kỹ thuật viên (`preparedByTa`).

### 2. Constraints (Ràng buộc kỹ thuật & Phân quyền RBAC)
- **Row-level RBAC theo Salesman**:
  - Tài khoản thuộc nhóm **`SALES`** và **`TECHNICAL` (TA)**: Chỉ thống kê và xuất báo cáo trên dữ liệu của các khách hàng thuộc `salesmanName` được gán cho tài khoản đó.
  - Tài khoản thuộc nhóm **`ADMIN`** và **`PROJECT_LEADER`**: Toàn quyền thống kê và xuất báo cáo trên tất cả dữ liệu của toàn bộ khách hàng và Salesman (hỗ trợ bộ lọc chọn từng Salesman hoặc Tất cả).
- **Column-level RBAC (Bảo mật giá đối với `TECHNICAL`)**:
  - Tài khoản **`TECHNICAL` (TA)** giữ nguyên bảo mật giá: chỉ xem được số lượng Coating Schedule, thông số kỹ thuật, định mức tiêu hao (`g/m²`, `Kg/Ltr`, `Packs`), tên khách hàng, số `Rev`; **ẩn hoàn toàn (`null`) các cột đơn giá (`VND/Kg`) và thành tiền Coating Cost (`VND/m²`, `VND`)** cả trên giao diện và trong file Excel xuất ra.
- **Bộ lọc Phạm vi Revision (`Revision Scope Filter`)**:
  - Hỗ trợ chuyển đổi linh hoạt giữa 3 chế độ trên toàn bộ các báo cáo:
    - `ALL`: Tất cả Revisions (`All Revisions / Tất cả Revisions`)
    - `LATEST`: Chỉ Revision mới nhất của mỗi Project (`Latest Rev Only / Chỉ Revision mới nhất`)
    - `APPROVED`: Chỉ các bản đã duyệt (`Approved Only / Chỉ bản Đã duyệt`)
- **Chuẩn giao diện**: Song ngữ **English / Tiếng Việt (EN/VI)** đồng bộ 100% với thiết kế hiện có của dự án.

### 3. Non-goals (Không nằm trong phạm vi)
- Không thay đổi công thức tính toán gốc của CS/CC/BOM trong `@cscc/shared`.
- Không thay đổi cấu trúc bảng dữ liệu lịch sử của `Project`, `ProjectRevision`, `ScheduleStep`, `ScheduleStepItem`.

### 4. Trade-offs & Better Approaches
- **Trade-offs**: Tính toán động qua tầng dịch vụ Backend (`report.service.ts`) sử dụng trực tiếp `calculateCoatingCostTable` và `calculateBomSummary` đảm bảo độ chính xác tuyệt đối 100% theo chuẩn IEEE-754 với màn hình Workspace và bảo mật dữ liệu tại Server, đổi lại cần truy vấn kèm `steps.items` từ PostgreSQL.
- **Better approaches**: `none — recommended direction is Dedicated Backend Reporting Service + Bilingual React Analytics View + ExcelJS Multi-Sheet Exporter`.

---

## Architecture & Data Flow

```text
[ Frontend: ReportsAnalyticsView.tsx (MainSection = 'REPORTS') ]
  ├─ Global Filter Bar (EN/VI):
  │    • Revision Scope: ALL | LATEST | APPROVED
  │    • Salesman Filter (All/Select for Admin & Leader; Locked to own salesman for Sales/TA)
  │    • Customer Filter & Quick Search
  │    • Export Report to Excel (.xlsx)
  ├─ 7 Report Sub-Tabs (EN/VI):
  │    1. Product Usage (Theo Sản phẩm Sơn)
  │    2. Customer Portfolio (Theo Khách hàng)
  │    3. Revision Variance (Biến động Revision)
  │    4. Price Drift Alert (Chênh lệch Giá & Báo giá)
  │    5. Step & System Benchmark (Chuẩn Công đoạn & Hệ sơn)
  │    6. Aggregated BOM Forecast (Dự báo BOM Tổng hợp)
  │    7. Sales & TA Activity (Hiệu suất Sales & TA)
             │
             ▼ (REST API with JWT Bearer + RBAC Headers)
[ Backend: /api/reports/* + report.service.ts + report-excel.service.ts ]
  ├─ Row-level Filter: getSalesmanFilter(req) -> Scopes Customer/Project/Quotation by salesmanName
  ├─ Revision Scope Filter: Filters project.revisions by ALL | LATEST | APPROVED
  ├─ Calculation Engine: Reuses calculateCoatingCostTable() & calculateBomSummary()
  └─ Column-level Redaction: Redacts all VND/m² & VND/Kg fields to null when req.userRole === 'TECHNICAL'
```

---

## Phases Roadmap

| # | Phase | Effort | Status | Description |
|---|-------|--------|--------|-------------|
| 1 | [Shared Report Types & Contracts](./phase-01-shared-report-types.md) | 1.5h | Completed | Định nghĩa đầy đủ kiểu dữ liệu, bộ lọc `RevisionScopeFilter` và cấu trúc trả về cho 7 báo cáo trong `@cscc/shared`. |
| 2 | [Backend Report Service, RBAC & Excel Exporter](./phase-02-backend-report-service-and-excel.md) | 3h | Completed | Xây dựng `report.service.ts`, `report-excel.service.ts` và các API `/api/reports/*` tuân thủ phân quyền Salesman và che giá với `TECHNICAL`. |
| 3 | [Frontend Navigation & Core Reports 1–2 (EN/VI)](./phase-03-frontend-core-reports-ui.md) | 2.5h | Completed | Tích hợp mục `REPORTS` vào thanh điều hướng `App.tsx`, xây dựng bộ lọc toàn cục và 2 báo cáo cốt lõi (Theo Sản phẩm & Theo Khách hàng). |
| 4 | [Frontend Advanced Analytical Reports 3–7 (EN/VI)](./phase-04-frontend-advanced-reports-ui.md) | 2h | Completed | Xây dựng giao diện chi tiết cho 5 báo cáo chuyên sâu (Revision Variance, Price Drift, Benchmark, Multi-BOM Forecast, Activity Funnel). |
| 5 | [Automated Testing & End-to-End Verification](./phase-05-automated-testing-and-verification.md) | 1h | Completed | Viết bộ kiểm thử tự động kiểm tra tính đúng đắn của 7 báo cáo, 3 chế độ lọc Revision, phân quyền Salesman, bảo mật giá `TECHNICAL` và xuất Excel. |

## Dependencies

- Shared Package: `packages/shared/src/types.ts`, `packages/shared/src/index.ts`
- Backend: `apps/backend/src/services/report.service.ts`, `apps/backend/src/services/report-excel.service.ts`, `apps/backend/src/app.ts`
- Frontend: `apps/frontend/src/App.tsx`, `apps/frontend/src/api/client.ts`, `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx`

## Acceptance Criteria

- [x] Chọn một Product (`materialCode` / `materialName` hoặc lọc `productName`) hiển thị chính xác số lượng CS/CC, khách hàng, mã dự án, số `Rev`, bước sơn, định mức `g/m²` và chi phí `VND/m²`.
- [x] Thống kê theo Khách hàng hiển thị tổng số Project, số bản CS/CC (`APPROVED` / `DRAFT`), số vật tư, Coating Cost (`Min/Avg/Max`) và danh sách drill-down.
- [x] Đầy đủ 7 sub-tab báo cáo hoạt động mượt mà với bộ lọc chuyển đổi `ALL` | `LATEST` | `APPROVED`.
- [x] Tài khoản `SALES` và `TECHNICAL` chỉ nhận được dữ liệu báo cáo của khách hàng thuộc `salesmanName` được gán.
- [x] Tài khoản `ADMIN` và `PROJECT_LEADER` xem được toàn bộ dữ liệu và lọc được theo từng Salesman.
- [x] Tài khoản `TECHNICAL` không nhìn thấy bất kỳ cột giá tiền (`VND/Kg`, `VND/m²`, tổng tiền `VND`) nào trên cả giao diện web và file Excel báo cáo.
- [x] Giao diện tuân thủ chuẩn song ngữ `English / Tiếng Việt` đồng bộ toàn dự án.

<!-- slug: reports-analytics-system -->

