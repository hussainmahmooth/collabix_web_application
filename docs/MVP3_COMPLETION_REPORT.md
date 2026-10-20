# ResearchFlow MVP 3 completion report

Date: 21 October 2026 (Asia/Colombo). Developer attribution: Developed by Micro Biz Tek.

## Release status

Implementation and local/cloud-backend verification are complete. Cloudflare production publication/verification is the final release step; the publication record will be added below after the deployed bundle is checked. Existing accounts, workspaces, six-team-member plus one-supervisor capacity and MVP 1/2 modules are retained. No new paid service, GitHub token or email credential is required.

## Features completed

- Papers: multiple papers per workspace; metadata, ordered member authors, corresponding author, assigned supervisor, venue/submission/publication dates and statuses; default 14-section configurable outline, assignments, deadlines, word counts, task/document-version links, written feedback and immutable independent supervisor decisions. Edits reset approval; completion uses approved sections / all sections. User-supplied references support CSV import and CSV/BibTeX export.
- Datasets: private governance registry, metadata-only external entries, classification/readers, permission/evidence/scope, provenance/date/record-count/dictionary/quality/phase/retention metadata, immutable numbered files and external versions, evidence before raw approval, private before/after snapshots and audited download-link issuance. Raw bytes require granted permission and active retention/status. Authenticated Edge signing enforces 60 seconds; direct browser signing is denied.
- Notifications: PostgreSQL event generation for tasks, discussions with explicit mentions, papers, datasets, documents/reviews, meetings, announcements and milestones; recipient isolation, preferences, unread header/dropdown/page, personal reads, event deduplication, Realtime and 30-second recovery refresh. Deadline notices reconcile while a client is active.
- Analytics: actual task cohort filters, phase states/task progress, paper approval, pending document/phase reviews, dataset readiness, meeting-action completion, member workload and weekly audit trends. Charts have table alternatives and metrics disclose their scope/denominator. Activity counts are not contribution/quality scores.
- Reports: all eight requested report types, real authorized records, configured team/project/institution/department, optional PNG/JPEG logo, A4 tables, repeated headers, vector task progress, timestamps, page numbers, missing-data labels and fixed footer. Reports generate locally; raw dataset bytes are excluded and initiation is audited.
- GitHub: validated manual repository and issue/PR/commit/branch task links, task-details integration and member/task/phase/status/date filtering. No live synchronization or fabricated statistics.
- Timeline/integration: existing phases/milestones plus submission/publication dates, section-review dates and dataset readiness checkpoints; date/paper/workspace filters, past-date indicators, responsive layout, dashboard paper/dataset summaries and supervisor paper-review queue.

## Partial functionality and known limitations

- BibTeX export is implemented; BibTeX import is not. References are researcher-supplied and not automatically checked against publishers. Paper notes replace a full word processor; there is no collaborative rich-text editor.
- Mention notifications recognize explicit `@{member-UUID}` tokens. A friendly mention picker is not implemented. Notification text is generic, links to authorized module pages and does not expose private research contents. There is no scheduled background deadline job, email, SMS or push delivery.
- Date/member/phase/status task filters use task creation cohorts; other report/chart sections use their documented event/snapshot scope. Paper completion reports show the current outline with dated feedback, not an invented historical snapshot. Dataset readiness is entered by researchers, not independently certified. Phase/milestone states are reused rather than duplicated; unset dates are omitted.
- Signed links already issued remain usable for up to 60 seconds and copies cannot be recalled. External hosts control external URLs. Access events prove authorization/link issuance, not every reuse or completed byte transfer. Dataset Storage denies direct browser reads; failed registration/orphan cleanup requires privileged Storage API maintenance. Retention dates block access but do not schedule deletion.
- Governance/quality fields are bounded metadata with immutable change snapshots, not an automated profiling or legal-approval engine. No antivirus scanning, compliance certification or confidential-data AI processing is provided. Paper notes remain workspace-shared even if a linked draft is restricted.
- pdfmake/fonts are lazy-loaded but large; the production build reports advisory chunk-size warnings. Embedded Roboto is not a universal-script font; additional fonts may be needed for Sinhala/Tamil or other scripts. Unsupported optional logo formats are omitted. Reports are not digitally signed academic records.
- Operational backups, retention/orphan maintenance, full screen-reader/Safari/device/load testing and institutional acceptance remain follow-up work. Legacy Collabix Auth-trigger/leaked-password-protection warnings remain unchanged by owner choice.

## Database migrations and server configuration

Applied cloud versions match checked-in filenames:

1. `20261020184329_researchflow_mvp3.sql`: additive tables, RLS/grants/indexes, workflows, event notifications, private dataset bucket and Realtime publication.
2. `20261020185747_mvp3_workflow_guards.sql`: row-dependent authorization checks, permission evidence before raw-data authorization, dataset metadata validation and independent linked-draft review.
3. `20261020191305_mvp3_server_downloads.sql`: remove browser Storage SELECT/signing; server-only signed download path.
4. `20261020192542_mvp3_dataset_history.sql`: private immutable metadata/permission snapshots.
5. `20261020194026_mvp3_dataset_writer_boundary.sql`: permitted readers remain read-only; only leaders, dataset creators/custodians and assigned researchers may upload/append versions. Guards cover raw and external versions independently of UI.

`supabase/schema.sql` includes these changes. New public tables use the existing `rf_` namespace, workspace-scoped RLS and denied direct browser DML. No existing task, document, review or milestone entity is duplicated. Array membership is checked by guarded workflows and relationships use composite workspace foreign keys.

`rf-dataset-download` is deployed and active. Every data request validates the bearer token with Auth `getUser`, calls the caller-scoped authorization/audit workflow, reads the version through RLS and signs only that DB path using the server-only service credential. Legacy gateway `verify_jwt=false` is intentional for modern JWTs; the handler's authentication is mandatory. CORS permits the production Cloudflare/retained Netlify origins and localhost:5173. Updating through MCP requires explicit `import_map_path: deno.json`.

## Files changed

- `src/research/`: `ResearchView.tsx`, `Papers.tsx`, `Datasets.tsx`, `Notifications.tsx`, `Analytics.tsx`, `Reports.tsx`, `Github.tsx`, `Timeline.tsx`, `PaperReviewQueue.tsx`, `TaskResearchLinks.tsx`, `Forms.tsx`, `model.ts`, `pdfReports.ts`, `model.test.ts`, `research.css`.
- Integration: `src/App.tsx`, `src/WorkspaceView.tsx`, `src/collaboration/Reviews.tsx`, `public/robots.txt`, `.gitignore`, `package.json`, `package-lock.json`.
- Backend: the five migrations above, `supabase/schema.sql`, `supabase/tests/mvp3.sql`, `supabase/functions/rf-dataset-download/index.ts`, `supabase/functions/rf-dataset-download/deno.json`.
- Verification: `tests/mvp3.spec.ts`, `scripts/test-mvp3-live.mjs`. Synthetic credentials/test artifacts are ignored and never committed.
- Documentation: README, PRD, SRS, ARCHITECTURE, DATABASE_SCHEMA, SECURITY, IMPLEMENTATION_PLAN, TEST_PLAN, USER_GUIDE, DEPLOYMENT, MVP3_DESIGN and this report.

## Executed verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run test -- --maxWorkers=1`: 25 tests / 6 files passed. Initial Windows sandbox temporary-file EPERM errors prevented suite loading; approved execution outside that sandbox resolved them.
- `npm run build`: passed, 2,668 modules, with advisory large lazy PDF/font chunks. No build errors.
- `npm audit --omit=dev`: zero vulnerabilities.
- `npm run test:e2e -- --workers=1 --timeout=120000`: 28 tests passed in 4.7 minutes. Covers existing auth/workspace/capacity and MVP 2 regressions plus leader/member/supervisor MVP 3 workflows on desktop/mobile. The initial new E2E selectors used exact label text on native selects containing option text; switching those selectors to accessible combobox roles resolved the timeouts.
- Four real SQL suites passed after the final schema: `isolation.sql`, `member_limit.sql`, `mvp2.sql`, `mvp3.sql`. All fixture changes rolled back. Checks cover assignments/draft links, independent reviews, immutable rows, private dataset/history access, evidence gate, browser signing denial, revocation, notification dedup/read/preferences/forgery, GitHub URL validation and cross-workspace/report membership.
- `node scripts/test-mvp3-live.mjs`: passed against the real Supabase backend with three disposable confirmed identities, individual password sessions and no email. Verified actual Realtime notification delivery, private upload/version persistence, exact downloaded CSV bytes, server-enforced 60-second JWT expiry, denied direct/outsider/anonymous/revoked access and issuance logging.
- Disposable cleanup verified zero Auth identities, zero test workspace and zero Storage objects. An empty client removal response did not remove the denied-read object; privileged Storage API cleanup removed the exact synthetic CSV, then the normal Edge Function was restored. Temporary credentials/provisioning files were removed locally.
- Generated stress PDF: nine A4 pages (595.28 × 841.89 points), attribution on every page. First/last pages rendered with PDFium and visually inspected: repeated headings, page numbers, safe wrapping and no clipped content. Desktop report screen also inspected.
- Supabase security advisor: no new ResearchFlow findings at the first scan; a final release scan is recorded with the deployment check. Existing legacy warnings remain documented in SECURITY.md.
- Final dataset-writer review tightened permitted readers to read-only: the MVP 3 SQL suite passed again with explicit denied reader upload/external-version assertions. Typecheck, lint and production build passed again after the matching UI condition.

## Recommended next steps

Use separate real research accounts for institutional acceptance, confirm actual email inbox delivery, agree dataset permission/retention responsibilities, add required language fonts and review backup/orphan-maintenance procedures before storing confidential business data broadly. Future authenticated GitHub sync and outbound reminders require separate secure configuration. No paid plan was purchased for MVP 3.
