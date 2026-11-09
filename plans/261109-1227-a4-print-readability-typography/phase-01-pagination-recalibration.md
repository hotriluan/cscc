---
title: "Phase 01: Pagination Recalibration"
phase: 1
status: completed
effort: "0.75h"
tags: [shared, pagination, print]
---

# Phase 01: Pagination Recalibration

## Context Links
- Plan: [plan.md](./plan.md)
- Engine: [calculator.ts](../../packages/shared/src/calculator.ts#L378-L609)
- Tests: [calculator.test.ts](../../packages/shared/src/calculator.test.ts#L211-L310)

## Overview
- **Priority**: P1 · **Status**: Completed
- Hiệu chỉnh `estimateCsStepUnits`, `estimateCcStepUnits` và hằng số trang cho layout mới: 1 unit = 1 dòng hóa chất ở cỡ chữ mới. Giá trị dưới đây là **điểm xuất phát**; Phase 3 chốt giá trị cuối bằng bản in thật.

## Key Insights (hình học vùng in)
Vùng in A4 dọc: `285mm ≈ 808pt` cao, `≈ 192mm` rộng hữu dụng sau khung trang.

| Thành phần | Ước lượng |
|---|---|
| Header (logo + tiêu đề + dòng mã) | ~40pt |
| Metadata 3 cột ở 8.5pt | ~90pt (chỉ trang 1) |
| Header bảng CS (2 dòng 7.5pt) / CC (3 dòng 7pt) | ~26pt / ~28pt |
| Dòng CS 9pt: `9×1.2 + 2×1 + viền` | ~13.5–14pt |
| Dòng CC 8pt: `8×1.2 + 2×1 + viền` | ~12.4pt |

Từ đó:
- **CS**: trang 1 ≈ 637pt / 14 ≈ 45 → `CS_FIRST_PAGE_MAX_UNITS = 44`; trang sau ≈ 719pt / 14 ≈ 51 → `CS_NEXT_PAGE_MAX_UNITS = 49`.
- **CC**: trang 1 ≈ 635pt / 12.4 ≈ 51 → `CC_FIRST_PAGE_MAX_UNITS = 48`; trang sau ≈ 717pt / 12.4 ≈ 57 → `CC_NEXT_PAGE_MAX_UNITS = 54`.
- Footer CS: Remark (4 dòng 8pt) ≈ `3.5` units, Chữ ký ≈ `5.5` units. Footer CC: Total + Notes ≈ `4` units (+1 khi có remark).
- Sanding band 1 dòng = `1` unit (thực tế cũ ~1.7 dòng vì wrap).

Kiểm chứng NTR 001 (10 × [sanding + 5 hóa chất] = 60 units): trang 1 nhận 7 nhóm (42 ≤ 44), trang 2 nhận 3 nhóm (18) + footer (9) = 27 ≤ 49 → **2 trang**. CC 50 dòng: trang 1 nhận 9 bước (45 ≤ 48), trang 2 nhận 1 bước + footer → **2 trang**.

## Requirements
- Ngưỡng ký tự theo bề ngang cột mới (Phase 2) ở cỡ chữ mới:
  - CS `Product Name` 26% ≈ 48mm, 9pt semibold → `nameLen / 27`.
  - CS `Application Step` 15% ≈ 28mm, 9pt bold → `stepName / 14`.
  - CS `Drying Time` 20% ≈ 37mm, 9pt → `dryingTime / 20`.
  - CS sanding band (cột 2–8 ≈ 184mm, 8.5pt): label `SANDING / CHÀ NHÁM — ` (~21 ký tự) + spec; wrap khi tổng > ~95 ký tự → `1 + 0.8` cho mỗi dòng thêm.
  - CC `Product Name` 21% ≈ 40mm, 8pt → `nameLen / 25`; CC `Item` 12% ≈ 23mm, 8pt bold → `stepName / 12`.
- Dòng wrap thêm tính `0.75` unit (chữ 9pt với leading 1.2: dòng thêm ≈ 10.8pt / 14pt).
- Giữ nguyên toàn bộ bất biến: không tách cặp SANDING + bước kế tiếp, footer luôn đi cùng nhau, xử lý mang bước cuối sang trang mới của CC.
- Cập nhật JSDoc nói rõ 1 unit = 1 dòng dữ liệu ở cỡ chữ in hiện hành.
- Không dùng mã plan/phase trong comment hay tên test.

## Related Code Files
- Modify: `packages/shared/src/calculator.ts`
- Modify: `packages/shared/src/calculator.test.ts`

## Implementation Steps
1. Cập nhật 4 hằng số trang, `CS_SIGNATURES_UNITS = 5.5`, `CC_FOOTER_BASE_UNITS = 4`.
2. Viết lại nhánh `SANDING` trong `estimateCsStepUnits` theo công thức sanding band.
3. Cập nhật ngưỡng ký tự và hệ số dòng wrap trong cả hai hàm ước lượng.
4. Cập nhật test hiện có:
   - NTR 001 CS: 2 trang; trang 1 = 14 entries (7 nhóm), trang 2 = 6 entries + Remark + Chữ ký.
   - CC 6 bước = 1 trang; CC 10 bước = 2 trang (trang 1 = 9 bước, trang 2 = 1 bước + Total).
   - Ca CC 8 bước: tính lại theo hằng số mới (40 dòng + footer 4 = 44 ≤ 48 → 1 trang) và cập nhật assertion tương ứng.
5. Thêm test mới:
   - Tên vật tư dài (~60 ký tự) ở mọi dòng: bộ phân trang tăng số trang thay vì nhồi quá ngân sách (assert mọi trang ≤ ngân sách bằng cách kiểm tra số trang ≥ kỳ vọng).
   - `sandingSpec` rất dài vẫn giữ cặp với bước kế tiếp trên cùng một trang.
6. `npm run typecheck --workspace=@cscc/shared` và `npm test --workspace=@cscc/shared`.

## Todo List
- [x] Hằng số trang và footer mới
- [x] Ước lượng sanding band 1 dòng
- [x] Ngưỡng ký tự + hệ số wrap theo cột/cỡ chữ mới
- [x] Cập nhật test NTR 001 (CS/CC) và ca 8 bước
- [x] Test tên dài + sandingSpec dài
- [x] Typecheck + test shared pass

## Success Criteria
- Test shared pass, gồm ca NTR 001 = 2 trang cho CS và CC.
- Hằng số có comment giải thích nguồn gốc hình học (pt/dòng), không có magic number không giải thích.

## Risk & Rollback
- Rủi ro: ước lượng lạc quan → trình duyệt tràn trang. Giảm thiểu: biên an toàn ~5% và Phase 3 hiệu chỉnh bằng PDF thật.
- Rollback: revert riêng `calculator.ts` + test; frontend vẫn chạy được với hằng số cũ (chỉ thừa khoảng trống).

