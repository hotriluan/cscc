---
title: "Phase 03: Automated Testing & End-to-End Verification"
phase: 3
status: completed
effort: "0.5h"
tags: [testing, verification, backend, frontend, rbac]
---

# Phase 03: Automated Testing & End-to-End Verification

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Report RBAC & Analytics Test Suite: [apps/backend/test/reports-analytics-rbac.test.ts](../../apps/backend/test/reports-analytics-rbac.test.ts)

## Overview
- **Priority**: P1
- **Current status**: Pending
- **Description**: Cập nhật và mở rộng bộ kiểm thử tự động trong [`apps/backend/test/reports-analytics-rbac.test.ts`](../../apps/backend/test/reports-analytics-rbac.test.ts) để kiểm chứng toàn diện cơ chế On-Demand Product Usage, tính đúng đắn của dữ liệu gộp cấp Revision (`revisionUsages`), danh sách Breakdown cấp Step (`steps`), bảo mật giá đối với vai trò `TECHNICAL`, và cấu trúc bảng phẳng khi xuất Excel (`reportTab=PRODUCT_USAGE`).

## Key Insights
- Bài test số 1 trong `reports-analytics-rbac.test.ts` (dòng 35) hiện đang kiểm tra `assert.ok(overview.productUsage.usages.length >= 10)` khi gọi `/api/reports/overview` không truyền `materialCode`. Với cơ chế On-Demand mới, khi không truyền `materialCode`, `usages` và `revisionUsages` phải bằng `0` (`[]`), trong khi `productCatalog.length > 0`; chỉ khi truyền `?materialCode=...` thì `usages` và `revisionUsages` mới trả về dữ liệu chi tiết.
- Bài test số 5 trong `reports-analytics-rbac.test.ts` kiểm tra xuất Excel cần truyền kèm `materialCode` khi kiểm tra sheet `1_Product_Usage` để xác nhận các dòng Step phẳng được xuất đầy đủ cho PivotTable.

## Requirements
- **Functional**:
  - Kiểm chứng `GET /api/reports/overview` khi không có `materialCode`:
    - `productCatalog.length > 0`
    - `selectedMaterialCode === null`
    - `usages.length === 0` và `revisionUsages.length === 0`
  - Kiểm chứng `GET /api/reports/overview?materialCode=<CODE>`:
    - `revisionUsages.length` bằng đúng `targetMat.usageRevisionCount`.
    - Tổng `stepCount` của các phần tử trong `revisionUsages` bằng đúng `targetMat.usageStepCount` và bằng `usages.length`.
    - Mỗi phần tử trong `revisionUsages` có `totalItemCaPlusLossGramM2` bằng tổng `itemCaPlusLossGramM2` của các `steps` con, và `totalItemCoatingCostVndM2` bằng tổng chi phí của các `steps` con.
  - Kiểm chứng phân quyền `TECHNICAL`:
    - Khi gọi với `x-user-role: TECHNICAL` và `materialCode=<CODE>`, toàn bộ trường giá/chi phí trên cả `revisionUsages` (`priceSnapshotVnd`, `totalItemCoatingCostVndM2`, `revisionTotalCostVndM2`, `costShareOfRevPercent`) lẫn từng phần tử `steps` con đều bằng `null`.
  - Kiểm chứng xuất Excel `GET /api/reports/export-excel?reportTab=PRODUCT_USAGE&materialCode=<CODE>`:
    - Giữ nguyên cấu trúc 20 cột (cho `PROJECT_LEADER`/`ADMIN`/`SALES`) và 16 cột (cho `TECHNICAL`) ở cấp độ từng dòng Step phẳng.

## Related Code Files
- Modify: `apps/backend/test/reports-analytics-rbac.test.ts`

## Implementation Steps
1. Cập nhật test case 1, 4, 5 trong `apps/backend/test/reports-analytics-rbac.test.ts` phản ánh hành vi On-Demand và kiểm tra sâu cấu trúc `revisionUsages` + `steps` breakdown.
2. Chạy `npm run typecheck`, `npm run build` và `npm test` trên toàn bộ monorepo để đảm bảo 100% bài test pass.

## Todo List
- [x] Cập nhật `apps/backend/test/reports-analytics-rbac.test.ts`
- [x] Chạy `npm run typecheck`
- [x] Chạy `npm run build`
- [x] Chạy `npm test`

## Success Criteria
- Toàn bộ test suites trong `packages/shared` và `apps/backend` chạy pass 100% không có lỗi.
- `npm run build` thành công cho cả `@cscc/shared`, `@cscc/backend`, và `@cscc/frontend`.

