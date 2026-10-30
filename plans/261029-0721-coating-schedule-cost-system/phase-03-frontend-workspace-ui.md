---
phase: 3
title: "Phase 3: Frontend Workspace UI (CS Editor, CC Merged View & BOM Summary)"
status: todo
priority: P1
effort: "7h"
dependencies: [2]
---

# Phase 3: Frontend Workspace UI (CS Editor, CC Merged View & BOM Summary)

## Context Links

- Ảnh giao diện gốc: `c:\dev\cscc\pic\cs.png`, `c:\dev\cscc\pic\cs1.png`, `c:\dev\cscc\pic\cc.png`, `c:\dev\cscc\pic\cc1.png`
- Đặc tả UI/UX: `c:\dev\cscc\docs\coating_system_specification.md` (Mục 3, 4, 5)

## Overview

Xây dựng ứng dụng Frontend React + TypeScript với giao diện bảng tính chuyên nghiệp, bám sát bố cục biểu mẫu công nghiệp của **ALKANA Performance Coatings**, bao gồm:
1. **Tab 1 — Coating Schedule (CS) Editor:** Giao diện nhập liệu duy nhất cho Kỹ thuật viên (Header thông tin dự án, Điều kiện tiêu chuẩn, thêm bước `SANDING` hoặc bước sơn nhiều hóa chất thành phần, nhập `CA (g/m²)` dạng `100-120`, chọn phương pháp thi công).
2. **Tab 2 — Coating Cost (CC) Dashboard (Read-only, chỉ hiện với Sales/Project Leader):** Hiển thị bảng tính giá tự động nhảy số real-time, **gộp ô (`rowSpan`) theo từng Bước (Step)** cho các cột `Item`, `Mixed Price`, `Application`, `Coating Amount`, `Application Efficiency`, `CA + Loss`, `Coverage`, `Coating Cost (VND/m²)` giống hệt ảnh `cc.png`.
3. **Tab 3 — BOM Summary (Tổng hợp vật tư):** Cho phép nhập **Tổng diện tích dự án ($\text{m}^2$)**, tự động gom nhóm theo mã vật tư, hiển thị tổng định mức $\text{g/m}^2$, tổng số Kg/Lít cần dùng và số thùng cần đặt theo quy cách đóng gói (`Packing Mapping`).
4. **Màn hình Quản lý Master Data:** Xem, tìm kiếm, chỉnh sửa 5 danh mục nguồn và nút Import từ file `Form CS Industry.xlsx`.

## Key Insights

- Bảng CS và CC có đặc trưng **Gộp ô dọc (`rowSpan`)** cho cấp Bước (Step), trong khi các cột `Product Code`, `Price (VND/Ltr)`, `Mixing Ratio` tách theo từng dòng thành phần (5 dòng/bước trong ảnh mẫu). Sử dụng cấu trúc HTML Table tùy biến với `rowSpan` theo `step.items.length` sẽ tái hiện chuẩn xác 100% giao diện Excel trong `cs.png` và `cc.png`.
- Nhờ dùng chung gói `@cscc/shared`, khi người dùng gõ sửa `Mixing Ratio`, đổi `CA` (`100-120`) hoặc đổi `Application Method` (`WIPING` $\leftrightarrow$ `SPRAY`) ở Tab CS, số liệu bên Tab CC và BOM Summary được tính toán tức thì (0ms latency) ngay trên trình duyệt.

## Requirements

- [ ] **Bố cục tổng thể (Sidebar + Main Workspace):**
  - **Sidebar (Menu điều hướng):** Chuyển đổi giữa **Workspace Dự án (CS / CC / BOM)** và **Quản trị Master Data (CRUD)**, kèm bộ chọn Role (`Technical` vs `Project Leader / Sales`) và danh sách Projects / Revisions.
  - **Main Workspace (Không gian làm việc):** Hiển thị màn hình làm việc chính tương ứng.
- [ ] **5.1. Module Quản trị Master Data (CRUD + Import Excel):**
  - `Customer`: Quản lý Mã ID (`Customer`), `Short Name` và Tên đầy đủ (`Name`).
  - `Quotation`: Quản lý `Material` (Mã vật tư), `Description`, `Packing`, `Nett`, `Price`.
  - `Application Step`: Cấu hình danh sách các bước chuẩn (`SANDING`, `WIPING FILLER`, `SANDING SEALER`, `GLAZE`, `TOP COAT COLOR`...).
  - `App-method`: Cấu hình Phương pháp (`WIPING`, `SPRAY`...) và `Application Efficiency (%)` (`35%`, `60%`...).
  - `Packing Mapping`: Cấu hình quy đổi mã `Packing` sang trọng lượng/thể tích `Nett`.
- [ ] **5.2. Giao diện Lập lịch (Coating Schedule — Dynamic Form):**
  - **Header:** Dropdown chọn `Customer`, điền `Product Item`, `Color`, `Substrate Type`, `Positioning`, `Finishing System`, `Gloss Level`, `Reference`, `No.`, `Date / Rev. / Page` và các điều kiện môi trường (`MC wood`, `Room humidity`, `Room temp.`).
  - **Dynamic Table (Quy trình):**
    - Nút **`"Thêm bước thi công"`** (cho phép chọn bước từ `Application Step Master`).
    - Tính năng **chèn hàng phụ xen kẽ giữa các bước** (VD: dòng `"SANDING"` với `"SANDING PAPER #180-240"` hoặc `"SANDING PAPER #320"`).
    - Bên trong mỗi bước thi công, cho phép **chèn nhiều `"Product Code"`** (autocomplete từ danh mục `Quotation`).
    - Nhập thủ công các chỉ số: `Mixing Ratio` (theo từng dòng vật tư), và các chỉ số gộp theo bước: `Visco`, `CA (g/m²)` (nhập dạng khoảng như `100-120`), `Application Method` (dropdown từ `App-method`), `Drying Time Recommended`.
- [ ] **5.3. Màn hình Báo giá (Coating Cost — Read-only):**
  - Tự động ẩn hoàn toàn đối với role `Technical`; chỉ hiển thị cho `Project Leader / Sales`.
  - Tự động đồng bộ Header từ Coating Schedule (`Date`, `Customer Name`, `Product Item`, `Color`, `Substrate Type`, `Finishing System`, `Sheen`).
  - Bảng dữ liệu Read-only tự động load `Price (VND/Ltr)`, `Application Efficiency (%)`, và chạy công thức `Mixed Price`, `Coating Amount` (lấy trung bình từ khoảng `CA`, VD `100-120` $\rightarrow$ `110`), `CA + Loss`, `Coverage`, `Coating Cost (VND/m²)` theo thời gian thực, giữ bố cục gộp ô (`rowSpan`) theo từng bước giống hệt ảnh `pic/cc.png`.
  - Hiển thị dòng **`TOTAL COATING COST (VND/m²)`** ở cuối bảng.
- [ ] **5.4. Màn hình Tổng hợp Vật tư (BOM Summary):**
  - Ô nhập `Project Area (m²)` $\rightarrow$ tự động gom nhóm (`Group By`) các mã vật tư trùng nhau qua nhiều bước, tính tổng `CA + Loss (g/m²)`, quy đổi ra tổng số `Kg/Ltr` và số thùng (`Packing`) cần đặt hàng.

## Related Code Files

- Create: `c:\dev\cscc\apps\frontend\src\App.tsx`
- Create: `c:\dev\cscc\apps\frontend\src\components\schedule\CoatingScheduleEditor.tsx`
- Create: `c:\dev\cscc\apps\frontend\src\components\cost\CoatingCostTable.tsx`
- Create: `c:\dev\cscc\apps\frontend\src\components\bom\BomSummaryView.tsx`
- Create: `c:\dev\cscc\apps\frontend\src\components\master\MasterDataManager.tsx`

## Implementation Steps

1. Khởi tạo ứng dụng React + Vite + TailwindCSS trong `apps/frontend`, kết nối với `@cscc/shared`.
2. Xây dựng Layout chính gồm Sidebar/Topbar (chuyển đổi Project/Revision, hiển thị Role hiện tại, thanh Tabs: `Coating Schedule (CS)` | `Coating Cost (CC)` | `BOM Summary` | `Master Data`).
3. Phát triển `CoatingScheduleEditor.tsx` với giao diện chuẩn biểu mẫu ALKANA, hỗ trợ thao tác bàn phím nhanh như bảng tính.
4. Phát triển `CoatingCostTable.tsx` ở chế độ Read-only với `rowSpan` gộp ô theo từng bước sơn.
5. Phát triển `BomSummaryView.tsx` với bộ tính khối lượng đặt hàng theo diện tích dự án.
6. Phát triển `MasterDataManager.tsx` quản lý 5 bảng danh mục nguồn.

## Todo

- [ ] Thiết lập giao diện khung ứng dụng React + TailwindCSS + State Management
- [ ] Xây dựng `CoatingScheduleEditor.tsx` (hỗ trợ bước `SANDING`, bước sơn nhiều thành phần, nhập `CA` dạng `100-120`)
- [ ] Xây dựng `CoatingCostTable.tsx` (Read-only, gộp ô theo Step giống `pic/cc.png`)
- [ ] Xây dựng `BomSummaryView.tsx` (Gom nhóm vật tư + tính số Kg/Lít và số thùng theo diện tích $\text{m}^2$)
- [ ] Xây dựng `MasterDataManager.tsx` (5 tabs Master Data + Import Excel)

## Success Criteria

- Giao diện CS và CC tái hiện đầy đủ các cột, tiêu đề, khung chữ ký và bố cục gộp ô như trong `pic/cs.png` và `pic/cc.png`.
- Khi chỉnh sửa bất kỳ thông số nào bên Tab CS, Tab CC và Tab BOM cập nhật ngay lập tức với kết quả tính toán chính xác.

## Risk Assessment

- **Trải nghiệm nhập liệu nhiều dòng:** Cần hỗ trợ nút "Duplicate Step" (nhân bản nhanh bước sơn vì các bước TOP COAT COLOR thường dùng bộ hóa chất gần giống nhau như trong `cs.png`) giúp kỹ thuật viên lập bảng CS 10 bước chỉ trong vài giây.

## Security Considerations

- Ẩn hoàn toàn Tab CC và các cột giá trong BOM Summary khi đăng nhập dưới quyền `Technical`.

## Next Steps

- Chuyển sang Phase 4 để hoàn thiện Versioning (`Rev 00`, `Rev 01`, Lock) và tính năng Xuất file Excel (nhúng công thức) & PDF chuẩn A4.