# Software Requirements Specification

## Actors and permissions

| Operation | Leader | Member | Supervisor |
|---|---|---|---|
| Read workspace, tasks, phases, members, audit | Yes | Yes | Yes |
| Edit workspace branding and phases | Yes | No | No |
| Create/assign/edit/archive tasks | Yes | No | No |
| Change assigned task status before completion | Yes | Own tasks | No |
| Complete or reopen completed tasks | Yes | No | No |
| Invite, revoke invitations, appoint roles, remove member | Yes | No | No |
| Read invitation tokens | Yes | No | No |
| Change own name and skills | Yes | Yes | Yes |

The founding leader cannot be removed or demoted. Workspace switching never uses the editable name as identity. Membership writes use guarded RPCs, not direct table updates. Removal unassigns tasks and phases atomically.

## Data requirements

- Each workspace has a maximum of **six accepted members**, including leaders and supervisors. Pending invitations do not reserve seats. The database checks capacity when an invitation is created and again when accepted; membership admission takes a workspace row lock to serialize concurrent joins. Removing a member frees a place.

- UUID keys, timestamps, foreign keys, bounded names, constrained roles/statuses/priorities and date consistency.
- Cross-workspace task-to-phase and owner relationships are rejected by composite foreign keys.
- Invitation tokens are random UUIDs, expire after seven days and can be used once by the matching verified email.
- Completed / non-archived task count divided by all non-archived tasks defines progress, rounded to the nearest integer. Empty sets are 0%. Phase status is a leader-selected lifecycle label and is separate from computed task progress.
- Audit records contain actor, timestamp, action and entity ID. They are immutable through the public API and do not contain invitation tokens or document content.

## Nonfunctional requirements

Strict TypeScript, real Supabase persistence, server-side authorization, no browser service key, reproducible lockfile, mobile layouts, keyboard access and clear failure reporting. The release must pass typecheck, lint, unit tests, SQL permission tests and production build; browser smoke coverage is documented separately. Live email verification delivery needs the project's Supabase Auth redirect and SMTP configuration.
