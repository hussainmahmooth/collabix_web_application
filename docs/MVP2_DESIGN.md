# MVP 2 design and implementation sequence

Extend the existing React/Vite application and `rf_` Supabase model. Preserve MVP 1, the six-team-plus-one-supervisor capacity guard, existing authentication, branding and legacy Collabix tables.

1. Add private files, folders, documents and immutable versions. Restricted documents are visible only to their creator, explicitly assigned readers, leaders and the assigned supervisor. Each version has independent submission and review history.
2. Add workspace channels, persisted messages, replies, attachments and per-user read cursors. Enable Postgres Changes only on the new messaging tables and keep workspace RLS enforced.
3. Add meetings with UTC instants plus an IANA timezone, participants, authored minutes, decisions and assigned actions. Convert actions to existing tasks atomically and idempotently.
4. Add academic and internal reviews as distinct records. Only assigned supervisors may make academic decisions; only leaders may make internal decisions. Prevent self-review. Resubmissions remain separate from prior version decisions.
5. Add leader announcements, optional private attachments and read states. Reuse immutable `rf_audit_events` for metadata-only activity history.
6. Integrate navigation and dashboard summaries; verify real database authorization, Storage, Realtime and responsive UI; update the completion report with actual results.

All new data tables carry workspace identifiers and composite relationships. Browser clients have SELECT through RLS; mutations use an authenticated, validated invoker RPC into a private-schema implementation. No service-role key is shipped. File objects use immutable workspace/user/random paths in a private bucket, validated metadata, short-lived signed downloads, and database-backed access checks. Database tests use disposable fixtures inside rolled-back transactions.
