---
title: "Phase 02: Frontend A4 Portrait Layout, Typography & Print CSS"
phase: 2
status: completed
effort: "1.0h"
tags: [frontend, print, css, ui, ux, typography]
---

# Phase 02: Frontend A4 Portrait Layout, Typography & Print CSS

## Context Links
- Plan Overview: [plan.md](./plan.md)
- Print Stylesheet: [apps/frontend/src/index.css](../../apps/frontend/src/index.css)
- Printable Sheet Component: [apps/frontend/src/components/print/PrintableSheetA4.tsx](../../apps/frontend/src/components/print/PrintableSheetA4.tsx)

## Overview
- **Priority**: P1
- **Current status**: Completed
- **Description**: Chuyển đổi quy tắc `@page` trong [`index.css`](../../apps/frontend/src/index.css) sang `A4 portrait` và tái thiết kế chi tiết giao diện [`PrintableSheetA4.tsx`](../../apps/frontend/src/components/print/PrintableSheetA4.tsx) (khung Preview tỷ lệ dọc, Header, Metadata Grid, `<colgroup>` 8 cột của CS, 4 ô Chữ ký, và `<colgroup>` 11 cột của CC) đảm bảo gọn gàng, rõ ràng, không bể layout.

## Key Insights
- Trên khổ giấy **A4 Portrait (`210mm × 297mm`, lề `6mm`)**, chiều rộng vùng in là **`198mm`**:
  - **Cột `Product Name`**: Trước đây dùng `font-mono` khiến các chữ cái in hoa rộng ngang, làm tên sản phẩm dễ bị gãy dòng. Chuyển sang `font-sans font-semibold` giúp tiết kiệm ~22% diện tích ngang và đồng bộ thẩm mỹ với toàn bộ biểu mẫu.
  - **Các cột số tiền và định mức (đặc biệt trong bảng CC 11 cột)**: Cần thêm class `whitespace-nowrap tabular-nums` để các con số như `543,000`, `379,333`, `119,219.05`, `894,143` luôn thẳng hàng chữ số và tuyệt đối không bị ngắt dòng giữa chừng.
  - **Tiêu đề cột song ngữ (`<thead>`)**: Cần cô đọng từ ngữ song ngữ Anh - Việt để ở các cột hẹp (`5%`–`8%`), tiêu đề chỉ hiển thị 2–3 dòng ngắn gọn, không bị tràn khung.

## Requirements
- **Functional & UI/UX**:
  1. **`apps/frontend/src/index.css`**:
     - Đổi `@page { size: A4 landscape; margin: 6mm; }` thành `@page { size: A4 portrait; margin: 6mm; }`.
  2. **Khung Xem trước (`PrintableSheetA4.tsx`)**:
     - Đổi container từ `max-w-6xl` (`1152px`) sang `max-w-[840px]` để khung Preview trên màn hình có đúng tỷ lệ trang A4 dọc (`print:max-w-none`).
     - Thêm nhãn badge hiển thị rõ `A4 Portrait / Khổ dọc` trên thanh công cụ Preview.
  3. **Header & Metadata Grid (`renderSheetHeader`, `renderMetadataGrid`)**:
     - Logo hai bên (`h-10 print:h-7`), tiêu đề chính `text-base sm:text-lg print:text-[13px] font-black uppercase tracking-wide leading-snug`.
     - Metadata Grid 3 cột (`grid-cols-3 gap-x-3 gap-y-1 text-[11px] print:text-[9.5px] print:leading-snug`) có `break-words` an toàn.
  4. **Bảng Coating Schedule — CS (8 cột, `renderCsTable`)**:
     - Tỷ lệ `<colgroup>` chuẩn hóa cho khổ dọc `198mm`:
       - Col 1 (`No. / STT`): `4.5%`
       - Col 2 (`Step / Bước thi công`): `14.5%`
       - Col 3 (`Product Name / Tên sản phẩm`): `34%`
       - Col 4 (`Ratio / Tỉ lệ pha`): `6.5%`
       - Col 5 (`Visco / Độ nhớt`): `8.5%`
       - Col 6 (`CA (g/m²) / Lượng sơn`): `7.5%`
       - Col 7 (`Method / PP thi công`): `11.5%`
       - Col 8 (`Drying Time / Thời gian khô`): `13%`
     - Cỡ chữ bảng CS: `text-[10.5px] print:text-[9px] leading-snug`.
     - Khung 4 ô Chữ ký (`renderCsSignatures`): `grid-cols-4` với tiêu đề gọn (`CUSTOMER / KHÁCH HÀNG`, `PD/PM / PHÒNG DỰ ÁN`, `TA / KỸ THUẬT`, `PROJECT LEADER / TRƯỞNG DỰ ÁN`), chiều cao vùng ký `h-14 print:h-10`.
  5. **Bảng Coating Cost — CC (11 cột, `renderCcTable`)**:
     - Tỷ lệ `<colgroup>` chuẩn hóa cho khổ dọc `198mm`:
       - Col 1 (`Item / Bước thi công`): `9%`
       - Col 2 (`Product Name / Tên sản phẩm`): `26%`
       - Col 3 (`Price / Đơn giá (VND/Ltr)`): `8%`
       - Col 4 (`Ratio / Tỉ lệ pha`): `5%`
       - Col 5 (`Mixed Price / Giá HH (VND/Ltr)`): `8.5%`
       - Col 6 (`Method / PP thi công`): `7%`
       - Col 7 (`CA (g/m²) / Lượng sơn`): `6%`
       - Col 8 (`Efficiency / Hiệu suất`): `5.5%`
       - Col 9 (`CA + Loss / Gồm hao hụt`): `7.5%`
       - Col 10 (`Coverage / Định mức phủ`): `7.5%`
       - Col 11 (`Coating Cost / Chi phí (VND/m²)`): `10%`
     - Cỡ chữ bảng CC: `text-[10px] print:text-[8.5px] leading-tight`, header `text-[9px] print:text-[7.5px] leading-tight`.
     - Toàn bộ các ô số tiền/định mức có `whitespace-nowrap tabular-nums` và padding ngang tối ưu (`px-1 print:px-0.5`).

## Related Code Files
- Modify: `apps/frontend/src/index.css`
- Modify: `apps/frontend/src/components/print/PrintableSheetA4.tsx`

## Implementation Steps
1. Cập nhật `@page` trong [`apps/frontend/src/index.css`](../../apps/frontend/src/index.css) thành `size: A4 portrait; margin: 6mm;`.
2. Cập nhật [`apps/frontend/src/components/print/PrintableSheetA4.tsx`](../../apps/frontend/src/components/print/PrintableSheetA4.tsx):
   - Chỉnh khung modal sang `max-w-[840px]`.
   - Tinh chỉnh `renderSheetHeader`, `renderMetadataGrid`, `renderCsTable`, `renderCsSignatures`, và `renderCcTable` theo thông số thiết kế ở trên.
3. Kiểm tra `npm run typecheck --workspace=@cscc/frontend`.

## Todo List
- [x] Đổi `@page` sang `A4 portrait` trong `apps/frontend/src/index.css`
- [x] Cập nhật khung Preview tỷ lệ A4 dọc (`max-w-[840px]`) trong `PrintableSheetA4.tsx`
- [x] Tối ưu `<colgroup>`, tiêu đề song ngữ và typography của bảng CS (8 cột) & 4 ô chữ ký
- [x] Tối ưu `<colgroup>`, tiêu đề song ngữ và `tabular-nums whitespace-nowrap` của bảng CC (11 cột)
- [x] Chạy `npm run typecheck --workspace=@cscc/frontend`

## Success Criteria
- Không có bất kỳ cột nào bị tràn chữ, đè chữ hoặc gãy dòng số tiền trên cả giao diện Preview `840px` lẫn khi in ra khổ giấy A4 Dọc (`198mm` chiều ngang vùng in).

