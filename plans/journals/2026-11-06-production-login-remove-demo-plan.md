---
title: "Plan Production Login Gate & Remove Sidebar Demo Role Switcher"
date: 2026-11-06
summary: "Created 3-phase implementation plan to enforce full-screen JWT login, add self-service password change, and remove the demo Role Switcher from the sidebar."
---

## What happened
- Surveyed `App.tsx`, `UserAuthModal.tsx`, `client.ts`, and `auth-rbac.middleware.ts`.
- Identified that the application currently defaults to `PROJECT_LEADER` in demo mode when unauthenticated, exposes a `Role Switcher` dropdown on the sidebar, and allows `x-user-role` to override JWT roles in `extractRoleMiddleware`.

## Decision
- Adopted Approach 1: Full-screen `<LoginPage />` gate when unauthenticated, strict JWT role priority in `extractRoleMiddleware` whenever a Bearer token is present, removal of the sidebar `Role Switcher` and 1-click demo login cards, and addition of `POST /api/auth/change-password` + profile modal.

## Next steps
- Execute `/ak-cook` on `plans/261106-1305-production-login-remove-demo/plan.md`.

