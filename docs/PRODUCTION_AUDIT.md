# MVP 4 production audit

21 October 2026. Scope: existing Vite/React app, Supabase project and Cloudflare Pages deployment. Existing Collabix data and legacy Auth trigger are preserved. No destructive migration or production reset was performed.

## Findings and changes

| Finding | Resolution / evidence |
| --- | --- |
| Core task query could stop at the Data API default row cap, undercounting work | Stable created-at/id ordering and 500-row requests; test retrieves 1,203 records and rejects a failed later page rather than displaying partial totals |
| A failed lazy deployment chunk/render could leave an unusable page | Root error boundary with branded reload action and unsaved-entry warning; no raw error details or tokens exposed |
| Rejected initial session restoration could leave indefinite loading | Rejection handler exits startup loading; effect cleanup ignores unmounted completion |
| Analytics/chart and report code shared the research route import | Analytics and Reports now have separate lazy imports; PDF engine/fonts remain on-demand |
| Keyboard focus and motion preferences | Visible focus outline and reduced-motion override; existing accessible Radix dialogs/forms retained |
| Long team names / four screen sizes | Dedicated acceptance fixtures cover 360, 768, 1366 and 1920px through dashboard, tasks, documents, discussions, analytics and reports |

## Access-control review

Live catalog: 37 ResearchFlow public tables, zero without RLS. All three researchflow buckets are private (logos 2MB; files/datasets 20MB). Eleven checked-in migration versions match cloud history. Transactional test suites passed again in MVP 4: isolation, capacity, collaboration and research operations. Synthetic Auth identities and rows roll back. Authorization uses current membership and `auth.uid()`, not user-editable metadata. No new database migration was necessary.

Private document ACLs apply to metadata, immutable versions, feedback and Storage. Dataset downloads validate Auth and caller-scoped RPC/RLS server-side before signing the stored path for 60 seconds; browser signing is denied. Reader access does not grant writes. Composite foreign keys and guarded operations reject cross-team relationships and role/approval bypasses. Signed links already issued remain valid until expiry; downloaded copies cannot be recalled.

React escapes text; no `dangerouslySetInnerHTML` or script execution is needed for research content. Meeting links use protocol validation; GitHub links have strict HTTPS/host/type validation. CSV exports neutralize formula prefixes. Upload checks cover declared MIME, extension, size and private path ownership, not malware scanning. Paper notes remain workspace-shared. Do not put confidential content in publicly intended branding fields.

## Open security and operational findings

- Legacy `public.handle_new_user()` has a mutable search path and API execution grants. Owner explicitly chose to leave this legacy trigger unchanged. The Supabase advisor still reports it; this release does not claim a clean security advisor. See [search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [anonymous execution](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [authenticated execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Auth [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled. No paid plan was purchased. Twelve legacy tables with RLS and no policies remain denied by default.
- Performance advisor reports unindexed foreign keys, including ResearchFlow history/author relationships, and per-row Auth calls on several policies. Existing workspace/query indexes remain. These are follow-up measurements for larger deployments; no speculative index removals or legacy policy rewrites were performed. See [foreign-key indexing](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- No antivirus, independent penetration test, background deadline scheduler, orphan-file purge or automated backup service. Large document/history loads remain paginated over the network but held in browser memory; no claim of high-volume load readiness.
- New email registration/password recovery must still be accepted through delivered inbox links. Prior SMTP API success is not proof of inbox delivery. MVP 4 sends no new emails.
- Backup/restore drill, full screen-reader review, Safari and physical device acceptance remain operational release gates. See BACKUP_AND_RECOVERY.md.

## Release decision

Technical checks and deployment evidence belong in MVP4_COMPLETION_REPORT.md. Until delivered-email acceptance and a verified isolated backup restoration are recorded, do not describe this as fully production-ready for confidential university data. The deployed application may be used for controlled team acceptance with these limitations understood.
