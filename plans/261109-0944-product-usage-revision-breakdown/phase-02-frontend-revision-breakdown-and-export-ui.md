---
title: "Phase 02: Frontend On-Demand Selector, Revision Breakdown & Export Toolbar"
phase: 2
status: completed
effort: "1.0h"
tags: [frontend, react, reports, product-usage, ux]
---

# Phase 02: Frontend On-Demand Selector, Revision Breakdown & Export Toolbar

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Reports UI Component: [apps/frontend/src/components/reports/ReportsAnalyticsView.tsx](../../apps/frontend/src/components/reports/ReportsAnalyticsView.tsx)

## Overview
- **Priority**: P1
- **Current status**: Pending
- **Description**: Nâng cấp giao diện [`ReportsAnalyticsView.tsx`](../../apps/frontend/src/components/reports/ReportsAnalyticsView.tsx) tại **Tab 1 (`PRODUCT_USAGE`)** và thanh Header:
  1. Bỏ tùy chọn `'ALL'` khỏi Combobox chọn sản phẩm sơn; mặc định `selectedMaterialCode` là `''` (chưa chọn).
  2. Khi chưa chọn sản phẩm sơn, hiển thị màn hình chọn nhanh (**On-Demand Product Selector**) kèm các thẻ gợi ý **Top Chemical Products** (từ `productCatalog`) để người dùng click 1 chạm hoặc tìm kiếm trên Combobox mà không làm nặng trang.
  3. Khi đã chọn 1 sản phẩm sơn, hiển thị bảng chính theo cấp **Revision** (`revisionUsages` — 1 dòng/Revision) và hỗ trợ click vào từng dòng Revision (hoặc nút `Expand All / Collapse All`) để **Breakdown** xuống bảng con liệt kê các **Step** có sử dụng sản phẩm đó trong Revision.
  4. Xóa nút `Export All 7 Reports (.xlsx) / Xuất Trọn bộ 7 Báo cáo` khỏi thanh Header, chỉ giữ lại nút `Export Active Tab (.xlsx) / Xuất Tab hiện tại`.

## Key Insights
- Tab 2 (`CUSTOMER_PORTFOLIO`) trong [`ReportsAnalyticsView.tsx`](../../apps/frontend/src/components/reports/ReportsAnalyticsView.tsx#L1121-L1280) đã áp dụng mẫu thiết kế hàng chính + bảng con mở rộng (`ChevronDown` / `ChevronRight`). Áp dụng cùng ngôn ngữ thiết kế đó cho Tab 1 (`Revision Row` -> `Step Breakdown Sub-table`) tạo sự đồng nhất tuyệt đối về trải nghiệm người dùng.
- Việc hiển thị sẵn các badge bước sơn ngay trên dòng Revision (ví dụ: `#2, #5 (2 bước)`) giúp người dùng nhìn lướt qua đã biết sản phẩm dùng ở bước nào, và khi cần xem chi tiết định mức/tỷ lệ pha/phương pháp của từng bước thì bấm vào dòng Revision để mở bảng Breakdown.

## Requirements
- **Functional**:
  - **Thanh công cụ Header**:
    - Xóa nút `Export All 7 Reports (.xlsx) / Xuất Trọn bộ 7 Báo cáo`.
    - Giữ nguyên nút `Export Active Tab (.xlsx) / Xuất Tab hiện tại` (ở Tab 1, disable nút xuất Excel kèm tooltip nhắc chọn mã sơn nếu người dùng chưa chọn mã sơn nào).
  - **Bộ chọn Mã Vật Tư Sơn (Tab 1)**:
    - Khởi tạo `selectedMaterialCode = ''` (thay vì `'ALL'`).
    - Loại bỏ mục `'ALL'` khỏi `materialComboboxOptions`. Thêm nút `Clear / Đổi mã sơn` bên cạnh hoặc cho phép chọn lại mã khác bất kỳ lúc nào.
  - **Trạng thái chưa chọn Mã Sơn (On-Demand Empty State)**:
    - Hiển thị khung hướng dẫn trực quan song ngữ EN/VI giải thích chỉ tải dữ liệu khi chọn 1 mã sơn cụ thể.
    - Hiển thị danh sách **Quick-Pick Top Used Products (Chọn nhanh mã sơn phổ biến)** từ `overview.productUsage.productCatalog.slice(0, 12)` dưới dạng các nút thẻ (hiển thị `materialCode`, `materialName`, số `Rev` và số `KH` sử dụng) để bấm 1 chạm là xem báo cáo ngay.
  - **Trạng thái đã chọn 1 Mã Sơn (Revision Table + Step Breakdown)**:
    - Hiển thị thẻ thông tin sản phẩm đang chọn (`Mã VT`, `Tên SP`, `Quy cách đóng gói`, nút `Bỏ chọn / Chọn SP khác`) và hệ thống thẻ KPI tổng hợp.
    - Thanh tiêu đề bảng hiển thị số lượng **Revision** sử dụng sản phẩm (kèm tổng số bước), cùng nút **`Expand All Steps / Mở rộng tất cả bước`** và **`Collapse All / Thu gọn tất cả`**.
    - **Bảng chính (Cấp Revision)**:
      - Cột 1: Icon mở rộng (`ChevronRight` / `ChevronDown`).
      - Cột 2: `Customer & Salesman / Khách hàng & Phụ trách`.
      - Cột 3: `Project & Rev / Hồ sơ & Phiên bản` (`projectCode`, `Rev XX`, badge `status`, `scheduleDate`).
      - Cột 4: `Furniture & System / SP Gỗ & Hệ sơn` (`productName`, `colorName`, `finishingSystem`, `substrate`).
      - Cột 5: `Steps Used / Số bước sử dụng` (hiển thị số lượng bước + các badge `#Step stepName` rút gọn, kèm gợi ý click để breakdown).
      - Cột 6: `Total Product CA+Loss in Rev (g/m²)` (`totalItemCaPlusLossGramM2`).
      - Các cột chi phí (chỉ hiển thị khi `canViewCost === true`):
        - Cột 7: `Price Snapshot (VND/Kg)`.
        - Cột 8: `Product Cost in Rev (VND/m²)` + badge `% of Rev CC` (`costShareOfRevPercent%`).
        - Cột 9: `Total Rev CC (VND/m²)`.
      - Cột cuối: Nút `Open / Mở CS` (`onSelectRevision(rev.revisionId)`).
    - **Bảng con Breakdown (Cấp Step khi mở rộng dòng Revision)**:
      - Hiển thị danh sách `rev.steps` của sản phẩm đó trong Revision:
        - `Step # & Step Name / Công đoạn`
        - `Method & Efficiency / Phương pháp & Hiệu suất`
        - `Mix Ratio & Share (%) / Tỷ lệ pha & Tỷ trọng`
        - `Step Total CA+Loss (g/m²) / Định mức cả bước`
        - `Product CA+Loss in Step (g/m²) / Định mức SP ở bước này`
        - Khi `canViewCost === true`:
          - `Price Snapshot (VND/Kg)`
          - `Product Cost in Step (VND/m²)`
          - `Step Total Cost (VND/m²)`

## Related Code Files
- Modify: `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx`

## Implementation Steps
1. Đổi state mặc định `selectedMaterialCode` từ `'ALL'` sang `''`, thêm state `expandedProductRevIds: Record<string, boolean>` trong `ReportsAnalyticsView.tsx`.
2. Xóa nút `Export All 7 Reports (.xlsx)` trên thanh công cụ Header; cập nhật trạng thái `disabled` của nút `Export Active Tab (.xlsx)` khi đang ở `PRODUCT_USAGE` mà chưa chọn `selectedMaterialCode`.
3. Cập nhật `materialComboboxOptions` bỏ phần tử `'ALL'`.
4. Xây dựng giao diện On-Demand Empty State kèm Quick-Pick Product Chips khi `!selectedMaterialCode`.
5. Xây dựng bảng `Revision-level Where-Used Table` kèm tính năng click dòng / bấm nút `Breakdown` để mở bảng con `Step Breakdown` và nút `Expand All / Collapse All`.

## Todo List
- [x] Xóa nút `Export All 7 Reports (.xlsx)` trên thanh Header
- [x] Chuyển `selectedMaterialCode` sang chế độ On-Demand (`''` mặc định) và bỏ option `'ALL'`
- [x] Thiết kế khung Quick-Pick Products khi chưa chọn mã sơn
- [x] Xây dựng bảng chính cấp Revision và bảng con Breakdown cấp Step
- [x] Kiểm tra `npm run typecheck` và `npm run build` cho `@cscc/frontend`

## Success Criteria
- Mở Tab 1 hiển thị ngay giao diện chọn sản phẩm gọn nhẹ, không còn bảng hàng trăm dòng hỗn tạp.
- Chọn 1 sản phẩm sơn hiển thị đúng danh sách các Revision có dùng sản phẩm đó (1 dòng/Revision); bấm vào dòng Revision sổ xuống chi tiết các Step sử dụng sản phẩm trong Revision đó.
- Thanh Header chỉ còn 1 nút xuất Excel cho Tab hiện tại.

