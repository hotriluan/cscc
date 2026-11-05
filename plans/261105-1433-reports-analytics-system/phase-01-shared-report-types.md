---
title: "Phase 01: Shared Report Types & Contracts"
phase: 1
status: completed
effort: "1.5h"
tags: [shared, types, reports, analytics]
---

# Phase 01: Shared Report Types & Contracts

## Mục tiêu
Định nghĩa đầy đủ các interface, kiểu bộ lọc (`RevisionScopeFilter`, `ReportFilterParams`) và cấu trúc dữ liệu đầu ra cho cả 7 báo cáo phân tích tại `packages/shared/src/types.ts` để dùng chung đồng nhất giữa Backend và Frontend.

## Các file cần sửa đổi
- `packages/shared/src/types.ts`
- `packages/shared/src/index.ts`

## Các bước thực hiện

### 1. Bổ sung kiểu Bộ lọc Báo cáo (`packages/shared/src/types.ts`)
- Định nghĩa `RevisionScopeFilter`:
  ```typescript
  export type RevisionScopeFilter = 'ALL' | 'LATEST' | 'APPROVED';

  export type ReportSubTab =
    | 'PRODUCT_USAGE'
    | 'CUSTOMER_PORTFOLIO'
    | 'REVISION_VARIANCE'
    | 'PRICE_DRIFT'
    | 'STEP_BENCHMARK'
    | 'BOM_FORECAST'
    | 'ACTIVITY_FUNNEL';

  export interface ReportFilterQuery {
    revisionScope?: RevisionScopeFilter;
    salesmanName?: string;
    customerId?: string;
    materialCode?: string;
    productName?: string;
    finishingSystem?: string;
    substrate?: string;
    q?: string;
  }
  ```

### 2. Định nghĩa DTO cho 7 Báo cáo (`packages/shared/src/types.ts`)
1. **`ProductUsageReport` (Báo cáo 1 - Theo Sản phẩm Sơn)**:
   - `productCatalog`: Danh sách các vật tư hóa chất (`materialCode`, `materialName`, `packingDesc`, `nettWeight`, `usageRevisionCount`, `customerCount`) để người dùng chọn trong Combobox.
   - `furnitureProducts`: Danh sách các tên sản phẩm nội thất (`productName`) để lọc kết hợp.
   - `summary`: `{ totalCustomers, totalProjects, totalRevisions, approvedRevisions, draftRevisions, avgCaPlusLossGramM2, avgItemCostVndM2: number | null, minItemCostVndM2: number | null, maxItemCostVndM2: number | null }`
   - `usages`: Danh sách từng lần xuất hiện trong CS/CC kèm đầy đủ thông tin Khách hàng, Salesman, Project Code, `revisionId`, `revisionNo`, `status`, `scheduleDate`, `productName`, `colorName`, `substrate`, `finishingSystem`, `stepNumber`, `stepName`, `methodName`, `mixingRatio`, `ratioShare`, `itemCaPlusLossGramM2`, `priceSnapshotVnd: number | null`, `itemCoatingCostVndM2: number | null`, `revisionTotalCostVndM2: number | null`.
2. **`CustomerPortfolioReport` (Báo cáo 2 - Theo Khách hàng)**:
   - `summary`: `{ totalCustomers, activeCustomersWithProjects, totalProjects, totalRevisions, approvedRevisions, draftRevisions, avgRevisionCostVndM2: number | null }`
   - `customers`: Danh sách tổng hợp từng khách hàng (`customerId`, `shortName`, `customerName`, `salesmanName`, `projectCount`, `totalRevisionCount`, `approvedRevisionCount`, `draftRevisionCount`, `distinctMaterialCount`, `distinctProductCount`, `totalConsumptionGramM2Avg`, `minCoatingCostVndM2: number | null`, `avgCoatingCostVndM2: number | null`, `maxCoatingCostVndM2: number | null`, `revisions: CustomerRevisionReportRow[]`).
3. **`RevisionVarianceReport` (Báo cáo 3 - So sánh Biến động Revision)**:
   - Danh sách các Project kèm so sánh giữa `baseRevision` và `targetRevision` (hoặc chọn cặp `baseRevId` / `targetRevId`): chênh lệch tổng `VND/m²` (`null` cho TECHNICAL), `%` biến động, chênh lệch tổng `g/m²`, chênh lệch số bước sơn, và mảng `itemDiffs` (`ADDED` | `REMOVED` | `CHANGED` | `UNCHANGED`).
4. **`PriceDriftReport` (Báo cáo 4 - Cảnh báo Chênh lệch Giá & Báo giá)**:
   - Danh sách các dòng vật tư trong CS/CC có sự khác biệt giữa `priceSnapshotVnd` và `latestQuotationPriceVnd` hoặc thiếu báo giá / báo giá hết hạn (`validTo`), kèm tác động chênh lệch lên tổng `Coating Cost (VND/m²)` của toàn Revision (`null` cho TECHNICAL).
5. **`StepSystemBenchmarkReport` (Báo cáo 5 - Cơ cấu Chi phí theo Công đoạn & Hệ sơn)**:
   - `byStep`: Thống kê theo `stepName` (`occurrenceCount`, `revisionCount`, `avgCaPlusLossGramM2`, `avgStepCostVndM2: number | null`, `costSharePercent: number | null`).
   - `bySystem`: Thống kê theo `finishingSystem` & `substrate` (`revisionCount`, `customerCount`, `avgStepCount`, `avgTotalCaPlusLossGramM2`, `minCostVndM2: number | null`, `avgCostVndM2: number | null`, `maxCostVndM2: number | null`).
6. **`AggregatedBomForecastReport` (Báo cáo 6 - Dự báo Nhu cầu Vật tư BOM Tổng hợp)**:
   - Nhận danh sách `{ revisionId, areaM2 }[]` (hoặc mặc định `defaultAreaM2` của các Revision trong bộ lọc) -> Tổng hợp nhu cầu theo từng `materialCode`: `totalRequiredKgOrLtr`, `totalPacksExact`, `totalPacksRounded`, `usedInRevisionsCount`, `usedByCustomersCount`, `avgPriceUnitVnd: number | null`, `totalEstimatedCostVnd: number | null`.
7. **`SalesTechnicalActivityReport` (Báo cáo 7 - Hiệu suất Salesman & Kỹ thuật TA)**:
   - `bySalesman`: Thống kê theo `salesmanName` (`customerCount`, `activeCustomerCount`, `projectCount`, `totalRevisions`, `approvedRevisions`, `draftRevisions`, `approvalRatePercent`, `avgRevisionsPerProject`, `avgCoatingCostVndM2: number | null`).
   - `byTechnicalTa`: Thống kê theo `preparedByTa` (`projectCount`, `totalRevisions`, `approvedRevisions`, `draftRevisions`, `approvalRatePercent`, `distinctSystemsCount`, `avgStepCount`).

## Tiêu chí hoàn thành (Verification)
- [ ] `npm run build -w @cscc/shared` biên dịch thành công không có lỗi TypeScript.

