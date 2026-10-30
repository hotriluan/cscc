---
title: "Coating Schedule & Coating Cost System (CSCC)"
description: "Full-stack TypeScript web application automating Coating Schedule (CS) to Coating Cost (CC) & BOM Summary with RBAC, Versioning, and Excel/PDF export."
status: completed
priority: P1
effort: "24h"
tags: [feature, frontend, backend, database, api, auth]
blockedBy: []
blocks: []
created: 2026-10-29
---

# Coating Schedule & Coating Cost System (CSCC)

## Overview

Xây dựng hệ thống Web App **Coating Schedule (CS) & Coating Cost (CC)** theo kiến trúc Full-stack TypeScript (**React + Vite + Tailwind/Shadcn + Node.js/Express + Prisma + PostgreSQL**) nhằm số hóa 100% quy trình lập quy trình sơn gỗ và tính giá tự động từ file gốc `docs/Form CS Industry.xlsx`.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Quản lý 5 danh mục Master Data (`Customer`, `Quotation`, `Packing Mapping`, `Application Step Master`, `App-method`) và bộ công cụ Import trực tiếp từ `docs/Form CS Industry.xlsx`. | P1 |
| 2 | Xây dựng Shared Calculation Engine & Backend API tự động ánh xạ 100% từ CS sang CC (hỗ trợ nhập `CA` dạng khoảng như `100-120` tự lấy trung bình `110`, bỏ qua các bước `SANDING` bên CC, tra cứu giá theo `Customer + Product` và hiệu suất theo `App-method`). | P1 |
| 3 | Phân quyền RBAC chặt chẽ từ tầng API (`Technical` chỉ thao tác CS, ẩn tuyệt đối đơn giá/thành tiền; `Sales / Project Leader` xem đầy đủ CS, CC gộp ô theo bước và BOM Summary quy đổi số Kg/Lít & số thùng). | P1 |
| 4 | Quản lý phiên bản (`Rev 00`, `Rev 01`..., Snapshot tĩnh đơn giá/hiệu suất tại thời điểm chốt, Lock bản đã duyệt) và Xuất file Excel (nhúng công thức + merge cells theo template) & PDF chuẩn A4. | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Monorepo Setup, Database Schema & Excel Importer](./phase-01-start.md) | Completed |
| 2 | [Shared Calculation Engine, Backend API & RBAC](./phase-02-backend-api-and-calc-engine.md) | Completed |
| 3 | [Frontend Workspace UI: CS Editor, CC Merged View & BOM Summary](./phase-03-frontend-workspace-ui.md) | Completed |
| 4 | [Project Versioning (Revisions/Snapshot/Lock) & Excel/PDF Export](./phase-04-versioning-and-export-engine.md) | Completed |
| 5 | [End-to-End Verification (NITORI NTR 001 Golden Dataset) & QA](./phase-05-e2e-verification.md) | Completed |

## Dependencies

- File dữ liệu gốc & Template: `c:\dev\cscc\docs\Form CS Industry.xlsx`
- Đặc tả hệ thống: `c:\dev\cscc\docs\coating_system_specification.md`
- Ảnh chụp màn hình chuẩn đối chiếu: `c:\dev\cscc\pic\*.png`

## Success Criteria

- [x] Import thành công toàn bộ 5 sheet Master Data từ `docs/Form CS Industry.xlsx` vào PostgreSQL / DataStore.
- [x] Nhập bộ dữ liệu mẫu `NITORI-HO CHI MINH` (`NTR 001` - 10 bước sơn, `CA = 100-120`), bảng CC tự động tính ra chính xác `Mixed Price = 379,333`, `CA + Loss = 314 / 183`, `Coverage = 3.2 / 5.5`, `Coating Cost = 119,219 / 69,544` và tổng cộng đúng **`894,143 VND/m²`**.
- [x] Tab BOM Summary gom nhóm đúng vật tư trùng nhau qua nhiều bước, nhân diện tích $\text{m}^2$ ra đúng số Kg/Lít và số thùng (Packing).
- [x] Role `Technical` không nhận được bất kỳ dữ liệu giá/chi phí nào từ API response.
- [x] Tính năng tạo Revision mới (`Rev 01`), khóa Revision (`Locked`) và xuất file `.xlsx` (kèm công thức) / `.pdf` chuẩn A4 hoạt động chính xác.

<!-- slug: coating-schedule-cost-system -->