---
title: "Phase 01: Shared Types & Backend Revision Rollup Service"
phase: 1
status: completed
effort: "1.0h"
tags: [shared, backend, reports, product-usage, excel-export]
---

# Phase 01: Shared Types & Backend Revision Rollup Service

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Shared Types: [packages/shared/src/types.ts](../../packages/shared/src/types.ts)
- Backend Report Service: [apps/backend/src/services/report.service.ts](../../apps/backend/src/services/report.service.ts)
- Backend Excel Exporter: [apps/backend/src/services/report-excel.service.ts](../../apps/backend/src/services/report-excel.service.ts)
- Backend Routes: [apps/backend/src/app.ts](../../apps/backend/src/app.ts)

## Overview
- **Priority**: P1
- **Current status**: Pending
- **Description**: Bổ sung kiểu dữ liệu phân cấp `ProductUsageRevisionRow` (cấp Revision) và `ProductUsageStepBreakdownRow` (cấp Step con) vào `@cscc/shared`; cập nhật `generateReportsOverview` trong `report.service.ts` để:
  1. Không sinh dữ liệu chi tiết `usages` và `revisionUsages` khi chưa chọn mã sơn cụ thể (`selectedMaterialCode === null`), giúp tiết kiệm tài nguyên tối đa khi khởi tạo trang báo cáo.
  2. Khi người dùng đã chọn 1 mã sơn (`selectedMaterialCode` có giá trị), vừa tạo mảng phẳng `usages` (`ProductUsageRow[]` phục vụ xuất Excel PivotTable), vừa gom nhóm chính xác theo từng Revision (`revisionUsages: ProductUsageRevisionRow[]`) kèm các chỉ số tổng hợp của sản phẩm trong Revision và mảng `steps` con để Breakdown trên Web.

## Key Insights
- Trong [`report.service.ts`](../../apps/backend/src/services/report.service.ts#L599-L650), hiện tại khi `selectedMaterialCode === null`, vòng lặp vẫn đẩy toàn bộ các dòng `ScheduleStepItem` của mọi Revision vào `productUsageRows`. Chỉ cần kiểm tra `if (selectedMaterialCode)` trước khi duyệt sinh `productUsageRows` và `revisionUsages`, hệ thống sẽ trả về ngay `usages: []` và `revisionUsages: []` khi chưa chọn sản phẩm, trong khi `productCatalog` vẫn được tính đầy đủ để hiển thị trên Combobox tìm kiếm.
- Trong [`report-excel.service.ts`](../../apps/backend/src/services/report-excel.service.ts#L68-L156), Sheet `1_Product_Usage` đọc từ `overview.productUsage.usages`. Do `usages` vẫn giữ nguyên cấu trúc phẳng `ProductUsageRow[]` khi đã chọn sản phẩm (hoặc khi xuất Excel), tính năng `Export Active Tab (.xlsx)` giữ nguyên 100% các cột như hiện tại để chạy PivotTable.

## Requirements
- **Functional**:
  - Thêm interface `ProductUsageStepBreakdownRow` và `ProductUsageRevisionRow` vào [`packages/shared/src/types.ts`](../../packages/shared/src/types.ts), và bổ sung trường `revisionUsages: ProductUsageRevisionRow[]` vào `ProductUsageReport`.
  - Trong `generateReportsOverview` ([`report.service.ts`](../../apps/backend/src/services/report.service.ts)):
    - Nếu `selectedMaterialCode` là `null` (chưa chọn sản phẩm): `productUsageRows = []` và `revisionUsages = []`, các chỉ số `summary` bằng `0` (hoặc `null` cho trường giá khi `isTech`).
    - Nếu `selectedMaterialCode` có giá trị:
      - Tính `productUsageRows` (cấp Step phẳng) như hiện tại để giữ nguyên dữ liệu xuất Excel.
      - Gom nhóm theo `revisionId` để tạo `revisionUsages: ProductUsageRevisionRow[]`, trong đó mỗi phần tử đại diện cho **1 Revision duy nhất** có sử dụng sản phẩm đó, bao gồm:
        - Thông tin hành chính của Revision (`revisionId`, `projectId`, `projectCode`, `customerId`, `customerShortName`, `customerName`, `salesmanName`, `revisionNo`, `status`, `scheduleDate`, `productName`, `colorName`, `substrate`, `finishingSystem`).
        - Thông tin vật tư (`materialCode`, `materialName`, `packingDesc`, `nettWeight`).
        - Chỉ số tổng hợp của sản phẩm trong Revision:
          - `stepCount`: tổng số bước sử dụng sản phẩm trong Revision.
          - `totalItemCaPlusLossGramM2`: tổng `itemCaPlusLossGramM2` của sản phẩm cộng dồn qua các bước trong Revision (làm tròn 2 chữ số thập phân).
          - `priceSnapshotVnd`: đơn giá snapshot (`null` nếu `isTech`).
          - `totalItemCoatingCostVndM2`: tổng `itemCoatingCostVndM2` của sản phẩm cộng dồn qua các bước trong Revision (`null` nếu `isTech`).
          - `revisionTotalCostVndM2`: tổng chi phí sơn của cả Revision (`null` nếu `isTech`).
          - `costShareOfRevPercent`: tỷ trọng `%` chi phí của sản phẩm trên tổng chi phí của Revision (`Number(((totalItemCostRaw / revTotalCostRaw) * 100).toFixed(1))`, `null` nếu `isTech`).
          - `steps: ProductUsageStepBreakdownRow[]`: danh sách chi tiết từng bước trong Revision có sử dụng sản phẩm đó (`stepId`, `stepNumber`, `stepName`, `methodName`, `efficiencyPercent`, `mixingRatio`, `ratioSharePercent`, `stepCaAvgGramM2`, `stepCaPlusLossGramM2`, `itemCaPlusLossGramM2`, `priceSnapshotVnd`, `itemCoatingCostVndM2`, `stepCoatingCostVndM2`).
- **Non-functional**:
  - Đảm bảo tính chính xác số học IEEE-754 (cộng trên giá trị raw trước khi làm tròn hiển thị) và bảo mật cột giá tuyệt đối cho vai trò `TECHNICAL`.

## Related Code Files
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/backend/src/services/report.service.ts`

## Implementation Steps
1. **Cập nhật `packages/shared/src/types.ts`**:
   - Định nghĩa `ProductUsageStepBreakdownRow` và `ProductUsageRevisionRow`.
   - Thêm `revisionUsages: ProductUsageRevisionRow[]` vào `ProductUsageReport`.
2. **Cập nhật `apps/backend/src/services/report.service.ts`**:
   - Chỉ duyệt sinh `productUsageRows` và `revisionUsages` khi `selectedMaterialCode !== null`.
   - Gom nhóm các bước sử dụng `selectedMaterialCode` trong cùng một Revision vào `ProductUsageRevisionRow`, tính tổng raw rồi làm tròn `totalItemCaPlusLossGramM2`, `totalItemCoatingCostVndM2`, và `costShareOfRevPercent`.
   - Cập nhật `summary` của `ProductUsageReport` (bao gồm `avgCaPlusLossGramM2`, `avgItemCostVndM2`, `minItemCostVndM2`, `maxItemCostVndM2`).

## Todo List
- [x] Bổ sung `ProductUsageStepBreakdownRow` và `ProductUsageRevisionRow` vào `packages/shared/src/types.ts`
- [x] Cập nhật logic On-Demand và gom nhóm Revision trong `apps/backend/src/services/report.service.ts`
- [x] Kiểm tra `npm run typecheck` cho `@cscc/shared` và `@cscc/backend`

## Success Criteria
- Khi gọi `GET /api/reports/overview` không truyền `materialCode`, `productUsage.usages` và `productUsage.revisionUsages` đều rỗng (`[]`), trong khi `productUsage.productCatalog` vẫn trả về đầy đủ danh sách mã sơn.
- Khi gọi `GET /api/reports/overview?materialCode=<CODE>`, mỗi Revision sử dụng mã sơn đó chỉ xuất hiện 1 lần trong `productUsage.revisionUsages` và chứa đầy đủ mảng `steps` con dùng để Breakdown.

