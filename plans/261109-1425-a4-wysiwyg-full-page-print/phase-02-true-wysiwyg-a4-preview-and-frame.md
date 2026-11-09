---
title: "Phase 02: True-WYSIWYG A4 Preview & Full-Height Sheet Frame"
phase: 2
status: completed
effort: "1.0h"
tags: [frontend, print, wysiwyg, css, a4]
---

# Phase 02: True-WYSIWYG A4 Preview & Full-Height Sheet Frame

## Context Links
- Plan: [plan.md](./plan.md)
- Component: [PrintableSheetA4.tsx](../../apps/frontend/src/components/print/PrintableSheetA4.tsx)
- Print Stylesheet: [index.css](../../apps/frontend/src/index.css)

## Overview
- **Priority**: P1 · **Status**: Completed · **Depends on**: Phase 1
- Biến màn hình Preview trong `PrintableSheetA4.tsx` thành bản mô phỏng tờ giấy A4 **True-WYSIWYG 100%** (tỷ lệ thực `210mm × 297mm`, lề `6mm`, khung viền trong `198mm × 285mm`) và hợp nhất toàn bộ các thuộc tính hình học (spacing, padding, logo size, border, flex-col) giữa Screen và Print.

## Key Insights (Tại sao màn hình Preview cũ chưa giống 100% tờ giấy A4?)
Qua đối chiếu 2 ảnh chụp màn hình Preview của người dùng và code hiện tại trong `PrintableSheetA4.tsx`:
1. **Chiều rộng khung trang bị lệch (`max-w-[900px]` vs `198mm`):**
   - Khi in ra giấy A4 (`210mm` trừ lề `6mm × 2`), vùng in thực tế rộng đúng **`198mm` (`≈ 748.3px` ở 96 DPI)**.
   - Nhưng trên màn hình Preview hiện tại, modal đang dùng `max-w-[900px] p-5` và `.a4-print-page` dùng `p-4` (`16px`), làm bảng trong Preview rộng tới **`~826px` (`~218.5mm`)** — rộng hơn tờ giấy A4 thật tới **20.5mm**! Hậu quả là chữ trên Preview ít bị xuống dòng hơn, nhìn rộng rãi hơn, nhưng khi in ra giấy thật lại bị bó hẹp vào `198mm`.
2. **Chiều cao tờ giấy trên Preview chưa có khung A4 (`auto` vs `285mm`):**
   - Trên Preview, `.a4-print-page` hiện chỉ cao vừa đủ nội dung bên trong (không có chiều cao tờ giấy A4 `285mm`), nên người dùng không nhìn thấy được khoảng trống còn dư ở cuối Trang 1 hay độ dài thực sự của Trang 2 trên tờ giấy A4.
3. **Các class `print:*` tạo ra sự khác biệt giữa Screen và Print:**
   - Logo: trên màn hình là `h-10` (`40px`), khi in mới thu xuống `print:h-7` (`28px`).
   - Padding khung `.a4-print-page`: trên màn hình là `p-4` (`16px ≈ 4.2mm`), khi in là `print:p-[2mm]`.
   - Margin/padding của Header, Metadata, Remark, Chữ ký đang có hai bộ giá trị (`pb-2.5 print:pb-1`, `my-2.5 print:my-1.5`, `h-14 print:h-10`, `p-1.5 print:p-1`).

## Architecture & Design (True-WYSIWYG 1:1)

### 1. Mô phỏng Tờ Giấy A4 Vật lý trên Màn hình Preview
- Mỗi trang trên màn hình Preview được bọc trong một vỏ tờ giấy `.a4-sheet-preview`:
  - Trên **Screen**: hiển thị đúng kích thước tờ giấy A4 vật lý **`width: 210mm; min-height: 297mm; padding: 6mm;`** nền trắng (`bg-white`), đổ bóng nổi (`shadow-[0_10px_30px_rgba(0,0,0,0.45)]`), căn giữa (`mx-auto`) trên nền tối của modal.
  - Khi **Print (`@media print`)**: trình duyệt đã tự cấp tờ giấy `210mm × 297mm` và `@page { margin: 6mm }`, nên `.a4-sheet-preview` tự động bỏ padding/shadow ngoài (`print:w-full print:min-h-0 print:p-0 print:shadow-none`), nhường chỗ trực tiếp cho `.a4-print-page`.
- Bên trong `.a4-sheet-preview` là khung biểu mẫu `.a4-print-page`:
  - Có kích thước cố định **`width: 198mm; min-height: 285mm; padding: 2mm; box-sizing: border-box;`** (khi in là `width: 100%` tương đương chính xác `198mm`, `min-height: 285mm`, `padding: 2mm`).
  - Dùng `display: flex; flex-direction: column;` để khung viền đen `border border-slate-900` luôn chạy dọc hết chiều cao `285mm` của trang A4 (Phương án 2).

### 2. Hợp nhất 100% Spacing & Typography giữa Screen và Print
Xóa bỏ toàn bộ độ lệch giữa screen và `print:*` bên trong `.a4-print-page` — trên màn hình Preview dùng **chính xác** kích thước của bản in:
- **Logo Propan & Alkana**: dùng cố định `h-7 w-auto object-contain` (bỏ `h-10 print:h-7`).
- **Header**: dùng cố định `pb-1` (bỏ `pb-2.5 print:pb-1`).
- **Metadata Grid**: dùng cố định `my-1.5 gap-x-2 gap-y-0.5 pb-1.5` (bỏ `my-2.5 gap-x-3 gap-y-1 pb-2.5`).
- **Khoảng cách trên bảng ở trang 2+**: dùng cố định `mt-1.5` (bỏ `mt-2 print:mt-1.5`).
- **Màu nền Header bảng**: dùng thống nhất `bg-slate-100` cho cả screen và print.
- **Remark / Notes / Chữ ký**:
  - Remark CS: `mt-1.5 pt-1 space-y-0` cố định.
  - Khung 4 ô Chữ ký CS (`renderCsSignatures`): dùng `mt-1.5`, ô ký `p-1`, chiều cao khoảng ký `h-10` cố định (bỏ `h-14 print:h-10`).
  - Notes CC (`renderCcNotes`): dùng `mt-1.5 pt-1 space-y-0` cố định.

### 3. Bố cục Thanh Công cụ (Top Action Bar) trên Màn hình Preview
- Tách thanh công cụ `.no-print` thành một thanh sticky/fixed gọn gàng phía trên vùng cuộn giấy A4 (rộng `210mm` căn giữa đồng bộ với tờ giấy bên dưới), giúp người dùng chuyển đổi nhanh giữa `Coating Schedule (CS)` và `Coating Cost (CC)` trong khi quan sát các tờ giấy A4 thật bên dưới.

## Related Code Files
- Modify: `c:\dev\cscc\apps\frontend\src\components\print\PrintableSheetA4.tsx`
- Modify: `c:\dev\cscc\apps\frontend\src\index.css`

## Implementation Steps
1. Cập nhật `apps/frontend/src/index.css`:
   - Định nghĩa rõ `.a4-sheet-preview` (mô phỏng tờ giấy `210mm × 297mm`, `padding: 6mm` trên screen; reset về `0` khi `@media print`) và `.a4-print-page` (`width: 198mm`, `min-height: 285mm`, `padding: 2mm`, `display: flex`, `flex-direction: column`, `box-sizing: border-box`; khi `@media print` giữ `width: 100%; min-height: 285mm; padding: 2mm; break-inside: avoid;`).
2. Cập nhật `apps/frontend/src/components/print/PrintableSheetA4.tsx`:
   - Đồng bộ toàn bộ class trong `renderSheetHeader`, `renderMetadataGrid`, `renderCsTable`, `renderCsRemark`, `renderCsSignatures`, `renderCcTable`, `renderCcNotes` để Screen và Print dùng chung 100% thông số.
   - Bọc mỗi trang trong `.a4-sheet-preview` → `.a4-print-page` để hiển thị nguyên vẹn tờ giấy A4 trắng có lề `6mm` và khung biểu mẫu `198mm × 285mm` ngay trên màn hình Preview.
3. Kiểm tra `npm run typecheck --workspace=@cscc/frontend` và `npm run build --workspace=@cscc/frontend`.

## Todo List
- [x] Thêm CSS `.a4-sheet-preview` và `.a4-print-page` chuẩn kích thước vật lý A4 (`210×297mm` / `198×285mm`) vào `index.css`
- [x] Loại bỏ toàn bộ sự lệch kích thước `screen` vs `print:*` trong `PrintableSheetA4.tsx`
- [x] Đóng khung `.a4-print-page` dạng `flex-col` cao đủ `285mm` cho cả CS và CC
- [x] Chạy pass `typecheck` và `build` cho `@cscc/frontend`

## Success Criteria
- Trên màn hình Preview, chiều rộng của `.a4-print-page` đo được đúng `198mm` (`~748.3px` ở zoom 100%) và chiều cao đúng `285mm` (`~1077.2px`), khớp 100% đến từng pixel với chế độ `@media print`.
- Mọi điểm xuống dòng trong các ô bảng trên màn hình Preview giống hệt với file PDF xuất ra.

## Risk Assessment
- **Rủi ro**: Nếu `.a4-print-page` có `min-height: 285mm` và trình duyệt khi in có sai số làm tròn sub-pixel (~0.5mm), trang có thể bị đẩy sang trang phụ trống.
- **Giảm thiểu**: Đặt `min-height: 284mm` ở `@media print` (và trên screen) để chừa `1mm` dung sai sub-pixel của Chromium mà mắt thường không phân biệt được, đảm bảo không bao giờ sinh trang thừa.

