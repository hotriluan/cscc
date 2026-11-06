---
title: "Enforce Salesman Ownership on Master Data Quotation Upload & Mutations for SALES Role"
date: 2026-11-06
summary: "Restricted SALES role in Master Data to only upload, create, update, or delete quotations belonging to customers assigned to their linked salesmanName."
---

## What happened
- Added `getQuotationById` and `findUnauthorizedCustomerCodesForSalesman` to `PostgresDataStore` (`apps/backend/src/store/data-store.ts`).
- Enforced strict salesman ownership validation on `POST /api/master/quotations/import`, `POST /api/master/quotations`, `PUT /api/master/quotations/:id`, and `DELETE /api/master/quotations/:id` (`apps/backend/src/app.ts`) when `req.userRole === 'SALES'`.
- Updated `MasterDataManager` (`apps/frontend/src/components/master/MasterDataManager.tsx`) to display red error alerts on failed uploads and show a clear Salesman RBAC notice on the Quotation upload banner for `SALES` users.
- Added automated test suite #7 in `apps/backend/test/user-salesman-rbac.test.ts` covering mixed/unauthorized quotation Excel uploads, valid salesman-scoped uploads, single-row quotation creation, and unrestricted `ADMIN` uploads.

## Decision
- Adopted strict whole-file rejection (`403 FORBIDDEN_SALESMAN_QUOTATION`) when a `SALES` account uploads an Excel file containing any customer code that does not exist or is not assigned to their `salesmanName`, returning the exact list of violating customer codes (`invalidCustomerCodes`).

## Next steps
- Deploy updated backend and frontend bundles to production when ready.

