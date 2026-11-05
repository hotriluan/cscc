---
title: "Phase 05: Automated Testing & End-to-End Verification"
phase: 5
status: completed
effort: "1h"
tags: [testing, verification, rbac, reports, e2e]
---

# Phase 05: Automated Testing & End-to-End Verification

## Mục tiêu
Kiểm chứng toàn diện bằng bộ kiểm thử tự động (`apps/backend/test/reports-analytics-rbac.test.ts`) và kiểm tra build toàn workspace (`shared`, `backend`, `frontend`) để đảm bảo không có lỗi hồi quy và đáp ứng 100% các tiêu chí trong Brainstorm Contract.

## Các file cần tạo/sửa đổi
- `apps/backend/test/reports-analytics-rbac.test.ts` (Mới)

## Các kịch bản kiểm thử bắt buộc (Test Matrix)

1. **Report 1 (Product Usage Report)**:
   - Chọn mã vật tư (ví dụ mã sơn trong dự án `NTR 001`) -> Trả về đúng số lượng CS/CC sử dụng, đúng khách hàng, đúng số `Rev`, đúng công đoạn và định mức `g/m²` + chi phí `VND/m²`.
2. **Report 2 (Customer Portfolio Report)**:
   - Thống kê chính xác số lượng Project, số lượng CS/CC (`APPROVED` vs `DRAFT`) và Coating Cost của từng khách hàng.
3. **Revision Scope Filter (`ALL` | `LATEST` | `APPROVED`)**:
   - Tạo Project có `Rev 00` (`APPROVED`) và `Rev 01` (`DRAFT`):
     - Khi `revisionScope=ALL`: Đếm cả 2 revisions.
     - Khi `revisionScope=LATEST`: Chỉ tính `Rev 01`.
     - Khi `revisionScope=APPROVED`: Chỉ tính `Rev 00`.
4. **Row-level RBAC theo Salesman (`SALES` & `TECHNICAL` vs `ADMIN` & `PROJECT_LEADER`)**:
   - Tài khoản `SALES` hoặc `TECHNICAL` gắn với `Salesman A` chỉ nhận được dữ liệu báo cáo của khách hàng thuộc `Salesman A`; tuyệt đối không xuất hiện khách hàng hay dự án của `Salesman B`.
   - Tài khoản `ADMIN` và `PROJECT_LEADER` nhận được toàn bộ dữ liệu của cả `Salesman A`, `Salesman B` và các khách hàng chưa gán Salesman.
5. **Column-level Cost Redaction cho `TECHNICAL` (TA)**:
   - Khi gọi API với role `TECHNICAL`, mọi trường giá tiền (`priceSnapshotVnd`, `itemCoatingCostVndM2`, `revisionTotalCostVndM2`, `min/avg/maxCoatingCostVndM2`, `totalEstimatedCostVnd`) trong cả 7 báo cáo đều bằng `null`, trong khi các chỉ số kỹ thuật (`g/m²`, `Kg/Ltr`, `stepCount`, `revisionNo`) vẫn đầy đủ.
6. **Excel Report Export (`GET /api/reports/export-excel`)**:
   - Xuất file `.xlsx` thành công (HTTP 200, valid workbook) cho cả `PROJECT_LEADER` (có cột giá `VND/m²`) và `TECHNICAL` (không chứa giá tiền).

## Tiêu chí hoàn thành (Verification)
- [ ] `npm test` tại `packages/shared` và `apps/backend` pass 100%.
- [ ] `npm run build` toàn bộ monorepo (`shared`, `backend`, `frontend`) thành công không có lỗi.

