---
phase: 4
title: "Phase 4: Project Versioning (Revisions/Snapshot/Lock) & Excel/PDF Export"
status: todo
priority: P1
effort: "4h"
dependencies: [2, 3]
---

# Phase 4: Project Versioning (Revisions/Snapshot/Lock) & Excel/PDF Export

## Context Links

- Đặc tả Versioning & Export: `c:\dev\cscc\docs\coating_system_specification.md` (Mục 6, 7)
- File Excel mẫu & Template: `c:\dev\cscc\docs\Form CS Industry.xlsx`

## Overview

Hiện thực hóa cơ chế quản lý phiên bản theo cấu trúc **Parent Project – Child Revisions (`Rev 00`, `Rev 01`...)** kèm tính năng đóng băng dữ liệu (**Snapshot**), khóa phiên bản đã chốt (**Lock**), và bộ xuất file **Excel (`.xlsx` nhúng công thức sống + merge ô)** cùng **PDF chuẩn A4** để gửi khách hàng.

## Key Insights

- **Snapshot bất biến:** Khi một Revision ở trạng thái `LOCKED`, mọi thay đổi giá trong bảng `Quotation` hoặc `App-method` sau đó không làm thay đổi số tiền của Revision đã khóa. Nếu người dùng ở bản `DRAFT` muốn cập nhật theo bảng giá Master mới nhất, có nút `"Refresh Prices from Master"`.
- **Excel Export kèm công thức thực:** Dùng thư viện `exceljs` đọc cấu trúc mẫu từ `docs/Form CS Industry.xlsx` (hoặc tạo sheet CS, CC, BOM chuẩn định dạng ALKANA), tự động gộp ô (`mergeCells`) cho từng bước và ghi trực tiếp công thức Excel (`=SUM(...)`, `=H9/I9`, `=1000/J9`, `=F9/K9`) vào các ô tính toán của sheet CC.
- **PDF Export chuẩn A4:** Thiết kế bản in `@media print` / xuất PDF khổ A4 cho cả phiếu **Coating Schedule** (kèm logo ALKANA, điều kiện khuyến nghị, cảnh báo chất lượng và 4 ô chữ ký `CUSTOMER`, `PD/PM`, `TA`, `PROJECT LEADER`) và phiếu **Coating Cost Calculation**.

## Requirements

- [ ] Xây dựng luồng tạo phiên bản mới (`POST /api/projects/:id/revisions` — clone toàn bộ dữ liệu từ Revision hiện tại sang `Rev 01`, `Rev 02`... ở trạng thái `DRAFT`).
- [ ] Xây dựng cơ chế `Lock Revision` (`PATCH /api/revisions/:id/lock`): Chuyển trạng thái sang `LOCKED`, chặn mọi thao tác chỉnh sửa (`PUT`/`DELETE`) ở cả Backend và Frontend.
- [ ] Xây dựng `excel-exporter.service.ts` xuất file `.xlsx` gồm các sheet: `CS`, `CC` (chỉ xuất khi user có quyền Sales/Project Leader), và `BOM Summary`, giữ nguyên định dạng gộp ô và công thức Excel sống.
- [ ] Xây dựng tính năng xuất **PDF chuẩn A4** cho Coating Schedule và Coating Cost.

## Related Code Files

- Create: `c:\dev\cscc\apps\backend\src\services\revision.service.ts`
- Create: `c:\dev\cscc\apps\backend\src\services\excel-exporter.service.ts`
- Create: `c:\dev\cscc\apps\frontend\src\components\versioning\RevisionToolbar.tsx`
- Create: `c:\dev\cscc\apps\frontend\src\components\print\PrintableSheetA4.tsx`

## Implementation Steps

1. Viết `revision.service.ts` xử lý:
   - Clone Revision (`Rev 00` $\rightarrow$ `Rev 01`).
   - Lock Revision (đóng băng trạng thái chỉ xem).
   - Refresh Master Prices (chỉ cho phép khi Revision đang là `DRAFT`).
2. Viết `excel-exporter.service.ts` bằng `exceljs`:
   - Tạo/bơm dữ liệu vào sheet `CS` và `CC` với đúng màu sắc, đường viền, độ rộng cột, logo ALKANA và gộp ô động theo số lượng dòng thành phần của mỗi bước.
   - Nhúng công thức Excel sống vào các cột `Mixed Price`, `CA + Loss`, `Coverage`, `Coating Cost`, `TOTAL COATING COST`.
3. Tích hợp thanh công cụ `RevisionToolbar.tsx` trên Frontend (chọn `Rev 00`/`Rev 01`, nút `Create New Revision`, nút `Lock Revision`, nút `Export Excel`, nút `Export PDF A4`).

## Todo

- [ ] Hiện thực hóa API & UI `Create New Revision` (`Rev 00` -> `Rev 01`...)
- [ ] Hiện thực hóa API & UI `Lock Revision` (chế độ chỉ xem cho bản đã chốt)
- [ ] Xây dựng `excel-exporter.service.ts` xuất `.xlsx` có gộp ô động và công thức Excel sống
- [ ] Xây dựng tính năng xuất PDF chuẩn A4 có logo ALKANA và 4 khung chữ ký

## Success Criteria

- Tạo `Rev 01` từ `Rev 00` giữ nguyên toàn bộ bước sơn và đơn giá snapshot.
- Khi khóa `Rev 00`, mọi ô nhập liệu chuyển sang `disabled` và API từ chối request cập nhật.
- File `.xlsx` tải về mở bằng Microsoft Excel hiển thị đúng bố cục gộp ô, bấm vào ô `Coating Cost` thấy công thức Excel và tổng giá trị là `894,143`.

## Risk Assessment

- **Quyền xuất file Excel:** Nếu `Technical` bấm xuất Excel, file `.xlsx` xuất ra chỉ được chứa sheet `CS` (tuyệt đối không xuất sheet `CC` có chứa đơn giá).

## Security Considerations

- Kiểm tra role trên endpoint `/api/revisions/:id/export-excel`: chỉ đính kèm sheet `CC` khi user có quyền `SALES`, `PROJECT_LEADER`, hoặc `ADMIN`.

## Next Steps

- Chuyển sang Phase 5 để chạy kiểm thử tích hợp toàn trình (E2E) với bộ dữ liệu chuẩn `NITORI-HO CHI MINH (NTR 001)`.