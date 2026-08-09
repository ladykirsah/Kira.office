---
type: plan
title: Staff & Mechanic section — locked owner decisions (2026-07-27), partially overtaken by shipped work
description: Per-staff logins + RBAC + payroll + mechanic-approves-returns; verify current state before building
tags: [staff, mechanic, rbac, payroll, plan, returns]
timestamp: 2026-08-09
status: parked
sources: [kira-staff-mechanic-section-plan.md]
---

# Staff & Mechanic section plan

## Status caveat (read first)

This memory records a **plan-only** session (owner ran ask→plan→take-note, explicitly NO code) from 2026-07-27. It **predates the staff-login work that has since shipped** — per-staff password/PIN login, per-role lockout (#129), and Access-identity owner sign-in (#128) are now live ([staff-login-and-lockout](staff-login-and-lockout.md), [owner-access-sign-in](owner-access-sign-in.md)). **Verify what has shipped before treating "nothing built" as current.** Notably, the plan's "do NOT build an in-app password system" was overtaken by events — a password/PIN system exists.

## Locked owner decisions (2026-07-27)

- **Real per-staff logins with role-gated access**: Owner = everything; Admin/staff = no bank/salary; Mechanic = only assigned returns to approve, no customer data — matching the 3-tier policy model ([roles-model](roles-model.md)).
- **Store bank account + salary AND a payroll module** (pay runs + payslips).
- **Plan the staff section AND the returns-approval wiring together**, including reviving the parked returns flow (returns need mechanic sign-off — see [commerce](../commerce/index.md)).

## Proposed architecture (as planned then)

- Identity: Cloudflare Access email → staff record → role.
- (Superseded, see caveat) Do NOT build an in-app password system — rationale at the time: safety rules forbid handling passwords, and it would double-login behind Access.
- Data model: `staff` table (`access_email` UNIQUE, role, name, phone, position, start_date, status, national_id?, photo_key?, bank_name, bank_account_no, bank_account_name, salary_satang) + `payroll_runs` + `payslips`; returns gain `assigned_mechanic_id` + approval outcome (100% / partial X% + reason / 0% rejected).
- **Sensitive fields** (bank account, salary, national ID) = Owner-only + masked (show last 4), enforced in **BOTH API and UI**.

## Phasing (each its own deploy; all R0/R1 — auth + money)

A. Auth/RBAC foundation
B. Staff CRUD + HR + payroll
C. Revive returns + mechanic approval

Any build must reconcile with (or deliberately replace) the existing role machinery: the live `viewerRole` email lists AND the unenforced `resolveActor` role set (owner/manager/stock_operator/finance_viewer) — details and the rejected RBAC-enforcement finding in [roles-model](roles-model.md).

## References

- Branch mentioned in source memory: `claude/kira-office-preview-ux-a54ab2`
- [roles-model](roles-model.md), [staff-login-and-lockout](staff-login-and-lockout.md)
