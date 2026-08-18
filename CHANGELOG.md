# Changelog

All notable changes to the Collabix project will be documented in this file.

## [1.0.0] - 2026-08-17
### Added
- **Project Setup**: Initialized Next.js 15+ App Router, TypeScript, and Tailwind CSS v4.
- **Brand Style**: Defined color palette variables (`#2563EB` blue, `#FACC15` yellow) inside `globals.css` with dark mode variables support.
- **Database Schema**: Wrote PostgreSQL migrations for 20 tables (projects, tasks, comments, DMs) and mock seeds.
- **Session Auth**: Configured `@supabase/ssr` cookies management, registration, login, and middleware guards.
- **Dashboard Grid**: Implemented total metrics calculation cards, active projects lists, my tasks list, and activity log slots.
- **Task Boards**: Created interactive Kanban board and list layouts with status/priority toggle dropdown selectors.
- **Team Workspace**: Developed workloads meters, role selectors, messaging routing, and member invite modals.
- **Realtime Chat**: Integrated socket channel listeners syncing messenger posts instantly on database triggers.
- **Deadlines Calendar**: Programmed dynamic year/month calendar matrix rendering task deadline pills.
- **Notifications dropdown**: Set up toast updates and inbox read-state markers.
- **Visual Analytics**: Embedded Recharts workload histograms and project completion rate summaries.
- **Collabix AI**: Integrated server-side Gemini SDK feeding workspace context into prompt strings.
- **Security Hardening**: Enforced RLS subquery policies on all Postgres tables.
