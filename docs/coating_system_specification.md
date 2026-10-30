# TÀI LIỆU ĐẶC TẢ HỆ THỐNG: COATING SCHEDULE & COATING COST WEB APP

## 1. KIẾN TRÚC TỔNG QUAN

* **Frontend:** ReactJS hoặc VueJS (Xử lý bảng tính động, cập nhật số liệu real-time).
* **Backend:** Node.js hoặc Python (FastAPI/Django) xử lý logic và xuất file.
* **Database:** Cơ sở dữ liệu quan hệ (PostgreSQL/MySQL) quản lý danh mục và lưu trữ lịch sử các phiên bản.

## 2. QUẢN LÝ CƠ SỞ DỮ LIỆU (MASTER DATA)

Hệ thống số hóa các danh mục cốt lõi làm dữ liệu nguồn:

* **Customer:** Mã khách hàng, tên đầy đủ.
* **Quotation & Packing:** Mã vật tư (Product Code), mô tả, Đơn giá (Price), và quy cách đóng gói (Nett) để quy đổi.
* **Application Step Master:** Danh sách chuẩn các bước xử lý (SANDING, WIPING FILLER, TOP COAT COLOR...).
* **App-method:** Phương pháp thi công và Tỷ lệ hiệu suất tương ứng (VD: WIPING = 35%, SPRAY = 60%).

## 3. LUỒNG LÀM VIỆC TỰ ĐỘNG HÓA (AUTO-MAPPING) TỪ CS SANG CC

Yêu cầu cốt lõi: Người dùng **chỉ cần thao tác lập Coating Schedule (CS)**, hệ thống sẽ **tự động hoàn toàn 100% bảng Coating Cost (CC)**.

### 3.1. Thao tác tại Coating Schedule (Đầu vào)
Người dùng (Kỹ thuật viên) chỉ chọn và nhập các thông số chuyên môn kỹ thuật:
* Bước thi công (Application Step)
* Mã vật tư (Product Code)
* Tỷ lệ pha (Mixing Ratio)
* Phương pháp thi công (Application Method)
* Định mức sơn (CA - g/m²)

### 3.2. Cơ chế Ánh xạ & Tra cứu tự động (Auto-Lookup) cho Coating Cost
Hệ thống lấy dữ liệu từ CS và tự động điền vào CC:
* **Đồng bộ trực tiếp:** Bê nguyên Tên bước, Mã vật tư, Tỷ lệ pha, Phương pháp, Định mức CA từ CS sang CC.
* **Tra cứu Đơn giá (Price):** Dùng *Mã vật tư* dò vào bảng Master Data `quotation` để xuất ra giá.
* **Tra cứu Hiệu suất (Efficiency):** Dùng *Phương pháp thi công* dò vào bảng Master `app-method` để xuất ra tỷ lệ %.

### 3.3. Tính toán ngầm (Formulas Calculation)
* **Tính CA thành phần:** `Tổng CA của bước * (Mixing Ratio vật tư / Tổng Mixing Ratio bước)`
* **Tính CA + Loss (Từng dòng):** `CA thành phần / Hiệu suất thi công`
* **Coverage (Độ phủ):** Tính toán m²/Ltr/kg dựa trên chỉ số `CA + Loss`.
* **Mixed Price (Giá hỗn hợp):** Nội suy tự động từ Đơn giá gốc và Tỷ lệ pha.
* **Coating Cost (VND/m²):** `Mixed Price / Coverage`.
* **Total Coating Cost:** Tổng chi phí các bước thi công.

## 4. UI/UX & PHÂN QUYỀN BẢO MẬT (ROLE-BASED ACCESS)

* **Workspace (Màn hình làm việc chính):** Giao diện nhập liệu duy nhất là form Coating Schedule.
* **Cost Dashboard (Bảng giá):** Tab Coating Cost được thiết lập ở chế độ **Chỉ xem (Read-only)**. Các con số tự động "nhảy" real-time khi người dùng chỉnh sửa Schedule.
* **Phân quyền ẩn đơn giá:** 
  * Kỹ thuật viên (Technical) chỉ thấy/nhập dữ liệu Coating Schedule.
  * Quản lý / Kinh doanh (Project Leader/Sales) mới có quyền truy cập Tab Coating Cost để xem thông tin tiền tệ (VND/m²).

## 5. THIẾT KẾ GIAO DIỆN VÀ TÍNH NĂNG CHI TIẾT

Giao diện chia thành **Sidebar (Menu điều hướng)** và **Main Workspace (Không gian làm việc)**.

### 5.1. Module Quản trị Master Data (CRUD)
* **Customer:** Quản lý Mã ID, Short Name và Tên đầy đủ.
* **Quotation:** Quản lý Material (Mã vật tư), Description, Packing, Nett, Price.
* **Application Step:** Cấu hình danh sách các bước chuẩn (SANDING, GLAZE, TOP COAT...).
* **App-method:** Cấu hình Phương pháp và Application Efficiency (%).

### 5.2. Giao diện Lập lịch (Coating Schedule)
Được thiết kế dạng **Dynamic Form (Biểu mẫu động)**:
* **Header:** Dropdown chọn Customer, điền Product Item, Color, Substrate Type, Finishing System, Gloss Level, Reference và các điều kiện môi trường.
* **Dynamic Table (Quy trình):**
  * Nút `"Thêm bước thi công"`.
  * Bên trong mỗi bước, cho phép chèn nhiều `"Product Code"`.
  * Nhập thủ công các chỉ số: `Mixing Ratio`, `Visco`, `CA` (dạng khoảng như `100-120`), `Application Method`, `Drying Time`.
  * Tính năng chèn hàng phụ (VD: `"SANDING PAPER #180-240"`) xen kẽ giữa các bước.

### 5.3. Màn hình Báo giá (Coating Cost)
Hoạt động ngầm và chỉ cho phép **Read-only**:
* Tự động đồng bộ Header từ Schedule.
* Bảng dữ liệu tự động load Đơn giá, Hiệu suất và chạy công thức `CA+Loss`, `Coverage`, `Coating Cost` theo thời gian thực.
* Hiển thị dòng `Total Coating Cost (VND/m²)` ở cuối bảng.

## 6. TÍNH NĂNG TỔNG HỢP VẬT TƯ (BOM SUMMARY)

* **Logic:** Hệ thống tự động gom nhóm (Group By) các mã vật tư giống nhau xuất hiện ở nhiều bước khác nhau và tính tổng (Sum) giá trị `CA + Loss`.
* **Mục đích:** Cung cấp "Tổng định mức thực tế g/m²" cho từng hóa chất, nhân với tổng diện tích dự án để tính ra số Kg/Lít và số thùng (Packing) cần đặt hàng.

## 7. QUẢN LÝ PHIÊN BẢN (VERSIONING)

* **Cấu trúc Parent - Child:** Một dự án gốc (Project) sẽ có nhiều lịch sử phiên bản (Rev 00, Rev 01...).
* **Snapshot Dữ liệu:** Lưu tĩnh (đóng băng) toàn bộ thông số, giá cả tại thời điểm tạo Rev.
* **Tính năng:** Nút "Create New Revision" (nhân bản dữ liệu từ bản cũ sang bản mới), và cơ chế Lock (Khóa chỉ xem với các bản đã chốt).

## 8. TÍNH NĂNG XUẤT FILE (EXPORT EXCEL & PDF)

* **Excel Template Injection:** Thư viện Backend đọc `Template.xlsx` có sẵn (logo, chữ ký), bơm dữ liệu động vào, tự động chèn dòng và gộp ô. Ghi trực tiếp các công thức Excel vào file xuất ra.
* **Xuất PDF:** Chụp bản thiết kế HTML/CSS thành file PDF chuẩn A4, read-only để gửi khách hàng.