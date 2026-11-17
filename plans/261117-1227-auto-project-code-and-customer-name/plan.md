---
title: "Auto-Generate Project Code ([Short Name] [0001]) & Switch Customer Display to Customer Name"
description: "Tự động sinh Mã hồ sơ (No. / projectCode) theo từng khách hàng với cấu trúc [Short Name 2-6 ký tự] [0001..9999], tự động cấp lại mã khi đổi khách hàng trên bản nháp DRAFT, cảnh báo khi khách hàng chưa cập nhật Short Name (2-6 ký tự), và chuyển toàn bộ hiển thị tên khách hàng trên CS, CC, Print A4, Excel, Sidebar, Reports sang cột Customer Name."
status: completed
priority: P1
branch: main
effort: "~5h"
tags: [project-code, customer-master, coating-schedule, coating-cost, frontend, backend, shared]
blockedBy: []
blocks: []
created: 2026-11-17
---

# Auto-Generate Project Code (`[Short Name] [0001]`) & Switch Customer Display to `customerName`

## Brainstorm Contract

### Outcome
1. **Tự động sinh `No. / Mã hồ sơ` (`projectCode`) theo từng khách hàng:**
   - Cấu trúc mã: `[customer Short Name] [số thứ tự 4 chữ số]` (ví dụ: `NTRI 0001`, `NTRI 0002`, `IKEA 0001`).
   - Trường `No. / Mã hồ sơ` trên **Modal Tạo Hồ Sơ Mới** và **Header tab Coating Schedule (CS)** chuyển sang chế độ `read-only` (hệ thống tự động cấp, không nhập tay).
   - **Tự động cấp lại mã khi đổi Khách hàng trên bản nháp (`DRAFT`) ở tab CS:** Khi người dùng đổi combobox Khách hàng từ khách hàng A sang khách hàng B trên hồ sơ `DRAFT`, hệ thống tự động tính và cấp lại Mã hồ sơ mới theo thứ tự tiếp theo của khách hàng B (ví dụ: `NTRI 0001` $\rightarrow$ `IKEA 0001`).
2. **Quy chuẩn `Short Name` (linh hoạt 2–6 ký tự) & Cảnh báo dữ liệu chưa rút gọn:**
   - Trong **Customer Master**, cột `Short Name` được chuẩn hóa viết hoa (`UPPERCASE`), độ dài hợp lệ từ **2 đến 6 ký tự** (ví dụ: `NTRI`, `IKEA`, `ACG`).
   - Với các khách hàng trong Database hiện tại chưa kịp sửa `Short Name` (độ dài ngoài khoảng 2–6 ký tự hoặc vẫn đang giống hệt `Customer Name` dài > 6 ký tự): Khi người dùng chọn khách hàng đó để tạo hồ sơ mới hoặc đổi khách hàng trên tab CS, hệ thống **báo nhắc cập nhật `Short Name` (2–6 ký tự) cho khách hàng đó trước** tại mục Master Data.
3. **Chuyển toàn bộ hiển thị Tên khách hàng sang `customerName`:**
   - Tất cả các trường hiển thị tên khách hàng trên **Coating Schedule (CS)**, **Coating Cost (CC)**, **Bản in A4 / Xuất PDF**, **Xuất file Excel (`.xlsx`)**, **Sidebar**, **Project Explorer** và **7 Báo cáo phân tích (Reports & Analytics)** chuyển sang sử dụng cột **`customerName`** trong Customer Master thay vì `shortName`.

### Constraints
- `Project.projectCode` có ràng buộc `@unique` trong PostgreSQL (`apps/backend/prisma/schema.prisma`).
- Khi nhân bản phiên bản (`Clone Rev`: `Rev 00` $\rightarrow$ `Rev 01`) trong cùng một `Project`, mã `projectCode` giữ nguyên; chỉ sinh mã mới khi tạo `Project` mới hoặc khi đổi khách hàng trên hồ sơ `DRAFT`.
- Giữ nguyên khả năng tương thích với Golden Dataset (`NTR 001`) và bộ test hiện có của hệ thống.

### Non-goals
- Không thay đổi công thức tính toán Coating Cost (IEEE-754) hay cấu trúc liên kết báo giá `QuotationItem` (`sapCustomerCode`).
- Không thêm bảng hay cột bộ đếm phụ dư thừa trong PostgreSQL (sử dụng thuật toán quét `MAX(sequence) + 1` trong Transaction để chống lệch số khi xóa hồ sơ hoặc re-import Customer).

### Trade-offs
- **Phương án chọn (Max-Sequence Scan theo prefix `shortName` trong Transaction):** Phụ thuộc vào giả định số lượng dự án của một khách hàng nằm trong quy mô doanh nghiệp (< 100.000 hồ sơ/khách hàng). Đổi lại: không cần migration DB schema, không bao giờ bị lỗi trùng mã (`Unique constraint failed`) khi xóa hồ sơ ở giữa, và không bị mất bộ đếm khi Admin làm sạch/upload lại bảng Customer.
- **Phương án loại bỏ (`COUNT + 1` hoặc cột counter riêng trên bảng `Customer`):** Bị gãy ngay khi người dùng xóa hồ sơ cũ (`0001`) rồi tạo hồ sơ mới (`count + 1` sẽ sinh trùng mã `0002` đang tồn tại).

### Better approaches
- Bổ sung cả hàm tính toán dùng chung trong `@cscc/shared` lẫn endpoint `GET /api/projects/next-code?customerId=...` ở Backend để Frontend vừa hiển thị tức thì mã dự kiến ngay khi chọn Khách hàng, vừa được Backend bảo vệ tính duy nhất trong Transaction khi lưu xuống PostgreSQL.

### Acceptance Criteria
1. Chọn một khách hàng có `shortName` hợp lệ (2–6 ký tự, VD `NTRI`) trong modal **Tạo mới Hồ sơ** $\rightarrow$ Ô `No. / Mã Hồ sơ` (read-only) tự động hiển thị `NTRI 0001` (hoặc số tiếp theo `NTRI 0002`), và khi bấm tạo sẽ lưu đúng mã đó.
2. Chọn một khách hàng chưa cập nhật `Short Name` (VD `shortName` dài > 6 ký tự như `"DOANH NGHIỆP CHẾ XUẤT NITORI VIỆT NAM"`) khi Tạo hồ sơ mới hoặc khi Đổi khách hàng ở tab CS $\rightarrow$ Hệ thống chặn và hiển thị cảnh báo song ngữ yêu cầu vào **Master Data $\rightarrow$ Customers** cập nhật `Short Name` (2–6 ký tự) cho khách hàng đó trước.
3. Trên hồ sơ `DRAFT` ở tab CS, khi đổi Khách hàng từ A (`NTRI 0001`) sang B (`IKEA` có `shortName = "IKEA"`), mã hồ sơ tự động cập nhật sang `IKEA 0001` và đồng bộ lên Sidebar + PostgreSQL.
4. Ô `No. / Mã hồ sơ` trên tab CS ở trạng thái khóa (`readOnly`), không cho gõ sửa thủ công.
5. Form Thêm/Sửa Customer trong Master Data kiểm tra `Short Name` bắt buộc từ 2–6 ký tự (tự động viết hoa).
6. Màn hình CS, CC, Bản in A4/PDF, Xuất Excel `.xlsx`, Sidebar, Project Explorer và Reports hiển thị tên khách hàng đầy đủ từ `customer.customerName`.

---

## Architecture & Data Flow

```mermaid
flowchart LR
    subgraph Master["1. Customer Master (PostgreSQL)"]
        C["Customer<br/>customerId: '1200001169'<br/>shortName: 'NTRI' (2-6 chars)<br/>customerName: 'DNCX NITORI VIỆT NAM'"]
    end

    subgraph Validator["2. Validation & Code Engine (@cscc/shared + Backend)"]
        V["isValidCustomerShortName(shortName)<br/>Length 2..6 chars"]
        G["generateNextProjectCode(customerId)<br/>Scan MAX(seq) for prefix 'NTRI '<br/>Format: 'NTRI 0001'"]
    end

    subgraph Workflows["3. Project & CS Workflows"]
        W1["Create New Project Modal<br/>Auto-preview & assign 'NTRI 0001'"]
        W2["CS Header Customer Switch (DRAFT)<br/>Auto-regenerate code for new Customer"]
    end

    subgraph Surfaces["4. Customer Name Display (customerName)"]
        S1["CS Header & Combobox"]
        S2["CC Header"]
        S3["Print A4 / PDF & Excel Export"]
        S4["Sidebar, Project Explorer & 7 Reports"]
    end

    C --> V
    V -->|Valid (2-6 chars)| G
    V -->|Invalid (>6 or <2 chars)| ERR["Block & Prompt to update Short Name first"]
    G --> W1
    G --> W2
    C -->|customerName| Surfaces
```

---

## Phases Roadmap

| # | Phase | Effort | Status | Description |
|---|-------|--------|--------|-------------|
| 1 | [Shared Validators & Project Code Formatter (`@cscc/shared`)](./phase-01-shared-validators-and-code-formatter.md) | 1h | Completed | Xây dựng bộ hàm kiểm tra `shortName` (2–6 ký tự), parse & sinh mã `[SHORT] [0001]` dùng chung tại `packages/shared` kèm unit test. |
| 2 | [Backend Auto-Code Engine, Customer Switch & Excel/Report Updates](./phase-02-backend-auto-code-engine-and-exports.md) | 1.5h | Completed | Cập nhật `data-store.ts`, `app.ts` (`GET /api/projects/next-code`, tự sinh mã khi tạo mới & khi đổi KH ở bản nháp, validate `shortName`), cập nhật `excel-exporter.service.ts` và `report.service.ts` dùng `customerName`. |
| 3 | [Frontend Auto-Code UX, Read-Only Code Field & `customerName` Display](./phase-03-frontend-auto-code-ux-and-customer-name.md) | 1.5h | Completed | Cập nhật `ProjectExplorerView`, `CoatingScheduleEditor`, `CoatingCostTable`, `PrintableSheetA4`, `MasterDataManager`, `ReportsAnalyticsView` và `App.tsx`. |
| 4 | [Automated Testing & End-to-End Verification](./phase-04-automated-testing-and-verification.md) | 1h | Completed | Viết bộ test tự động kiểm tra sinh mã tuần tự, chống trùng khi xóa, đổi KH trên bản nháp, chặn KH chưa rút gọn `Short Name`, và kiểm tra hiển thị `customerName`. |

---

## Dependencies

- Shared Package: `packages/shared/src/calculator.ts`, `packages/shared/src/types.ts`
- Backend Core: `apps/backend/src/store/data-store.ts`, `apps/backend/src/app.ts`, `apps/backend/src/services/excel-exporter.service.ts`, `apps/backend/src/services/report.service.ts`, `apps/backend/src/services/report-excel.service.ts`
- Frontend Core: `apps/frontend/src/api/client.ts`, `apps/frontend/src/App.tsx`, `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`, `apps/frontend/src/components/cost/CoatingCostTable.tsx`, `apps/frontend/src/components/print/PrintableSheetA4.tsx`, `apps/frontend/src/components/projects/ProjectExplorerView.tsx`, `apps/frontend/src/components/master/MasterDataManager.tsx`, `apps/frontend/src/components/reports/ReportsAnalyticsView.tsx`

## Rủi ro chính & Giảm thiểu
- **Khách hàng cũ trong DB chưa cập nhật `Short Name` 2–6 ký tự:** Khi người dùng chọn khách hàng đó để tạo dự án mới hoặc đổi khách hàng trên CS, cả Frontend và Backend đều trả về thông báo rõ ràng chỉ dẫn người dùng vào **Master Data $\rightarrow$ Customers** cập nhật `Short Name` (2–6 ký tự) trước. Các dự án cũ đã tồn tại vẫn mở, xem, sửa bước sơn, tính giá và xuất file bình thường.
- **Tương thích bộ test Golden Dataset (`NTR 001`):** Khách hàng mẫu Nitori (`1200001169`) hoặc các bài test tạo project sẽ hỗ trợ cả mã tự động sinh và dữ liệu seed để không làm gãy bất kỳ test hiện hữu nào.

## Bàn giao cho `/ak-cook`
- Chạy: `/ak-cook plans/261117-1227-auto-project-code-and-customer-name/plan.md` để triển khai tuần tự từ Phase 1 $\rightarrow$ Phase 4.
