# Verification plan

## Automated commands

```sh
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Vitest covers progress exclusions, overdue date rules, initials, the permanent credit and accessible dialog semantics. Playwright covers auth navigation, mobile overflow and short password validation on desktop and mobile Chromium. Browser tests do not claim to validate email delivery.

`supabase/tests/isolation.sql` covers cross-team reads, email-bound invitation rejection/acceptance, role escalation through direct writes and RPCs, unauthorized task creation, member status updates, rejection of self approval/detail changes, leader approval, audit creation, founding leader protection and foreign-team relationships. All fixtures roll back.

`supabase/tests/member_limit.sql` checks six team members plus one supervisor, rejecting a seventh team member or second supervisor, quota-aware invitations, role-change bypass rejection, reusable rejected links, replacements, and independent workspace capacity. All fixtures roll back. Browser tests also verify the full-workspace message, disabled invite button, and separately available role choices at desktop and mobile sizes.

## Manual acceptance still required

- Register two real email accounts, receive verification emails, sign in, reset password via delivered email, and sign out.
- Create two workspaces, rename one, switch between them, and reload to confirm persisted state.
- Invite a member and supervisor, check expiry/replay, revoke invitation and remove member.
- Create/edit/assign/archive/filter tasks, request review, approve as leader, check phase progress.
- Upload a logo, test oversized/invalid types, and verify reads fail outside the workspace.
- Keyboard-only dialog navigation; screen reader; tablet/mobile layout; dark theme contrast.

See `VALIDATION.md` for executed results, separated from planned checks. A passing static build is not proof of end-to-end email or production readiness.

## MVP 2 verification

- `src/collaboration/model.test.ts`: IANA/UTC conversion, DST gap rejection, file size/type/extension boundaries and safe meeting links.
- `supabase/tests/mvp2.sql`: rolled-back cloud integration for defaults, direct-DML denial, message persistence/edit ownership/unread state, private files and assigned readers, version preservation, meeting minutes/actions, idempotent task conversion, academic/internal separation, immutable decisions, phase approval bypass prevention, original-author self-review after role changes, cross-workspace references and metadata-only audit.
- `scripts/test-mvp2-live.mjs`: actual authenticated clients exercise Realtime backend readiness and INSERT delivery, PostgREST persistence, private Storage byte upload and signed download, version history and reader revocation. It requires disposable confirmed fixtures, sends no email and contains no service key. Admin fixture provisioning/cleanup is performed separately, and objects are removed through Storage API before deleting test workspaces/users.
- `tests/mvp2.spec.ts`: desktop/mobile leader/member/supervisor UI with isolated contract fixtures. Covers upload/version/review request, meeting timezone/minutes/actions, channel/message editing/replies/deletion, academic feedback, announcement permissions and mobile overflow. WebSocket traffic is intercepted in these UI fixtures; real Realtime is verified by the separate live integration script.
- Existing auth/workspace/capacity regression tests remain required. UI fixture tests do not prove backend authorization; SQL and live tests provide that evidence.

Record final actual results in `MVP2_COMPLETION_REPORT.md`. Human screen-reader/Safari acceptance, SMTP inbox delivery and long-running operational/load tests remain manual checks.
