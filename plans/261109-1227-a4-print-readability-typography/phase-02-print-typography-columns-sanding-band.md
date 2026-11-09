---
title: "Phase 02: Print Typography, Columns & Sanding Band"
phase: 2
status: completed
effort: "1.25h"
tags: [frontend, print, typography, ux]
---

# Phase 02: Print Typography, Columns & Sanding Band

## Context Links
- Plan: [plan.md](./plan.md)
- Component: [PrintableSheetA4.tsx](../../apps/frontend/src/components/print/PrintableSheetA4.tsx)
- Print CSS: [index.css](../../apps/frontend/src/index.css)

## Overview
- **Priority**: P1 · **Status**: Completed
- Áp dụng thang chữ in mới (đơn vị `pt`), siết leading/padding, chia lại bề ngang cột, đổi dòng Chà nhám thành dải ngang và sửa các lỗi hiển thị nhỏ. Preview trên màn hình dùng cùng thang chữ để giữ WYSIWYG.

## Requirements

### 1. Thang chữ (đơn vị pt, dùng chung screen + print)
| Thành phần | Hiện tại | Mới |
|---|---|---|
| Tiêu đề `h1` | 13px ≈ 9.75pt | `12pt` |
| Dòng mã/Rev/Date/Status/Page | 9.5px ≈ 7.1pt | `8pt` |
| Metadata grid | 9.5px ≈ 7.1pt | `8.5pt` |
| Header bảng CS | 8px ≈ 6pt | `7.5pt` |
| Dữ liệu CS | 9px ≈ 6.75pt | **`9pt`** |
| Dải Chà nhám | 9px | `8.5pt`, semibold, italic |
| Header bảng CC | 7.5px ≈ 5.6pt | `7pt` |
| Dữ liệu CC | 8.5px ≈ 6.4pt | `8pt` |
| Dòng Total CC | 9px | `9pt` bold |
| Remark / Notes / Chữ ký | 9px ≈ 6.75pt | `8pt` (tên người ký `8.5pt`) |

- Dùng giá trị arbitrary Tailwind dạng `text-[9pt]`. Gom các cặp class trùng (`text-[10.5px] print:text-[9px]`) về một giá trị duy nhất để preview khớp bản in.
- Cell dữ liệu: `leading-[1.2]`, padding dọc `py-[1pt]`, ngang `px-[2pt]` (cột Product `px-[3pt]`).
- Header bảng: bỏ `uppercase` (chữ thường kết hợp hoa đọc nhanh hơn và hẹp hơn ~15%), giữ `font-bold`, `leading-[1.15]`.

### 2. Tỷ lệ cột (`<colgroup>`)
- **CS (8 cột)**: STT `4%` · Bước thi công `15%` · Product `26%` · Tỉ lệ pha `7%` · Độ nhớt `7%` · CA `8%` · PP thi công `13%` · Thời gian khô `20%`.
- **CC (11 cột)**: Item `12%` · Product `21%` · Đơn giá `8.5%` · Tỉ lệ `5%` · Giá HH `9%` · PP `7.5%` · CA `6%` · Hiệu suất `7%` · CA+Loss `7%` · Định mức `7%` · Chi phí `10%` (tổng 100%).
- Header CC tối đa 3 dòng theo mẫu `EN` / `VI` / `(đơn vị)`; header CS tối đa 2 dòng.

### 3. Dải Chà nhám (CS)
- Thay 8 ô hiện tại bằng: ô STT trống + **một ô `colSpan={7}`** nội dung `SANDING / CHÀ NHÁM — {sandingSpec}` (bỏ `— …` khi spec rỗng), căn trái, nền `bg-slate-100`, giữ `print-color-adjust: exact` đã có.
- Ranh giới bước rõ ràng: viền trên của dải giữ `border-slate-900`.

### 4. Chống ngắt khoảng số và tràn chữ
- Thêm helper nội bộ trong component (ví dụ `keepRangesTogether(text)`) tách chuỗi và bọc các khoảng số như `40-45°C`, `100-120`, `#180-240`, `8-12%` trong `<span className="whitespace-nowrap">`. Text gốc giữ nguyên (copy từ PDF vẫn đúng). Áp dụng cho Thời gian khô, Độ nhớt, sandingSpec, metadata MC/Humidity/Temp.
- Giữ `whitespace-nowrap tabular-nums` cho mọi ô số/tiền.
- Header `Efficiency` không được vượt viền ô; nếu vẫn chật ở 7pt, dùng nhãn `Efficiency` mixed-case với `px-[1pt]`, không viết tắt trừ khi bắt buộc.

### 5. Khung trang
- Khung `.a4-print-page`: `border-2` → `border` (1px) khi in, padding in `print:p-[2mm]` để rộng thêm ~2mm.
- Logo giữ `print:h-7`.

### Bất biến
- Không đổi dữ liệu, thứ tự cột, song ngữ, RBAC, logic `rowSpan`.
- Không đổi `@page` A4 portrait.

## Related Code Files
- Modify: `apps/frontend/src/components/print/PrintableSheetA4.tsx`
- Possibly modify: `apps/frontend/src/index.css` (chỉ khi cần class in dùng chung, ví dụ cho khung trang)

## Implementation Steps
1. Cập nhật `renderSheetHeader` và `renderMetadataGrid` theo thang chữ mới.
2. `renderCsTable`: colgroup mới, class cell (9pt, leading 1.2, padding 1pt), header mixed-case, dải Chà nhám `colSpan={7}`.
3. `renderCcTable`: colgroup mới, 8pt/7pt, header 3 dòng, dòng Total 9pt.
4. `renderCsRemark`, `renderCsSignatures`, `renderCcNotes`: 8pt; giữ `break-inside-avoid`.
5. Thêm helper chống ngắt khoảng số và áp dụng cho các ô đã nêu.
6. Khung trang 1px + padding in 2mm.
7. `npm run typecheck --workspace=@cscc/frontend`, `npm run build --workspace=@cscc/frontend`.

## Todo List
- [x] Header + metadata theo thang chữ mới
- [x] Bảng CS: colgroup, 9pt, leading/padding, header mixed-case
- [x] Dải Chà nhám colSpan 7
- [x] Bảng CC: colgroup, 8pt/7pt, header ≤ 3 dòng, Total 9pt
- [x] Remark / Chữ ký / Notes 8pt
- [x] Helper giữ khoảng số trên một dòng
- [x] Khung trang 1px, padding 2mm
- [x] Typecheck + build frontend pass

## Success Criteria
- Preview trên màn hình hiển thị đúng cỡ chữ mới, không chữ nào tràn viền ô.
- Dòng Chà nhám chỉ chiếm 1 dòng với spec ngắn (`SANDING PAPER #320`).

## Risk & Rollback
- Rủi ro: font fallback hệ thống (Windows/macOS) khác metric làm wrap nhiều hơn dự kiến → Phase 3 kiểm tra bằng PDF thật.
- Rollback: revert riêng `PrintableSheetA4.tsx`.

