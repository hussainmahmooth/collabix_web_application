# Database schema

All new public tables use an `rf_` prefix because this Supabase project already contains a different Collabix schema. Existing records are preserved. This is a namespace decision, not a separate tenant database: RLS enforces tenant boundaries.

| Implemented table | Purpose and keys |
|---|---|
| rf_profiles | Auth user UUID; name and skills; own edits, shared-workspace reads |
| rf_workspaces | Immutable UUID; editable name/research metadata, logo path, dates, founding leader |
| rf_workspace_members | Composite workspace/user PK, constrained role and responsibilities |
| rf_workspace_invitations | UUID, unique token, verified target email, role, expiry, acceptance timestamp |
| rf_research_phases | UUID, workspace, position, objectives, dates, owner, lifecycle and future review state |
| rf_tasks | UUID, workspace, phase, assignee, priority, status, effort, due date, archive flag |
| rf_audit_events | UUID, workspace, actor, action/entity, timestamp; API read only |

The `rf_private` schema contains non-exposed definer helpers with explicit identity checks and empty search paths. Three public security-invoker RPC wrappers expose guarded operations. No anonymous grants exist on ResearchFlow data. Indexes cover membership user lookup, workspace tasks, phases, invitations and audit chronology. See migration SQL for executable constraints, grants and RLS policies.

Admission triggers enforce six team memberships (leaders included) plus one supervisor per workspace. They lock the workspace row before counting to serialize concurrent admissions. Invitation creation checks current capacity; acceptance checks again through the membership trigger. Role-change triggers prevent bypassing either quota. Pending invitations do not reserve places. Removing a member frees a place.

`researchflow-logos` is a private 2 MB PNG/JPEG/WebP bucket. Paths start with workspace UUID and use a fresh UUID per upload. Members can read their own workspace logo using expiring signed URLs; leaders can insert. Overwrite/delete policies are intentionally absent.

## Planned normalized additions — no tables or UI yet

MVP 2: milestones, task_assignees (multiple owners), task_checklists, task_comments, documents, document_versions, discussion_channels, messages, meetings, meeting_minutes, decisions, reviews. All must carry workspace IDs and composite references. File versions will be immutable with separate document/version records.

MVP 3: datasets, paper_sections, notifications, github_links. Dataset sensitivity and ethics status must constrain access; notifications must be per recipient; paper drafts must not invent references; GitHub links initially store manual evidence URLs. Sensitive content needs private storage policies and audit coverage when introduced.

The current single task assignee is explicit; a many-to-many assignment table is deferred. Existing Collabix tables are not reused by ResearchFlow.
