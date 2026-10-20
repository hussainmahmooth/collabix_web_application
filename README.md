# ResearchFlow

Research collaboration and project management. Developed by Micro Biz Tek.

This repository now contains the ResearchFlow MVP 1 React/TypeScript/Vite application. The previous Collabix Next.js implementation is preserved in `legacy/` and excluded from the active build. Existing Supabase data is preserved; new tables use `rf_` prefixes.

## Run locally

Use Node 22+. Run `npm ci`, copy `.env.example` to `.env.local`, set your Supabase URL and publishable key, then `npm run dev`.

## Implemented

- Supabase email/password auth UI, verification handoff, recovery and persistent sessions.
- Independent workspaces, team name/research settings, private logo upload and workspace switching.
- Seven editable research phases, owner/date/objective settings.
- Tasks with assignment, priorities, dates, effort, board/list, filters, status changes and reversible archive.
- Secure email-bound invitation links, three roles, guarded member management.
- Six team members (including leaders) plus one supervisor per workspace: seven people total, enforced by the database.
- Database-derived dashboard, phase progress, task completion contribution summary and recent activity.
- Responsive navigation, light/dark theme, profile editing, validation/errors/empty states and permanent developer credit.
- RLS, immutable IDs, cross-workspace constraints, server-enforced task permissions and audit records.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, `npm audit`. Execute `supabase/tests/isolation.sql` in Supabase as postgres; fixtures roll back. See `docs/VALIDATION.md` for checks actually run.

## Deployment and review gate

The existing Netlify site is https://teamprojectcolla.netlify.app, linked to this repository's `master` branch. Build settings are in `netlify.toml`. See `docs/DEPLOYMENT.md` for Auth redirect/SMTP configuration and setup details.

MVP 1 stops here for owner review. Supervisor deliverable approvals, realtime discussions, documents/versioning, meetings, dataset registry, paper management, notifications, PDF reports, task calendar/checklists/dependencies and GitHub evidence integration are **not implemented**. Invitation emails are not automatically sent; leaders copy and share secure links. No mock CRUD or simulated GitHub synchronization is present.

## Documentation

Start with `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `docs/SECURITY.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/API.md`, `docs/TEST_PLAN.md`, `docs/USER_GUIDE.md` and `docs/DEPLOYMENT.md`.

This release has not been certified production ready; complete real-email two-account acceptance and operational checks before broad use.
