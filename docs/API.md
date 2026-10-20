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
