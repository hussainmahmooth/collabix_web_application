# ResearchFlow

Research collaboration and project management. Developed by Micro Biz Tek.

This repository contains ResearchFlow MVP 1 and MVP 2, built with React/TypeScript/Vite. The previous Collabix Next.js implementation is preserved in `legacy/` and excluded from the active build. Existing Supabase data is preserved; ResearchFlow tables use `rf_` prefixes.

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
- Workspace discussions, seven default channels, persisted replies, edits, soft deletion, secure attachments, read cursors and Supabase Realtime.
- Private research documents, ten folders, immutable file versions, comments, restricted readers, signed downloads/previews, phase/task links and review history.
- Meetings with IANA timezones, calendar/list/history, participants, authored minutes/decisions/comments and actions that leaders convert into existing tasks.
- Dedicated academic supervisor portal, document/milestone submissions, written decisions and separate internal leader review.
- Leader announcements with pins, attachments, archive and read state; dashboard summaries and filterable metadata-only activity.

## Verify

`npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e`, `npm audit`. Execute `supabase/tests/isolation.sql` in Supabase as postgres; fixtures roll back. See `docs/VALIDATION.md` for checks actually run.

## Deployment and review gate

The existing Netlify site is https://teamprojectcolla.netlify.app, linked to this repository's `master` branch. Build settings are in `netlify.toml`. See `docs/DEPLOYMENT.md` for Auth redirect/SMTP configuration and setup details.

Dataset registry, paper authoring management, notification delivery, PDF reports, task checklists/dependencies/multiple assignees and GitHub evidence integration remain future scope. Invitation emails are not automatically sent; leaders copy and share secure links. The application uses real Supabase data. See `docs/MVP2_COMPLETION_REPORT.md` for verification results and limitations.

## Documentation

Start with `docs/PRD.md`, `docs/SRS.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`, `docs/SECURITY.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/API.md`, `docs/TEST_PLAN.md`, `docs/USER_GUIDE.md` and `docs/DEPLOYMENT.md`.

This release has not been certified production ready; complete real-email two-account acceptance and operational checks before broad use.
