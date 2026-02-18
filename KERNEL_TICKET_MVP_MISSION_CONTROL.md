# KERNEL ⚙️ Engineering Ticket: Mission Control MVP (API + Dashboard)

## Problem
We need a private (no public access) Mission Control system that acts as the RamTax multi-agent command plane with a lightweight dashboard UI. It must support disciplined workflow, auditability, and role-based permissions.

## Business Justification
- Prevent operational chaos by enforcing structured missions, assignments, and approvals.
- Provide an auditable trail of agent runs (inputs/outputs/logs) tied to missions.
- Enable scalable, compliant execution with clear ownership and review gates.

## Scope (MVP)
### UI
1) Missions Kanban
- CRUD missions/cards
- Column/status transitions
- Assign mission to engine (CORE/VECTOR/…)

2) Mission Detail
- Structured fields: audience, objective, CTA, deliverables, language, due date
- Comments/thread for handoffs
- Attachments/links
- Activity timeline (who/what/when)
- Actions:
  - Submit for Review
  - Approve (permissions-gated)

3) Runs + Logs viewer
- Each agent execution is a Run tied to a Mission
- Run detail shows input → output → status (pass/revise)
- Filter by engine/date/mission/status

### Data/Permissions (non-negotiable)
- Auth: Supabase email/password
- Roles:
  - ADMIN (JR): approve/schedule
  - CORE: move cards
  - ENGINE: edit only assigned cards
  - SHIELD: review/flag only
- Language governance:
  - Internal fields always English
  - External deliverables default Spanish

### Export
- JSON export per mission
- CSV export for content calendar

## Identity Model + Permission Model (MVP) — REQUIRED

### Subagents (non-human identities)
- CORE 🧠 / VECTOR 🎯 / SHIELD 🛡️ / KERNEL ⚙️ are **subagent entities**.
- They are used as:
  - assignment targets (e.g., mission.owner_subagent)
  - audit actors labels (e.g., run.executor_subagent)
  - routing later (automation)
- **They do not log in** during MVP.

### Human users (Supabase Auth)
- MVP RBAC applies to authenticated humans.
- **MVP ships with a single human role:**
  - **ADMIN (Jose):** full access; can approve/schedule/override; can manage users/roles/settings.
- Any future non-admin roles (e.g., OPERATOR/STAFF) are **out of MVP**; code should be deny-by-default for unknown roles.

### Workflow permission rules (enforced server-side)
- Only **ADMIN** can: APPROVE, SCHEDULE, manage users/roles/settings.
- Only **ADMIN** can move to **APPROVED** or **SCHEDULED**.
- **ADMIN** can move statuses globally.
- (Optional) If OPERATOR is implemented: define allowed transitions explicitly.

### Status movement
- Use a single status **REVIEW** for “needs review”.

## Acceptance Criteria
- Users must be authenticated to access any app routes.
- RBAC enforced server-side (Supabase RLS + server actions/API checks). Verified with at least one scenario per role.
- Missions: CRUD + Kanban + assignment + scheduling metadata.
- Mission Detail: structured fields + typed deliverables + comments + attachments + activity.
- Submit-for-review and Approve actions update status and write an activity event; Approve is ADMIN-only.
- Runs list + Run detail pages render and read logs.
- Exports return correct formats and respect auth.
- Vercel preview deployments work on PRs.

## Out of Scope (MVP)
- Agent lifecycle start/stop/restart controls
- GitHub OAuth
- Drag/drop UI polish (can be Phase 2)

## Notes / Open Questions (Resolved)
- **Subagent roster (seed data, MVP):** CORE 🧠, VECTOR 🎯, SHIELD 🛡️, KERNEL ⚙️. (RECON 🛰️ / DEPLOY 🚀 later.)
- **Scheduling (MVP):** workflow metadata only.
  - status = SCHEDULED
  - fields: scheduled_for (timestamptz), timezone (default America/Chicago), notes (optional)
  - no queues/cron/background jobs
- **Deliverables (MVP):** typed deliverables items (not freeform strings):
  - type (blog, newsletter, social_post, internal_doc, engineering_task, …)
  - channel (optional for MVP)
  - format (optional for MVP)
  - language (default Spanish for external; internal always English)
  - due_date
  - status (pending/drafted/in_review/approved)
  - assigned_to (CORE/VECTOR/SHIELD/KERNEL)
  - link (optional)
  - notes (optional)
