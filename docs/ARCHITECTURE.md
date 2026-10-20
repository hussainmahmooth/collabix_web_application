# Architecture

The deployed app is a React 19 + TypeScript Vite SPA. React Router manages URLs. TanStack Query owns server cache and invalidation; workspace and user IDs are part of every workspace cache key. React Hook Form + Zod validate auth and task forms. Native validated inputs support settings and phases. Tailwind CSS v4 and an accessible shadcn-style Radix Dialog/CVA button composition provide UI foundations. Lucide supplies icons; Recharts renders actual audit activity.

The browser talks directly to Supabase Auth, PostgreSQL/PostgREST and private Storage using the public publishable key and the signed-in user's JWT. PostgreSQL RLS, composite constraints and guarded functions enforce permissions independently of UI checks. No client-side service-role key or privileged application backend exists.

Netlify serves `dist/`, HTTPS, static response security headers and an SPA rewrite. GitHub `master` is the existing Netlify production branch. `netlify.toml` overrides the old Next build configuration. Old Collabix sources remain in `legacy/`, excluded from compilation and deployment.

## Code map

- `src/App.tsx`: session lifecycle, workspace query/cache, responsive shell and workspace creation.
- `src/Auth.tsx`: sign-in, registration, email recovery and new password submission.
- `src/WorkspaceView.tsx`: dashboard, phases, task board/list, members, invitations and settings.
- `src/lib/`: Supabase client, application types and progress rules.
- `src/components/ui.tsx`: accessible shared components and permanent footer.
- `supabase/migrations/`: checked-in cloud migration snapshot.
- `supabase/tests/isolation.sql`: transactional permission tests.

## MVP 2 collaboration

`src/collaboration/` contains separate Documents, Discussions, Meetings, Reviews and Announcements screens, shared typed data/file/timezone helpers, and the collaboration shell/activity/dashboard integration. Authenticated routes reuse the existing workspace selector, session, members, task/phase data and mutation feedback. Modal errors are announced inside the active Radix dialog.

TanStack Query caches metadata by workspace AND user, paginates metadata requests, polls for reconnect recovery and invalidates after mutations. Messages load the latest 100 with explicit earlier-history loading. Realtime Postgres Changes subscriptions use workspace filters and RLS. The connection indicator waits for backend `system` replication readiness, not only a WebSocket join. Events invalidate persisted queries; they are not the sole copy of any message.

The public security-invoker RPC `rf_collaborate(action,p)` delegates to `rf_private.collaborate`. The private implementation checks current membership, role, ownership and related resources, then performs atomic workflows. Browser roles have SELECT through RLS on the new tables, with no direct DML grants. A private bucket stores immutable random file paths; database metadata controls signed file reads. Uploading bytes and registering metadata are separate operations; failed registrations attempt orphan cleanup, and a document with an interrupted first upload remains an editable draft.

Realtime is enabled only on `rf_messages`, `rf_channels`, and `rf_files` for this implementation. No Edge Function or external worker is required. No live GitHub synchronization or fake notification service is presented.

The backend-readiness handling follows [Supabase Postgres Changes troubleshooting](https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting). File policies follow [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
