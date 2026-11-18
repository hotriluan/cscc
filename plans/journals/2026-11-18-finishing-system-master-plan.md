---
title: "Plan Finishing System Master & Strict Dropdown Selection on Coating Schedule"
date: 2026-11-18
summary: "Created 4-phase implementation plan for FinishingSystemMaster (systemName + sortOrder), automatic migration backfill from existing ProjectRevision records, Master Data management sub-tab, and strict SearchableCombobox dropdown selection in CoatingScheduleEditor and ProjectExplorerView."
---

## What happened
- Completed `/ak-brainstorm` and `/ak-plan` for replacing the manual `Finishing System / Hệ sơn` textbox on Coating Schedule (CS) with a Master-backed dropdown.
- Audited `ApplicationStepMaster` across `packages/shared`, `apps/backend`, and `apps/frontend` to align the new `FinishingSystemMaster` implementation with existing codebase conventions.

## Decision
- **Schema & Fields:** Mirror `ApplicationStepMaster` with `FinishingSystemMaster { id, systemName @unique, sortOrder }`, keeping `ProjectRevision.finishingSystem` as a snapshot string for 100% compatibility with Coating Cost, Print A4, Excel Import/Export, and Reports & Analytics.
- **Migration & Legacy Data:** Automatically create `FinishingSystemMaster` on backend initialization (`dataStore.init()`) and scan all existing `ProjectRevision.finishingSystem` values to seed/backfill the Master table automatically.
- **Strict Dropdown Selection:** Replace the manual textbox in `CoatingScheduleEditor.tsx` (and the Create New Project modal in `ProjectExplorerView.tsx`) with `SearchableCombobox` without `onCreateNew`, enforcing selection strictly from the Master list while managing additions/edits in the new `FINISHING_SYSTEMS` sub-tab of `MasterDataManager.tsx`.

## Next steps
- Execute `/ak-cook plans/261118-1023-finishing-system-master/plan.md`.
