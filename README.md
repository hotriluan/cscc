# ALKANA Coating — Hệ thống Lập lịch (CS) & Tính giá thành Sơn (CC)

Ứng dụng Web Full-Stack TypeScript tự động hóa hoàn toàn quy trình lập **Coating Schedule (CS)**, tính toán **Coating Cost (CC)** theo thời gian thực và dự toán định mức vật tư **BOM Summary**, được xây dựng dựa trên đặc tả kỹ thuật [docs/coating_system_specification.md](docs/coating_system_specification.md) và bộ dữ liệu chuẩn [docs/Form CS Industry.xlsx](docs/Form CS Industry.xlsx).

---

## 1. Kiến trúc Monorepo

- [`packages/shared`](packages/shared):
  - Bộ máy tính toán cốt lõi ([`calculator.ts`](packages/shared/src/calculator.ts)):
    - Xử lý chuỗi khoảng định mức `CA (g/m²)` (ví dụ `"100-120"` $\rightarrow$ trung bình `110`).
    - **Chống sai số làm tròn (IEEE-754 Exact Intermediate Precision):** Giữ nguyên độ chính xác số thực 64-bit xuyên suốt các bước trung gian (`mixedPriceRaw`, `caPlusLossRaw`, `coverageRaw`, `coatingCostRaw`) và chỉ làm tròn tại tầng hiển thị cuối cùng.
    - **Thuật toán gộp dòng động (`computeDynamicRowSpanLayout`):** Hỗ trợ số lượng hóa chất tùy ý ($1 \dots N$ dòng) trên mỗi bước và các hàng phụ `SANDING` xen kẽ.
    - **Phân quyền bảo mật (RBAC Redaction):** Tự động ẩn toàn bộ đơn giá (`priceSnapshotVnd`, `priceUnitVnd`) khi người dùng có vai trò `TECHNICAL`.
- [`apps/backend`](apps/backend):
  - REST API (`Express` + `ExcelJS` + **PostgreSQL 16** thông qua `Prisma ORM` [`schema.prisma`](apps/backend/prisma/schema.prisma) & lịch sử migration [`prisma/migrations/`](apps/backend/prisma/migrations/20261030000000_init_cscc_schema/migration.sql)).
  - Lưu trữ toàn bộ dữ liệu trực tiếp trên cơ sở dữ liệu quan hệ **PostgreSQL (`cscc_db`)** qua [`PostgresDataStore`](apps/backend/src/store/data-store.ts). Khi database trống, hệ thống tự động đồng bộ 5 bảng Master Data từ [`docs/Form CS Industry.xlsx`](docs/Form CS Industry.xlsx) (`Customer` [539 dòng], `quotation` [2,531 dòng], `packing mapping` [33 dòng], `Application Step Master` [7 bước], `app-method` [2 phương pháp]), 4 tài khoản `User` mặc định (`leader@alkana.vn`, `sales@alkana.vn`, `tech@alkana.vn`, `admin@alkana.vn`) cùng dự án mẫu Golden Dataset `NITORI-HO CHI MINH (NTR 001)`.
  - Hỗ trợ **Xác thực JWT (`POST /api/auth/login`, `GET /api/auth/me`)** kết hợp song song với **Quick RBAC Switcher (`x-user-role`)** và **Server-side Pagination (`GET /api/master/quotations/paged`, `GET /api/master/customers/paged`)**.
  - Xuất file Excel (`.xlsx`) động với `mergeCells` tự động theo số hóa chất mỗi bước và nhúng công thức Excel sống (`SUMPRODUCT`, `(1/I)*H`, `1000/J`, `J*F/1000`, `SUM`).
- [`apps/frontend`](apps/frontend):
  - Giao diện `React 18` + `Vite` + `TailwindCSS` chia thành **Sidebar (Menu điều hướng & RBAC Switcher)** và **Main Workspace**:
    - **5.1 Quản trị Master Data (CRUD & Import Excel):** Quản lý `Customer`, `Quotation`, `Application Step`, `App-method`, `Packing Mapping`.
    - **5.2 Giao diện Lập lịch (`Coating Schedule - CS`):** Biểu mẫu động (Dynamic Form) cho phép thêm bước thi công, chèn nhiều `Product Code` trong mỗi bước, chèn hàng phụ `SANDING` xen kẽ, tự động gộp ô (`rowSpan`).
    - **5.3 Màn hình Báo giá (`Coating Cost - CC`):** Chế độ **Read-only**, tự động ẩn đối với `TECHNICAL`, tự động nhảy số real-time khi chỉnh sửa bên CS.
    - **BOM Summary & Bản in A4/PDF:** Dự toán số Kg/Lít và số thùng cần đặt theo diện tích $m^2$; in biểu mẫu chuẩn A4 ngang với 4 ô chữ ký (`CUSTOMER`, `PD/PM`, `TA`, `PROJECT LEADER`).

---

## 2. Hướng dẫn Khởi chạy & Kiểm thử

```bash
# 1. Cài đặt dependencies & cấu hình biến môi trường PostgreSQL (apps/backend/.env)
npm install

# 2. Đồng bộ Prisma Schema / Migration lên PostgreSQL (cscc_db) & Seed dữ liệu
npm run db:push
npm run db:seed

# Các lệnh quản trị Database tiện ích:
# npm run db:reset   -> Khôi phục toàn bộ Master Data từ Excel + Golden Dataset NTR 001 + 4 User mẫu
# npm run db:studio  -> Mở giao diện quản trị trực quan Prisma Studio trên trình duyệt
# npm run db:migrate -> Chạy SQL Migration cho môi trường Staging / Production

# 3. Chạy toàn bộ Unit Test (@cscc/shared) & E2E Test (@cscc/backend trên PostgreSQL)
npm test

# 4. Kiểm tra kiểu dữ liệu (TypeScript) & Build Production
npm run typecheck
npm run build

# 5. Khởi chạy môi trường phát triển
# Terminal 1 — Backend API (http://localhost:4000)
npm run dev:backend

# Terminal 2 — Frontend Web UI (http://localhost:5173)
npm run dev:frontend
```

