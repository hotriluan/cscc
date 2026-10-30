---
phase: 5
title: "Phase 5: End-to-End Verification (NITORI NTR 001 Golden Dataset) & QA"
status: todo
priority: P1
effort: "3h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: End-to-End Verification (NITORI NTR 001 Golden Dataset) & QA

## Context Links

- Ảnh dữ liệu chuẩn (Golden Dataset): `c:\dev\cscc\pic\cs.png`, `c:\dev\cscc\pic\cc.png`
- File Excel gốc: `c:\dev\cscc\docs\Form CS Industry.xlsx`

## Overview

Kiểm thử toàn diện hệ thống (Unit Tests, API Integration Tests, và UI/Export Verification) dựa trên bộ dữ liệu chuẩn **NITORI-HO CHI MINH (`NTR 001`)** từ file `docs/Form CS Industry.xlsx` và các ảnh trong `pic/`.

## Key Insights

- Bộ dữ liệu `NITORI-HO CHI MINH (NTR 001)` trong `cs.png` và `cc.png` là một bài test chuẩn vàng (Golden Test):
  - Có 10 bước phủ sơn đánh số `1..10` xen kẽ bởi 10 dòng `SANDING`.
  - Mỗi bước phủ sơn gồm 5 dòng hóa chất (`PSV-76000 SB HC MY VN` x 3 dòng với tỷ lệ `10, 10, 60`; `THPU-71306 01 KD VN` x 2 dòng với tỷ lệ `20, 20`).
  - Các bước 1, 3, 5, 7 dùng phương pháp `WIPING` (Hiệu suất `35%`, `CA + Loss = 314.29`, `Coverage = 3.18`, `Coating Cost = 119,219.05`).
  - Các bước 2, 4, 6, 8, 9, 10 dùng phương pháp `SPRAY` (Hiệu suất `60%`, `CA + Loss = 183.33`, `Coverage = 5.45`, `Coating Cost = 69,544.44`).
  - Tổng cộng 10 bước: $4 \times 119,219.0476 + 6 \times 69,544.4444 = 476,876.19 + 417,266.67 = 894,142.86 \rightarrow \mathbf{894,143\text{ VND/m}^2}$.

## Requirements

- [ ] Chạy bộ test tự động kiểm tra toàn bộ luồng: Import `docs/Form CS Industry.xlsx` $\rightarrow$ Tạo/Load dự án `NTR 001` $\rightarrow$ Tính toán bảng CC $\rightarrow$ Tính toán bảng BOM Summary $\rightarrow$ Kiểm tra phân quyền RBAC $\rightarrow$ Kiểm tra Versioning & Lock $\rightarrow$ Kiểm tra xuất file `.xlsx`.
- [ ] Đảm bảo `npm test`, `npm run build`, và typecheck (`tsc --noEmit`) trên toàn bộ monorepo pass 100%.
- [ ] Cập nhật `README.md` hướng dẫn chạy hệ thống và sử dụng các tính năng.

## Related Code Files

- Create: `c:\dev\cscc\apps\backend\test\e2e-ntr001.test.ts`
- Create: `c:\dev\cscc\README.md`

## Implementation Steps

1. Viết bài test tích hợp `e2e-ntr001.test.ts` nạp trực tiếp `docs/Form CS Industry.xlsx` và đối chiếu từng con số của dự án `NTR 001` với bảng kết quả trong `pic/cc.png`.
2. Kiểm tra bảo mật phân quyền (`TECHNICAL` vs `SALES` / `PROJECT_LEADER`).
3. Kiểm tra file `.xlsx` xuất ra có chứa đúng các sheet, ô gộp và công thức Excel.
4. Chạy `typecheck`, `lint`, `test`, `build` toàn dự án và viết `README.md`.

## Todo

- [ ] Viết và chạy bài test E2E Golden Dataset `NITORI-HO CHI MINH (NTR 001)`
- [ ] Kiểm thử phân quyền RBAC (`Technical` vs `Sales`) và Versioning (`Rev 00` -> `Rev 01`, `Lock`)
- [ ] Kiểm thử xuất file Excel (`.xlsx`) và giao diện in PDF A4
- [ ] Chạy toàn bộ cổng kiểm tra chất lượng (`test`, `typecheck`, `build`) và hoàn thiện `README.md`

## Success Criteria

- 100% test cases (Unit + E2E) pass xanh.
- Không có lỗi TypeScript hay build ở cả 3 packages (`shared`, `backend`, `frontend`).

## Risk Assessment

- Đảm bảo dọn dẹp mọi tiến trình server/test chạy ngầm sau khi kết thúc kiểm thử theo đúng quy tắc `process-management.md`.

## Security Considerations

- Rà soát không có secret hay dữ liệu nhạy cảm bị log ra console hoặc commit vào git.

## Next Steps

- Bàn giao hệ thống hoàn chỉnh và sẵn sàng chạy `/ak:cook` để triển khai code.