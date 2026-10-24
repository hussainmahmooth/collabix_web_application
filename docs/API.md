# API contract

The application uses Supabase JS v2. Authentication: `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`, `getSession`, `onAuthStateChange`, `signOut`.

## Public RPCs (authenticated only)

| RPC | Arguments | Result |
|---|---|---|
| rf_create_workspace | team_name, title, full_name | New workspace UUID; atomically creates founding membership and phases |
| rf_accept_invitation | invite_token UUID, full_name | Workspace UUID; validates verified email, expiry and single use |
| rf_manage_member | w UUID, target UUID, new_role text or null | Void; leader-only role change or removal/unassignment |

No endpoint trusts a client-provided global role. Each RPC uses the authenticated database identity.

## Data API

All `rf_*` selects are protected by RLS. Leaders insert/edit tasks, edit workspace/phase metadata and insert/delete invitations. Members update only their own assigned task status before completion. Profiles support own insert/update. Membership and audit tables are API read only. Archive is an update, not deletion. `.eq('workspace_id', activeId)` scopes normal queries, while RLS protects against omitted or malicious filters.

Errors from Supabase are surfaced in a persistent alert and mutations invalidate TanStack Query caches. No optimistic success is displayed before a successful response. UUID workspace IDs are immutable.

Logo uploads use private Storage `upload` with fresh object names; `createSignedUrl` grants a one-hour read URL. MIME and size are checked both in the UI and bucket configuration.
# MVP 2 collaboration API

Authenticated clients use `rf_collaborate(action, p)` with `p.workspace_id` and action-specific values. The return value is `{id}`; errors are raised for missing resources, invalid relationships or forbidden operations. No actor/role argument is accepted: identity and permissions come from Auth and current membership.

| Action group | Actions |
|---|---|
| Channels/messages | `channel_save`, `message_send`, `message_edit`, `message_delete`, `channel_read` |
| Documents/files | `document_create`, `document_access`, `document_archive`, `file_register`, `document_comment` |
| Meetings | `meeting_save`, `meeting_cancel`, `meeting_note`, `meeting_action`, `action_convert` |
| Reviews | `review_request`, `review_decide` |
| Announcements | `announcement_save`, `announcement_read` |

New tables are SELECT-only for browser roles and have RLS. Upload bytes to `researchflow-files` using the user's JWT and an immutable workspace/user/random path, then register the object against exactly one document/message/announcement. `file_register` validates persisted Storage metadata and assigns document version numbers under a row lock. `action_convert` is idempotent. Academic review and internal review decisions are separate, immutable records. The typed client helpers in `src/collaboration/model.ts` show request shapes and safe file/timezone handling.
## Recoverable CRUD administration

`rf_manage_record(entity text, operation text, p jsonb)` accepts `operation` = `edit`, `trash`, or `restore`, and `p` = `{workspace_id, id, changes?}`. It is a public security-invoker wrapper around a private leader-authorized operation. Entities: phases, channels, documents, meetings, announcements, papers, sections, references, datasets, repositories, links, document_comments, meeting_notes and meeting_actions. Fields and tables are explicitly allowlisted; IDs, ownership, workspace, review status, access permissions and author lists cannot be rewritten through this endpoint. Advanced edits continue through existing module APIs. Unknown records/fields and unauthorized callers fail rather than silently succeeding.

`rf_record_changes` is SELECT-only for current workspace leaders, with before/after snapshots of panel actions. It is not the metadata-only general activity feed. New deletion flags are recoverable markers under existing read policies, not confidentiality controls; document Trash retains its stricter existing policy. See CRUD_UPDATE.md and the applied migration for lifecycle/parent/version protections.
