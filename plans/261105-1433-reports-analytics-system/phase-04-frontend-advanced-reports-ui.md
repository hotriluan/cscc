---
title: "Phase 04: Frontend Advanced Analytical Reports 3–7 (EN/VI)"
phase: 4
status: completed
effort: "2h"
tags: [frontend, react, analytics, reports, bilingual]
---

# Phase 04: Frontend Advanced Analytical Reports 3–7 (EN/VI)

## Mục tiêu
Hoàn thiện 5 sub-tab báo cáo phân tích nâng cao trong `ReportsAnalyticsView.tsx` với giao diện trực quan, biểu đồ thanh tỷ trọng (CSS progress bars), bộ lọc tương tác và tuân thủ nghiêm ngặt quy tắc bảo mật giá cho `TECHNICAL` cùng chuẩn song ngữ EN/VI.

## Các file cần sửa đổi
- `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx`

## Các bước thực hiện

### 1. Tab 3: Revision Cost & Spec Variance (`So sánh Biến động giữa các Revision`)
- Cho phép chọn Project và chọn cặp Revision (`Base Rev` vs `Target Rev`, mặc định so sánh `Rev 00` với `Latest Rev`), đồng thời hiển thị bảng tổng hợp biến động của tất cả các Project có từ 2 Revisions trở lên.
- Hiển thị chênh lệch số bước sơn ($\Delta$ Steps), chênh lệch tổng định mức tiêu hao ($\Delta$ `g/m²`), chênh lệch tổng Coating Cost ($\Delta$ `VND/m²` & `%` — ẩn với `TECHNICAL`).
- Bảng chi tiết từng dòng thay đổi: Vật tư thêm mới (`ADDED`), Vật tư loại bỏ (`REMOVED`), Vật tư thay đổi định mức/tỷ lệ/đơn giá (`MODIFIED`).

### 2. Tab 4: Price Drift & Quotation Alert (`Chênh lệch Giá Snapshot & Cảnh báo Báo giá`)
- Quét toàn bộ các vật tư trong các bản CS/CC thuộc phạm vi lọc:
  - Hiển thị trạng thái khớp báo giá: `Matched / Khớp giá`, `Price Drift / Lệch giá`, `Expired / Hết hạn báo giá`, `Missing Quotation / Chưa có trong báo giá`.
  - Với `ADMIN`, `PROJECT_LEADER`, `SALES`: Hiển thị rõ `Snapshot Price (VND/Kg)` vs `Latest Quotation Price (VND/Kg)`, chênh lệch đơn giá và tác động lên tổng `Coating Cost (VND/m²)` của qui trình (Old Cost vs Live Cost).
  - Với `TECHNICAL`: Ẩn toàn bộ cột tiền, chỉ hiển thị trạng thái hiệu lực báo giá (`validFrom` – `validTo`) và cảnh báo mã vật tư hết hạn/thiếu báo giá kỹ thuật.

### 3. Tab 5: Step & Finishing System Benchmark (`Cơ cấu Chi phí theo Công đoạn & Hệ sơn`)
- **Bảng 1 — Theo Công đoạn (`By Application Step`)**: Thống kê tần suất xuất hiện, định mức trung bình (`g/m²`), chi phí trung bình (`VND/m²` — ẩn với `TECHNICAL`) và thanh tỷ trọng chi phí (`% Share`).
- **Bảng 2 — Theo Hệ sơn & Loại gỗ (`By Finishing System & Substrate`)**: So sánh chuẩn định mức (`g/m²`), số bước trung bình và biên độ giá `Min / Avg / Max (VND/m²)` giữa các hệ sơn (`NC-PU`, `PU`, `UV`, `WB`...).

### 4. Tab 6: Aggregated Multi-Project BOM Forecast (`Dự báo Nhu cầu Vật tư BOM Tổng hợp`)
- Cho phép người dùng tích chọn các bản CS/Revision cần chạy sản xuất và nhập diện tích `Area (m²)` dự kiến cho từng bản (mặc định lấy `defaultAreaM2`).
- Tự động cộng gộp nhu cầu của từng mã hóa chất (`materialCode`) trùng nhau trên nhiều dự án -> Tính tổng khối lượng cần dùng (`Total Kg/Ltr`), số thùng chính xác (`Exact Packs`), số thùng cần đặt làm tròn lên (`Packs to Order`) và tổng ngân sách dự kiến (`Total Cost VND` — ẩn với `TECHNICAL`).

### 5. Tab 7: Salesman & Technical Activity Funnel (`Hiệu suất Hoạt động Sales & Kỹ thuật TA`)
- **Bảng 1 — Theo Salesman (`By Salesman`)**: Số khách hàng phụ trách, số khách hàng đã có hồ sơ CS, tổng số Project, tổng số bản CS/CC, số bản `APPROVED`, tỷ lệ duyệt (`Approval Rate %`), số Revision trung bình/Project và Coating Cost trung bình (`VND/m²`).
- **Bảng 2 — Theo Kỹ thuật viên (`By Technical TA - preparedByTa`)**: Số hồ sơ đã lập, số bản `APPROVED` / `DRAFT`, tỷ lệ duyệt (`%`), số hệ sơn đã thực hiện và số bước sơn trung bình.

## Tiêu chí hoàn thành (Verification)
- [ ] Cả 7 sub-tab báo cáo hoạt động trơn tru, không lỗi render và đồng bộ song ngữ EN/VI.
- [ ] Nút Xuất Excel xuất đúng dữ liệu của báo cáo đang xem.

