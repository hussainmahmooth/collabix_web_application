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
