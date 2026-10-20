# Implementation and release gate

## MVP 1 delivered scope

React/Vite foundation, shared branding/footer, Supabase authentication flows, atomic workspace creation with seven editable default phases, team switcher, email-bound invitations, roles/removal, phase editing, task CRUD/archive/filter/status workflow, board/list views, database-derived dashboard, profile/settings/theme, private logo upload, audit triggers, RLS and composite foreign keys.

## Review gate

1. Inspect this implementation and security/validation record.
2. Configure and verify email confirmation, production redirect URLs and SMTP in Supabase Auth.
3. Run a real two-account user acceptance test: create workspace, invite member, update assigned task, request leader completion, verify isolation with a second workspace.
4. Confirm mobile behavior and academic phase defaults with the intended research team.
5. Review backup, retention, account deletion and operational ownership before broad usage.

The owner authorized MVP 2 after MVP 1 deployment. MVP 2 extends the existing application and membership model.

## Follow-up scope

MVP 2 implements private documents/versioning first, followed by persisted Realtime discussions, meetings/action conversion, academic reviews, announcements, activity history and dashboard integration. `MVP2_DESIGN.md` records the design; `MVP2_COMPLETION_REPORT.md` records actual results.

MVP 3 implements dataset registry, paper tracking, in-app notifications, analytics, PDF reports and manual GitHub links. Task comments/checklists/dependencies and multiple assignees remain later scope. GitHub OAuth/webhooks remain a separate authenticated integration.

## MVP 3 release
Incremental extension: inspect existing entities → papers/section review → dataset ACL/governance → personal notifications → analytics → PDFs → manual GitHub links → timeline/integration → SQL/unit/browser/security checks → Cloudflare release. See `MVP3_DESIGN.md` and `MVP3_COMPLETION_REPORT.md` for actual results.

Follow-up scope remains task checklists/dependencies/multiple assignees, scheduled/outbound notifications, rich mention authoring, authenticated GitHub synchronization, a collaborative word processor, operational retention/orphan maintenance, full accessibility/load testing and institutional acceptance. Do not infer contribution or research quality from activity counts.
