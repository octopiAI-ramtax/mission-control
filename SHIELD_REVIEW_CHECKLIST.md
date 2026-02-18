# SHIELD 🛡️ Review Checklist — Mission Control MVP

## Security / Access
- [ ] No public access: all app routes require auth.
- [ ] Supabase Auth email/password enabled.
- [ ] Secrets not exposed client-side (service role key never shipped).

## Roles / Permissions (Non‑Negotiable)
- [ ] Subagents (CORE/VECTOR/SHIELD/KERNEL) are **entities**, not authenticated users.
- [ ] Human RBAC applies only to authenticated humans.
- [ ] ADMIN (Jose): full access; can approve + schedule; can manage users/roles/settings.
- [ ] No non-admin user can move to APPROVED/SCHEDULED.
- [ ] Enforcement is server-side (Supabase RLS + server actions/API checks), not only UI.

## Workflow Integrity
- [ ] Submit for Review moves mission to REVIEW and writes an activity event.
- [ ] Approve action is permission-gated and writes an activity event.
- [ ] Scheduling is metadata only (no background automation in MVP).

## Language Governance
- [ ] Internal fields are English-only by design (field naming + UI labels).
- [ ] External deliverables default Spanish unless explicitly set otherwise.

## Compliance / Risk Surfaces
- [ ] No UI encourages guarantee-based claims/refund promises.
- [ ] Audit trail supports who/what/when for changes.

## Data Model / Export
- [ ] Typed deliverables items exist with required fields.
- [ ] JSON export per mission includes mission + deliverables + comments + attachments + activity.
- [ ] CSV export for content calendar matches spec.

## UX Sanity
- [ ] Kanban board shows status columns, ownership (assigned_to), due/scheduled.
- [ ] Mission Detail shows structured fields + deliverables list + comments + attachments + activity.

## Release Gate
- [ ] SHIELD signs off before merge to main / production deploy.
