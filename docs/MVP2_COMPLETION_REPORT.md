# ResearchFlow MVP 2 completion report

## Implemented scope

MVP 2 extends the existing React/Vite application without replacing MVP 1 or the legacy Collabix tables. Workspace branding, individual Auth accounts, six team places plus one supervisor, task rules, phases, settings, invitation management, mobile navigation and the Micro Biz Tek footer remain.

- Documents: ten categories, private upload/download, MIME/extension/size validation, numbered immutable versions, restricted readers, search/folder/status/sort filters, phase/task links, comments, review history, text/image previews and browser PDF viewing. Leaders archive rather than destroy document evidence.
- Discussions: seven defaults, leader channel management/archive, persisted messages/replies, own edits, author/leader soft deletion, private attachments, persisted unread cursors, earlier-message loading, Realtime and recovery polling.
- Meetings: five types, organizer/participants, agenda/location, IANA/UTC conversion, calendar/list/history, edit/cancel, authored minutes/decisions/comments, assigned dated actions and idempotent conversion into existing tasks.
- Supervisor portal: assigned projects, pending document/milestone queues, upcoming meetings, activity link, immutable written decisions, revision/resubmission history, separate academic/internal status, self-review protection and guarded phase approval.
- Announcements/activity: leader publishing/edit/archive, pins/priorities/attachments/read states, workspace dashboard summaries and metadata-only filtered activity.

## Files and database

New modules: `src/collaboration/{CollaborationView,Documents,Discussions,Meetings,Reviews,Announcements,Shared}.tsx`, `model.ts`, `model.test.ts`, `collaboration.css`. Existing `App.tsx`, `WorkspaceView.tsx`, shared dialog UI, `.gitignore` and `public/robots.txt` updated. New tests: `tests/mvp2.spec.ts`, `supabase/tests/mvp2.sql`, `scripts/test-mvp2-live.mjs`. Required README/SRS/architecture/schema/security/plan/user-guide/test/deployment documentation updated; design recorded in `MVP2_DESIGN.md`.

Applied additive migrations:

- `20261020165030_researchflow_mvp2.sql`: 17 normalized tables, unread view, private bucket, RLS, guarded RPC, default seeding, audit and Realtime.
- `20261020165420_mvp2_storage_path_policy.sql`: corrects the qualified Storage object path comparison, caught by integration tests.
- `20261020171323_mvp2_review_ownership.sql`: rejects academic review by the original document creator as well as version author/requester.

`supabase/schema.sql` includes the complete ordered snapshot. New browser roles have SELECT only; mutations use the checked security-invoker RPC and private implementation. Composite foreign keys and current membership protect cross-workspace access. Existing audit records remain immutable and do not log research contents.

## Verification record

- TypeScript (`npm run typecheck`) and ESLint (`npm run lint`) passed. Production build (`npm run build`) passed: 2,648 modules transformed; collaboration route bundle 48.44 kB (13.48 kB gzip).
- Unit tests: **18 passed** in five files with `npm run test -- --maxWorkers=1`, including five new file/timezone/link tests. The initial sandbox run was blocked before executing tests by temporary-file rename permissions. A later parallel run failed to start worker processes under load; the final serial run passed in 17.60 seconds.
- Cloud SQL integration: passed with all synthetic fixtures rolled back. Includes access isolation, restricted Storage, persisted messages/unread state, versions, meeting actions/task conversion, independent academic/internal decisions, immutable review history, milestone authorization, original-author protection after role reassignment and metadata-only audit.
- MVP 1 SQL regressions: `isolation.sql` and `member_limit.sql` both passed again after the MVP 2 migrations. The six-team-plus-one-supervisor limit remains enforced.
- Live authenticated integration: passed actual Realtime INSERT delivery, persisted message reads, private file byte upload, signed download, immutable version history, assigned reader access and revocation. Disposable accounts/workspaces and file bytes were removed afterward. No email was sent.
- The first Realtime test exposed a backend-readiness race; waiting for the documented `system` replication-ready event fixed it. Client UI now distinguishes socket join from backend readiness and refreshes persisted state after reconnect.
- Browser tests: **22 passed** using `npm run test:e2e -- --workers=1 --timeout=120000` (3.6 minutes), covering desktop/mobile auth, all new collaboration roles, task/workspace regressions, invitation deletion/research title and separate team/supervisor capacity. Earlier failures were traced to fixture null IDs, exact selectors on prefilled controls and hidden toast assertions; the corrected suite passed. Representative document, discussion, meeting and review screens were captured; desktop and mobile document/discussion/meeting captures were visually reviewed, with no horizontal overflow.
- Production deployment **ready**: Netlify `6ad7a6fa48b867d42d0768b4`, code commit `b39c93c8f0f6a26ae106c71c64d163f1a4f41c5c`, published 20 October 2026 at 17:38 UTC. The live collaboration bundle matches the locally verified build (`CollaborationView-DQ4z2sqx.js`). Homepage and all six new deep routes returned HTTP 200; CSP and the Google verification tag were preserved.
- Published-site browser checks: **2 passed** (desktop/mobile leader workflow, 41.7 seconds) using `PLAYWRIGHT_BASE_URL=https://teamprojectcolla.netlify.app` and isolated contract fixtures. This verifies production bundle/routing/CSP behavior; actual backend persistence, Storage and Realtime were independently verified by the cloud/live integration tests above.

## Release status

MVP 2 is deployed at [ResearchFlow](https://teamprojectcolla.netlify.app/). Refresh an already-open app tab to load the new navigation. No additional credentials or configuration steps are pending for these modules on the connected project. No core MVP 2 implementation task remains; operational/manual acceptance items below remain explicit limits of verification. Disposable live-test accounts and workspaces were verified removed, and uploaded test file bytes were deleted through Storage API.
- Security advisor: no new MVP 2 warnings. Pre-existing legacy trigger search-path/API execution findings and disabled Auth leaked-password protection remain; the legacy trigger was left unchanged per owner instruction.

## Limitations and operational follow-up

No external credentials are required for MVP 2. The connected project has private Storage and working Realtime. Existing Supabase URL/publishable-key Netlify variables are reused. Brevo SMTP remains separate; the previous reset API test succeeded, while recipient inbox confirmation and human signup acceptance remain owner checks.

Signed URLs already issued can remain usable for up to 60 seconds after revocation; downloaded copies cannot be recalled. File checks validate declared MIME/extension/size, not malware or research ethics. DOCX/XLSX require download; text previews are limited to 1 MB. No scheduled orphan-file cleanup, physical document purge, notification delivery or antivirus worker is installed. Failed first uploads can leave a draft; retry by uploading a new version. Activity displays the latest 200 matching events; metadata queries paginate and chat can load earlier history. Calendar uses the browser timezone while meeting cards show the selected meeting timezone. Ambiguous DST times select a deterministic occurrence and should be checked when scheduling in repeated local hours.

Channels are workspace-wide, with no additional private-channel ACL. Confidentiality is document-level. Formal screen-reader/Safari acceptance, load testing, backup/restore exercises, retention policy and independent penetration testing remain operational follow-up. Dataset registry, paper authoring, PDF reports, GitHub sync and task checklist/multiple-assignee workflows are outside this MVP 2 brief.
