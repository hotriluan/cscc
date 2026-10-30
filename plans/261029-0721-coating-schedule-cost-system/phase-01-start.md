---
phase: 1
title: "Phase 1: Monorepo Setup, Database Schema & Excel Importer"
status: todo
priority: P1
effort: "5h"
dependencies: []
---

# Phase 1: Monorepo Setup, Database Schema & Excel Importer

## Context Links

- Đặc tả nghiệp vụ: `c:\dev\cscc\docs\coating_system_specification.md`
- File Excel gốc: `c:\dev\cscc\docs\Form CS Industry.xlsx`
- Ảnh tham chiếu Master Data: `c:\dev\cscc\pic\customermaster.png`, `c:\dev\cscc\pic\quotation1.png`, `c:\dev\cscc\pic\packingmapping.png`, `c:\dev\cscc\pic\appstepmaster.png`, `c:\dev\cscc\pic\appmethod.png`

## Overview

Khởi tạo cấu trúc dự án Full-stack TypeScript Monorepo (`packages/shared`, `apps/backend`, `apps/frontend`), thiết kế cơ sở dữ liệu PostgreSQL với Prisma ORM cho 5 bảng Master Data + cấu trúc Project/Revision/Steps/Components, và xây dựng công cụ đọc trực tiếp `docs/Form CS Industry.xlsx` để nạp toàn bộ dữ liệu gốc vào DB.

## Key Insights

- Bảng `quotation` trong `Form CS Industry.xlsx` lưu đơn giá theo cặp `(Sold-to Customer Code, Material/Product Name without Pack)` kèm quy cách `Pack` (`20LP`, `18KP`, `4K`) và `Nett` (`20`, `18`, `4`).
- Bảng `packing mapping` ánh xạ mã đóng gói (`Packing`) sang trọng lượng/thể tích tịnh (`Nett`).
- Bảng `ProjectRevision` cần lưu snapshot đơn giá (`unitPriceSnapshot`) và hiệu suất (`efficiencySnapshot`) ngay trên từng dòng bước/vật tư để đảm bảo tính bất biến của lịch sử báo giá.

## Requirements

- [ ] Thiết lập workspace TypeScript (`package.json`, `tsconfig.base.json`, `docker-compose.yml` cho PostgreSQL).
- [ ] Thiết kế `schema.prisma` gồm: `User` (role: `TECHNICAL` | `SALES` | `PROJECT_LEADER` | `ADMIN`), `Customer`, `PackingMapping`, `ApplicationStepMaster`, `ApplicationMethod`, `QuotationItem`, `Project`, `ProjectRevision`, `ScheduleStep`, `ScheduleStepItem`.
- [ ] Viết script & service import trực tiếp 5 sheet Master Data (`Customer`, `quotation`, `packing mapping`, `Application Step Master`, `app-method`) và bản mẫu `NTR 001` từ `c:\dev\cscc\docs\Form CS Industry.xlsx`.

## Architecture

```text
c:\dev\cscc\
├── packages/
│   └── shared/                 # Shared TypeScript types, Zod schemas & Calculation Engine
├── apps/
│   ├── backend/                # Node.js + Express/Fastify + Prisma + ExcelJS + PDF exporter
│   │   └── prisma/schema.prisma
│   └── frontend/               # React + Vite + TailwindCSS + TanStack Query/Table
└── docker-compose.yml          # PostgreSQL 16 local container
```

## Related Code Files

- Create: `c:\dev\cscc\package.json`
- Create: `c:\dev\cscc\docker-compose.yml`
- Create: `c:\dev\cscc\packages\shared\src\index.ts`
- Create: `c:\dev\cscc\apps\backend\prisma\schema.prisma`
- Create: `c:\dev\cscc\apps\backend\src\services\excel-importer.service.ts`
- Create: `c:\dev\cscc\apps\backend\prisma\seed.ts`

## Implementation Steps

1. Khởi tạo cấu trúc monorepo (`npm workspaces` hoặc `pnpm workspaces`) với 3 gói: `@cscc/shared`, `@cscc/backend`, `@cscc/frontend`.
2. Tạo `docker-compose.yml` cho PostgreSQL và file `.env.example`.
3. Định nghĩa đầy đủ schema Prisma (`apps/backend/prisma/schema.prisma`) hỗ trợ:
   - 5 bảng Master Data.
   - Bảng `Project` và `ProjectRevision` (`revNumber`, `status: DRAFT | LOCKED`, `headerMetadata`, `finishingConditions`).
   - Bảng `ScheduleStep` (`stepOrder`, `stepNumber`, `isSandingStep`, `stepName`, `visco`, `caInputRaw` như `"100-120"`, `caNumericValue` = `110`, `applicationMethod`, `efficiencySnapshot`, `dryingTime`).
   - Bảng `ScheduleStepItem` (`productCode`, `mixingRatio`, `unitPriceSnapshot`, `packingCodeSnapshot`, `nettSnapshot`).
4. Xây dựng `excel-importer.service.ts` dùng `exceljs` / `xlsx` đọc file `c:\dev\cscc\docs\Form CS Industry.xlsx`, parse toàn bộ 5 sheet Master Data + dữ liệu mẫu `NTR 001` vào DB.
5. Viết unit test kiểm tra dữ liệu nạp từ `Form CS Industry.xlsx`.

## Todo

- [ ] Khởi tạo Monorepo workspace (`packages/shared`, `apps/backend`, `apps/frontend`)
- [ ] Tạo `schema.prisma` cho Master Data, Projects, Revisions, Steps, StepItems
- [ ] Viết `excel-importer.service.ts` đọc `docs/Form CS Industry.xlsx`
- [ ] Tạo seed script nạp 5 danh mục Master Data + project mẫu `NITORI-HO CHI MINH (NTR 001)`
- [ ] Kiểm증 (Verify) số lượng bản ghi import từ `Form CS Industry.xlsx`

## Success Criteria

- Chạy migration và seed từ `docs/Form CS Industry.xlsx` thành công 100% không lỗi.
- Truy vấn DB có đầy đủ danh sách Customer (`NITORI-HO CHI MINH`), `app-method` (`WIPING = 0.35`, `SPRAY = 0.60`), `packing mapping`, `Application Step Master`, và `quotation`.

## Risk Assessment

- **Dữ liệu Excel có dòng trống hoặc định dạng số không đồng nhất:** Xử lý chuẩn hóa chuỗi (trim, uppercase mã) và ép kiểu số an toàn trong `excel-importer.service.ts`.

## Security Considerations

- Không commit thông tin nhạy cảm trong `.env`; chỉ commit `.env.example`.

## Next Steps

- Chuyển sang Phase 2 để xây dựng Shared Calculation Engine và hệ thống Backend API + RBAC.
