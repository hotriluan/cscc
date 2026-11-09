---
title: "Phase 03: Visual Parity & Print PDF Verification"
phase: 3
status: completed
effort: "0.75h"
tags: [verification, print, pdf, wysiwyg, e2e]
---

# Phase 03: Visual Parity & Print PDF Verification

## Context Links
- Plan: [plan.md](./plan.md)
- Printout Reference Directory: `c:\dev\cscc\docs\printout\`
- User Guide Screenshot: `c:\dev\cscc\docs\user-guide\screenshots\14-print-a4-preview.png`

## Overview
- **Priority**: P1 · **Status**: Completed · **Depends on**: Phase 1, Phase 2
- Chạy ứng dụng thực tế trên trình duyệt Chromium, kiểm chứng bằng thông số DOM (`getBoundingClientRect()`) và hình ảnh chụp trực tiếp để đảm bảo:
  1. **Màn hình Preview và file PDF xuất ra giống nhau 100%** (tỷ lệ trang, khung viền A4, vị trí ngắt dòng, khoảng trống cuối trang).
  2. **Trang 1 của CS và CC đầy đặn, chuyên nghiệp** (CS Trang 1 = 8 bước; CC `NTR 001` = trọn vẹn 10 bước + Total + Notes trong **1 trang A4 duy nhất**).
  3. **Khung viền ngoài `.a4-print-page` chạy dọc hết trang A4** ở cả Trang 1 lẫn Trang 2.

## Verification Matrix

| Kịch bản | Chế độ | Kỳ vọng trên Màn hình Preview | Kỳ vọng trên File PDF / Giấy in A4 | Điều kiện Đạt |
|----------|--------|-------------------------------|------------------------------------|---------------|
| **1. `NTR 001` (10 bước)** | **CC** | `Total / Tổng: 1 trang` (`Page 1 / 1`); chứa đủ 10 bước + TOTAL `894,143` + Notes + Remark trong 1 tờ A4 | **1 trang PDF duy nhất (`1 / 1`)**, cao `~273mm / 285mm`, khung viền A4 đầy đủ `284mm` | Số trang Preview == PDF == `1`; khớp 100% vị trí dòng |
| **2. `NTR 001` (10 bước)** | **CS** | `Total / Tổng: 2 trang`; Trang 1 = Bước 1–8 (`~266mm / 285mm`); Trang 2 = Bước 9–10 + Remark + 4 ô Chữ ký trong khung A4 `284mm` | **2 trang PDF (`1 / 2`, `2 / 2`)**, khớp từng dòng với màn hình Preview | Số trang Preview == PDF == `2`; Trang 1 hết trống trải |
| **3. Quy trình 5 bước** | **CS & CC** | `1 trang` (`1 / 1`) cho cả CS và CC, khung viền đóng hết trang A4 | **1 trang PDF (`1 / 1`)** | Không tràn trang |
| **4. Quy trình 12 bước hoặc tên vật tư dài** | **CS & CC** | Tự động phân trang an toàn (CC Trang 1 chứa 10–11 bước), không cắt đôi bước sơn | Số trang PDF == Số trang báo trên Preview | Không có trang trắng thừa |
| **5. So khớp kích thước Screen vs Print** | **DOM Box** | `.a4-print-page` rộng `198mm` (`~748.3px`), cao `284mm` (`~1073.4px`) | `@media print` `.a4-print-page` rộng `198mm`, cao `284mm` | Độ lệch `width` và `height` giữa Screen và Print `= 0px` |

## Implementation Steps
1. Khởi động backend và frontend dev servers (kiểm tra port trước khi bật, ghi nhận PID để dọn dẹp sau khi xong).
2. Mở giao diện Preview `PrintableSheetA4` cho `NTR 001` ở cả chế độ **CS** và **CC**:
   - Đo `getBoundingClientRect()` của `.a4-print-page`, bảng, và các dòng ở chế độ `screen` vs `emulateMedia({ media: 'print' })` để chứng minh độ khớp `1:1` (`0px` drift).
   - Chụp ảnh màn hình Preview mới của CS và CC để đối chiếu trực tiếp với 2 ảnh người dùng đã gửi.
3. Xuất 2 file PDF mới (`ALKANA_CS_NTR 001_Rev00.pdf` và `ALKANA_CC_NTR 001_Rev00.pdf`), lưu vào thư mục `plans/261109-1425-a4-wysiwyg-full-page-print/reports/` (và cập nhật bản PDF trong `docs/printout/` nếu người dùng muốn dùng làm bản in chuẩn mới).
4. Render các trang PDF ra ảnh PNG bằng `pypdfium2` và kiểm tra trực quan từng trang.
5. Cập nhật ảnh chụp `docs/user-guide/screenshots/14-print-a4-preview.png`.
6. Chạy toàn bộ cổng chất lượng:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
7. Dừng toàn bộ tiến trình dev server/headless browser đã bật và viết báo cáo nghiệm thu `reports/verification.md`.

## Todo List
- [x] Kiểm chứng độ khớp DOM `0px` giữa Screen Preview và Print mode
- [x] Xuất và kiểm tra PDF thực tế của `NTR 001` (CC = 1 trang, CS = 2 trang với Trang 1 chứa 8 bước)
- [x] Chụp ảnh màn hình Preview mới đối chiếu với PDF
- [x] Chạy pass `npm run typecheck`, `npm test`, `npm run build`
- [x] Dọn sạch tiến trình nền và ghi báo cáo `reports/verification.md`

## Success Criteria
- Màn hình Preview hiển thị tờ giấy A4 giống **100%** với file PDF và tờ giấy in ra thực tế.
- Trang 1 của CS (8 bước) và CC (10 bước + Total + Notes trọn 1 trang) lấp đầy trang giấy đẹp mắt, khung viền ngoài chạy dọc hết tờ A4 ở mọi trang.

