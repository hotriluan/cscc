---
title: "Plan Auto-Generate Project Code ([Short Name] [0001]) & Switch Customer Display to Customer Name"
date: 2026-11-17
summary: "Created 4-phase implementation plan for auto-generating per-customer 4-digit Project Codes ([Short Name] [0001]), auto-regenerating codes when switching customers on DRAFT revisions, enforcing 2-6 char Short Name validation, and switching all customer display surfaces (CS, CC, Print A4, Excel, Sidebar, Reports) to Customer Name."
---

## What happened
- Completed `/ak-brainstorm` and `/ak-plan` across `packages/shared`, `apps/backend`, and `apps/frontend`.
- Audited all usages of `customer.shortName`, `customer.customerName`, and `projectCode` across database stores, Excel importers/exporters, A4 print layouts, reports, and UI editors.

## Decision
- Use **Max-Sequence Scan in Transaction** (`^${shortName}\s+(\d+)$` $\rightarrow$ `maxSeq + 1` padded to 4 digits `0001`) so project numbers auto-increment cleanly per customer without schema counter drift or deletion collisions.
- Enforce **2 to 6 character uppercase `shortName`** in Customer Master, and block project creation / customer switching with a clear prompt if a legacy customer record has not yet had its `shortName` shortened to 2–6 characters.
- Automatically regenerate `projectCode` for the newly selected customer when switching customers on a `DRAFT` revision in the Coating Schedule (CS) tab.
- Switch all customer name display fields across CS, CC, Print A4/PDF, Excel export, Sidebar, Project Explorer, and Reports to `customer.customerName`.

## Next steps
- Execute `/ak-cook plans/261117-1227-auto-project-code-and-customer-name/plan.md`.
