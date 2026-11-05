---
title: "Phase 02: Backend Report Service, RBAC & Excel Exporter"
phase: 2
status: completed
effort: "3h"
tags: [backend, api, rbac, exceljs, reports]
---

# Phase 02: Backend Report Service, RBAC & Excel Exporter

## Mục tiêu
Xây dựng tầng xử lý dữ liệu báo cáo (`report.service.ts`), bộ xuất file báo cáo Excel đa sheet (`report-excel.service.ts`) và các REST API `/api/reports/*` trong `apps/backend/src/app.ts` đảm bảo tuân thủ chặt chẽ phân quyền theo Salesman và bảo mật giá đối với `TECHNICAL`.

## Các file cần tạo/sửa đổi
- `apps/backend/src/services/report.service.ts` (Mới)
- `apps/backend/src/services/report-excel.service.ts` (Mới)
- `apps/backend/src/app.ts`

## Các bước thực hiện

### 1. Xây dựng `report.service.ts`
- Hàm lọc dữ liệu gốc theo phân quyền:
  - Nhận `userRole: UserRole` và `enforcedSalesmanFilter: string | null`.
  - Nếu `userRole === 'SALES' || userRole === 'TECHNICAL'`, bắt buộc lọc `Customer`, `Project`, `QuotationItem` theo `enforcedSalesmanFilter` (so khớp không phân biệt hoa thường). Nếu tài khoản `SALES`/`TECHNICAL` không có `salesmanName` hợp lệ, trả về tập rỗng để đảm bảo an toàn tuyệt đối (Zero Data Leak).
  - Nếu `userRole === 'ADMIN' || userRole === 'PROJECT_LEADER'`, cho phép xem toàn bộ dữ liệu hoặc lọc theo `query.salesmanName` do người dùng chọn.
- Hàm lọc `filterRevisionsByScope(revisions, revisionScope)`:
  - `ALL`: Giữ tất cả các Revision của mỗi Project.
  - `LATEST`: Chỉ giữ Revision có `revisionNo` lớn nhất của mỗi Project.
  - `APPROVED`: Chỉ giữ các Revision có `status === 'APPROVED' || status === 'LOCKED'`.
- Tính toán chi tiết cho từng Revision bằng `calculateCoatingCostTable(rev.id, rev.steps)` và `calculateBomSummary(rev.id, areaM2, rev.steps, userRole)`.
- Tính toán chi phí đóng góp của từng dòng hóa chất (`itemCoatingCostVndM2`) trong 1 bước sơn:
  - Với mỗi `ScheduleStepItem`, tỷ trọng lượng dùng = `mixingRatio / totalRatio`.
  - Định mức tiêu hao cả hao hụt của từng vật tư: `itemCaPlusLossGramM2 = stepCost.caPlusLossRaw * (item.mixingRatio / stepCost.totalRatio)`.
  - Chi phí đóng góp của vật tư đó trên 1 $m^2$: `itemCoatingCostRaw = (itemCaPlusLossGramM2 * item.priceSnapshotVnd) / 1000`.
- **Bảo mật giá cho `TECHNICAL` (`isTech = userRole === 'TECHNICAL'`)**:
  - Mọi trường đơn giá (`priceSnapshotVnd`, `latestQuotationPriceVnd`), chi phí `VND/m²` (`itemCoatingCostVndM2`, `revisionTotalCostVndM2`, `min/avg/maxCoatingCostVndM2`, `avgStepCostVndM2`, `costSharePercent`) và tổng tiền BOM (`totalEstimatedCostVnd`) đều trả về `null`.

### 2. Xây dựng `report-excel.service.ts`
- Tạo workbook `.xlsx` bằng `ExcelJS` với header song ngữ `EN / VI`, định dạng số chuẩn (`#,##0.00`), tô màu trạng thái, dòng tổng cộng (Summary KPIs):
  - Hỗ trợ xuất từng báo cáo cụ thể (`reportType`) hoặc xuất trọn bộ báo cáo tổng hợp (`ALL`).
  - Tự động ẩn/loại bỏ các cột giá tiền (`VND/Kg`, `VND/m²`, `Total VND`) khi `userRole === 'TECHNICAL'`.

### 3. Đăng ký Endpoints trong `apps/backend/src/app.ts`
- `GET /api/reports/overview`: Trả về trọn bộ dữ liệu phân tích đã lọc theo `ReportFilterQuery` (và tùy chọn `bomAllocations` cho báo cáo 6, `compareProjectId` / `baseRevId` / `targetRevId` cho báo cáo 3).
- `POST /api/reports/bom-forecast`: Tính toán nhanh dự báo BOM tổng hợp với diện tích `areaM2` tùy chỉnh cho danh sách Revisions được chọn.
- `GET /api/reports/export-excel`: Xuất file Excel `.xlsx` cho báo cáo đang chọn (hoặc tất cả báo cáo) với đầy đủ bộ lọc hiện hành.

## Tiêu chí hoàn thành (Verification)
- [ ] `npm run build -w @cscc/backend` biên dịch thành công.
- [ ] API `/api/reports/overview` trả về đúng dữ liệu theo role và salesman.

