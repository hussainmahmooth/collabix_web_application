# MVP 3 implementation design

Extend the existing Vite SPA and Supabase project; deploy on the established Cloudflare Pages host. Preserve MVP 1/2 entities, document versioning, role/capacity rules and branding. No external GitHub API or AI service is required.

1. Add workspace-scoped papers, ordered authors/sections, references, append-only section feedback and immutable dataset versions. Paper drafts link existing document versions. Approval is a separate supervisor-only workflow, with self-review prohibited.
2. Dataset metadata and bytes share a dataset-specific access predicate. Restricted entries require an explicit reader or management role. Private dataset Storage uses server-issued download authorization records, recording link issuance before signing; signed links have a 60-second expiry. Evidence, dictionaries and quality reports remain private. Metadata never establishes legal permission.
3. Persist personal notifications with deduplication keys, preferences and server-generated generic event text. Existing task/document/review/meeting/announcement/phase changes create events. Deadline notices are reconciled on app refresh, not an unconfigured background scheduler. Realtime plus polling handles reconnection.
4. Compute analytics from RLS-filtered real records; define date cohorts and denominators explicitly. Reuse phases and tasks for timeline and meeting-action completion. No contribution or scientific-quality scores.
5. Generate eight A4 PDF report types locally from freshly loaded authorized rows. Log export initiation, paginate tables, repeat headers, include attribution and unavailable-value labels. Never export raw dataset bytes.
6. Add validated manual GitHub repository/task links and date-filtered timeline. No tokens, synchronization or fabricated statistics.
7. Run SQL permission/isolation tests, metric/parser/PDF tests, existing regressions, mobile E2E, typecheck/lint/build; record actual results and limitations in the completion report.
