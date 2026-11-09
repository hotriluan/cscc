# Phase 01: Automated Live Browser Screenshot & Callout Capture

## Context & Requirements
- Chụp ảnh màn hình thực tế từ ứng dụng Web đang chạy (`Backend :4000` + `Frontend :5173`).
- Mỗi ảnh minh họa cần có **Visual Callouts (`①`, `②`, `③`, `④`)** khoanh vùng đỏ và gắn số thứ tự trực tiếp lên các phần tử DOM thực tế để người dùng nhìn vào biết ngay vị trí cần thao tác.
- Bao phủ cả giao diện đầy đủ (`LEADER` / `ADMIN` / `SALES`) và giao diện ẩn đơn giá của `TECHNICAL` (RBAC Redaction).

## Target Screenshot Inventory (`docs/user-guide/screenshots/`)
1. `01-login-page.png` — Màn hình Đăng nhập hệ thống (`LoginPage`: Email, Mật khẩu, Nút Sign In).
2. `02-workspace-overview.png` — Tổng quan Không gian làm việc (`Sidebar`, `Top Action Bar`, `Workspace Tabs CS/CC/BOM`, `Live Cost Footer`).
3. `03-user-profile-modal.png` — Hộp thoại Thông tin Tài khoản & Đổi mật khẩu (`UserAuthModal`).
4. `04-project-explorer.png` — Màn hình Quản lý Dự án (`ProjectExplorerView`: Bộ lọc, Danh sách Project & Revisions, Nút mở/xóa).
5. `05-new-project-modal.png` — Hộp thoại Tạo Dự án Mới (`Create New Project Modal`: Mã dự án, Khách hàng, Sản phẩm, Màu sắc, Chất liệu, Hệ sơn).
6. `06-cs-header-metadata.png` — Khu vực Thông tin chung Qui Trình Sơn (`CoatingScheduleEditor Header`: Khách hàng, Thông số môi trường, Chữ ký).
7. `07-cs-process-steps-table.png` — Bảng Quy trình các bước thi công sơn (`Dynamic Process Steps`: Thêm bước sơn, Chèn bước chà nhám `SANDING`, Thêm nhiều mã hóa chất, Nhập `Mixing Ratio`, `Visco`, `CA g/m²`, `Method`).
8. `08-cs-toolbar-viewport-autosave.png` — Thanh công cụ Bảng CS (`Collapse Header`, `Pin Table Viewport`, `Sync Quotation Prices`, trạng thái `Auto-Save: Saved`).
9. `09-cc-cost-table.png` — Bảng Chi phí Sơn tự động (`CoatingCostTable`: Read-only, tự động tính `CA+Loss`, `Coverage`, `Mixed Price`, `Coating Cost VND/m²`, `Total Coating Cost`).
10. `10-technical-rbac-redaction.png` — Giao diện dưới quyền `TECHNICAL` (Tự động ẩn tab `Coating Cost (CC)` và ẩn toàn bộ cột đơn giá/thành tiền).
11. `11-bom-summary-view.png` — Màn hình Dự toán Định mức Vật tư (`BomSummaryView`: Nhập diện tích `Project Area m²`, tính tổng `Kg/Ltr`, quy đổi số thùng `Packs Required` và tổng chi phí vật tư).
12. `12-revision-status-modal.png` — Quản lý Trạng thái Phiên bản (`DRAFT` $\rightarrow$ `APPROVED` / `INACTIVE` kèm ghi chú lý do bắt buộc & tạo bản `New Revision`).
13. `13-revision-audit-history.png` — Hộp thoại Lịch sử Thay đổi Trạng thái (`Revision Status Audit History Modal`).
14. `14-print-a4-preview.png` — Giao diện Xem trước Bản in Chuẩn A4 Ngang & Xuất Excel (`PrintableSheetA4`: 4 ô chữ ký chuẩn công nghiệp).
15. `15-report-01-product-usage.png` — Báo cáo 1: `Product Usage` (Chọn mã sơn On-Demand, Bảng tổng hợp theo Revision và sổ xuống Breakdown từng Step).
16. `16-report-02-customer-portfolio.png` — Báo cáo 2: `Customer Portfolio` (Phân tích danh mục dự án & chi phí bình quân theo Khách hàng).
17. `17-report-03-revision-variance.png` — Báo cáo 3: `Revision Variance` (So sánh biến động chi phí giữa các phiên bản `Rev 00` vs `Rev 01`).
18. `18-report-04-price-drift.png` — Báo cáo 4: `Price & Quotation Alert` (Cảnh báo chênh lệch giữa đơn giá lưu trong Revision và bảng giá Master hiện hành).
19. `19-report-05-step-benchmark.png` — Báo cáo 5: `Step & System Benchmark` (Phân tích cơ cấu chi phí theo công đoạn và hệ sơn).
20. `20-report-06-bom-forecast.png` — Báo cáo 6: `Multi-BOM Forecast` (Dự báo tổng nhu cầu vật tư gộp từ nhiều dự án và diện tích phân bổ).
21. `21-report-07-activity-funnel.png` — Báo cáo 7: `Project & Revision Activity Funnel` (Phễu trạng thái dự án & năng suất theo Salesman/Kỹ thuật).
22. `22-master-customers.png` — Quản trị Master Data 1: `Customers` (Danh sách khách hàng, gán Salesman phụ trách, Import/Clean Excel).
23. `23-master-quotations.png` — Quản trị Master Data 2: `Quotations` (Bảng đơn giá vật tư sơn & Upload Template Excel).
24. `24-master-steps-methods-packings.png` — Quản trị Master Data 3-5: `Application Steps`, `App-Methods (Efficiency %)` & `Packing Mappings`.
25. `25-master-users-rbac.png` — Quản trị Master Data 6: `User Accounts & RBAC` (Tạo user, phân quyền `ADMIN`/`LEADER`/`SALES`/`TECHNICAL`, gán `salesmanName`).

## Validation
- Toàn bộ 25 file ảnh PNG tồn tại trong `docs/user-guide/screenshots/` với kích thước > 20KB, hiển thị đầy đủ dữ liệu thực và nhãn số `① ② ③`.

