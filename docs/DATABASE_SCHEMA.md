# Database schema

All new public tables use an `rf_` prefix because this Supabase project already contains a different Collabix schema. Existing records are preserved. This is a namespace decision, not a separate tenant database: RLS enforces tenant boundaries.

| Implemented table | Purpose and keys |
|---|---|
| rf_profiles | Auth user UUID; name and skills; own edits, shared-workspace reads |
| rf_workspaces | Immutable UUID; editable name/research metadata, logo path, dates, founding leader |
| rf_workspace_members | Composite workspace/user PK, constrained role and responsibilities |
| rf_workspace_invitations | UUID, unique token, verified target email, role, expiry, acceptance timestamp |
| rf_research_phases | UUID, workspace, position, objectives, dates, owner, lifecycle and academic review state |
| rf_tasks | UUID, workspace, phase, assignee, priority, status, effort, due date, archive flag |
| rf_audit_events | UUID, workspace, actor, action/entity, timestamp; API read only |

The `rf_private` schema contains non-exposed definer helpers with explicit identity checks and empty search paths. Three MVP 1 public security-invoker RPC wrappers and the MVP 2 `rf_collaborate` wrapper expose guarded operations. No anonymous grants exist on ResearchFlow data. Indexes cover membership user lookup, workspace tasks, phases, invitations and audit chronology. See migration SQL for executable constraints, grants and RLS policies.

Admission triggers enforce six team memberships (leaders included) plus one supervisor per workspace. They lock the workspace row before counting to serialize concurrent admissions. Invitation creation checks current capacity; acceptance checks again through the membership trigger. Role-change triggers prevent bypassing either quota. Pending invitations do not reserve places. Removing a member frees a place.

`researchflow-logos` is a private 2 MB PNG/JPEG/WebP bucket. Paths start with workspace UUID and use a fresh UUID per upload. Members can read their own workspace logo using expiring signed URLs; leaders can insert. Overwrite/delete policies are intentionally absent.

## MVP 2 normalized additions

| Tables | Purpose |
|---|---|
| rf_channels, rf_messages, rf_channel_reads | Workspace channels, reply-linked messages, soft deletions and per-user persisted read cursors |
| rf_document_folders, rf_documents, rf_document_access | Default categories, phase/task-linked documents and explicit confidential readers |
| rf_files, rf_document_versions, rf_document_comments | Private object metadata, append-only numbered versions and authored feedback |
| rf_meetings, rf_meeting_participants, rf_meeting_notes, rf_meeting_actions | UTC meeting instants plus IANA timezone, participants, append-only minutes/decisions/comments, actions linked to existing tasks |
| rf_submissions, rf_reviews | Version/milestone review requests, separate academic/internal status, immutable reviewer decisions |
| rf_announcements, rf_announcement_reads | Leader announcements with priority, pin/archive and per-user read state |

`rf_channel_unread` is a `security_invoker` aggregate view over RLS-protected channels/messages/read cursors. All 17 new tables have workspace indexes and RLS. Composite foreign keys reject resource references from another workspace. Membership is still `rf_workspace_members`; activity still uses `rf_audit_events`; milestones reuse `rf_research_phases`. A membership trigger creates the default seven channels and ten folders for new workspaces; migration backfill adds only these empty defaults to existing workspaces.

`researchflow-files` is private, limited to 20 MB, with a MIME allowlist. Paths are workspace UUID/user UUID/random UUID plus validated extension. File records reference exactly one document, message or announcement. Document versions have a unique document/version number and immutable file reference. Registration locks the document to serialize version numbering. Partial unique indexes prevent duplicate pending academic requests for a version/milestone. Meeting action conversion locks the action and returns the already-created task on retry.

New writes use `rf_collaborate`; SELECT policies use current database membership and restricted-document ACLs. Storage cleanup only permits the original uploader's unregistered objects and never bypasses registered-file access. The three MVP 2 migration filenames match the applied cloud migration history. See the migration files and consolidated `schema.sql` for executable definitions.

## MVP 3 design baseline (implemented below)

MVP 3: datasets, paper_sections, notifications, github_links. Dataset sensitivity and ethics status must constrain access; notifications must be per recipient; paper drafts must not invent references; GitHub links initially store manual evidence URLs. Sensitive content needs private storage policies and audit coverage when introduced.

The current single task assignee is explicit; a many-to-many assignment table is deferred. Existing Collabix tables are not reused by ResearchFlow.

## MVP 3 implemented tables
- `rf_papers`, `rf_paper_sections`, `rf_paper_feedback`, `rf_references`: paper metadata, ordered author/assignee UUID arrays checked against membership, outlines, existing task/document-version links and immutable decisions/comments.
- `rf_datasets`, `rf_dataset_versions`, `rf_dataset_changes`, `rf_dataset_access_events`: bounded governance/quality metadata, classification/permission/readers, immutable file/external versions, private before/after snapshots and issuance logs.
- `rf_notifications`, `rf_notification_preferences`: recipient/event uniqueness, personal reads and per-workspace category preferences.
- `rf_github_repositories`, `rf_github_links`: validated repository/type/task/member relationships for manual evidence.
- `rf_report_events`: personal export initiation without exported contents.

Every public table has RLS, workspace indexes and revoked direct browser DML; composite foreign keys prevent foreign-team links. The private expiring issuance-grant table is retained internally but no Storage client read policy consumes it. Only the authenticated Edge Function signs dataset bytes. Dataset history starts when its migration is installed; earlier snapshots are not fabricated. The five MVP 3 migrations and `supabase/tests/mvp3.sql` are the executable specification.

## MVP 4 catalog verification
Cloud history contains the same eleven migration versions as supabase/migrations. All 37 ResearchFlow public tables have RLS; all three Storage buckets remain private. Four rolled-back integration suites pass. No schema migration or destructive database operation was needed for MVP 4. Existing composite keys and role/ACL guards remain. Performance advisor still identifies missing foreign-key indexes and some per-row Auth expressions; these are documented rather than claiming unmeasured speedups. A fresh-environment migration replay and full backup restoration have not been executed in this release.
