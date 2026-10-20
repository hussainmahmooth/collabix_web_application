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

Supabase Realtime and Edge Functions are reserved for subsequent milestones. No live GitHub synchronization or fake notification service is presented.
