---
title: "Phase 03: Real Print Verification & Calibration"
phase: 3
status: completed
effort: "1h"
tags: [verification, print, pdf, testing]
---

# Phase 03: Real Print Verification & Calibration

## Context Links
- Plan: [plan.md](./plan.md)
- Bản PDF cũ để so sánh: `docs/ALKANA_CS_NTR 001_Rev00.pdf`, `docs/ALKANA_CC_NTR 001_Rev00.pdf`
- Golden dataset NTR 001: [excel-importer.service.ts](../../apps/backend/src/services/excel-importer.service.ts) (`buildGoldenDatasetNtr001`)

## Overview
- **Priority**: P1 · **Status**: Completed · **Depends on**: Phase 1, Phase 2
- Xuất PDF thật từ trình duyệt, đếm trang và soát lỗi bằng mắt, rồi tinh chỉnh hằng số phân trang cho đến khi số trang PDF bằng số trang paginator ở mọi ca.

## Requirements
- Chạy app local với dữ liệu seed (có NTR 001), mở Print A4 cho CS và CC.
- Xuất PDF bằng Chromium (bộ in của trình duyệt hoặc Playwright `page.pdf({ format: 'A4', preferCSSPageSize: true })`), cùng engine người dùng dùng.
- Render PDF ra PNG (đã có `pypdfium2` trên máy) để soát.
- Theo quy tắc quản lý tiến trình: ghi lại PID/port của dev server đã khởi động và dừng chúng khi xong.

## Test Matrix
| Ca | Dữ liệu | Kỳ vọng |
|---|---|---|
| A | NTR 001 CS (10 bước × 5 hóa chất + 10 dải chà nhám) | 2 trang; Remark + Chữ ký trên trang 2 |
| B | NTR 001 CC (10 bước × 5) | 2 trang; Total + Notes + Remark trên trang 2 |
| C | Quy trình 5 bước, 2–3 hóa chất/bước | CS 1 trang, CC 1 trang |
| D | Tên vật tư dài (~50–60 ký tự) và `sandingSpec` dài | Có thể thêm trang; **không** trang nào tràn, không tách cặp sanding |
| E | Role `TECHNICAL` | Chỉ in được CS (RBAC không đổi) |

Ca C/D có thể tạo bằng revision nháp tạm trong DB local; xóa sau khi kiểm tra.

## Pass conditions (mỗi ca)
1. Số trang PDF = `Page / Trang: x / N` trên header (bằng paginator).
2. Không trang nào có nội dung bị cắt hoặc đẩy sang trang trống thừa.
3. Không chữ tràn viền ô; khoảng số không bị ngắt giữa chừng.
4. Đo trên PNG: chữ dữ liệu CS ≈ 9pt, CC ≈ 8pt (chiều cao chữ hoa tương ứng).
5. Khoảng trống cuối trang không cuối (non-final) ≤ ~1 nhóm bước (không lãng phí như bản cũ).

## Calibration loop
- Nếu tràn trang: giảm `*_MAX_UNITS` tương ứng 1–2 units hoặc tăng hệ số wrap; chạy lại ca A–D.
- Nếu trang không cuối trống > 1 nhóm bước: tăng `*_MAX_UNITS` 1–2 units, nhưng giữ biên an toàn ~5%.
- Cập nhật assertion test ở Phase 1 nếu hằng số cuối thay đổi.

## Implementation Steps
1. Khởi động backend + frontend local (tái dùng nếu đang chạy, không mở trùng port).
2. Xuất PDF ca A, B → `plans/261109-1227-a4-print-readability-typography/reports/` (`ALKANA_CS_NTR 001_Rev00.pdf`, `ALKANA_CC_NTR 001_Rev00.pdf`).
3. Render PNG, so sánh song song với bản cũ trong `docs/`.
4. Thực hiện ca C, D, E; hiệu chỉnh nếu cần.
5. Chạy gate toàn repo: `npm run typecheck`, `npm test`, `npm run build`.
6. Nếu sách hướng dẫn hiển thị bố cục bảng in (`docs/user-guide/screenshots/14-print-a4-preview.png`), chụp lại ảnh đó.
7. Dừng các tiến trình đã khởi động; xóa dữ liệu nháp tạm.
8. Ghi tóm tắt kết quả (số trang từng ca, hằng số cuối) vào `reports/verification.md`.

## Todo List
- [x] PDF ca A, B xuất ra reports/
- [x] So sánh trước/sau bằng PNG
- [x] Ca C, D, E đạt
- [x] Hằng số phân trang chốt, test cập nhật
- [x] typecheck + test + build toàn repo pass
- [x] Ảnh user guide (nếu áp dụng)
- [x] Dọn tiến trình và dữ liệu tạm
- [x] reports/verification.md

## Success Criteria
- Mọi pass condition đạt ở 5 ca; toàn bộ gate pass.

## Risk & Rollback
- Rủi ro: máy người dùng in bằng trình duyệt/font khác Chromium → ghi chú engine đã kiểm chứng trong `verification.md`.
- Rollback: revert commit của Phase 1 + 2.

