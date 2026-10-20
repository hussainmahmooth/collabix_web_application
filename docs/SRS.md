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

- Each workspace has **six team places (leaders included) plus one supervisor place**, for seven people total. Role changes must obey these separate quotas. Pending invitations do not reserve seats. The database checks capacity when an invitation is created and again when accepted; membership admission takes a workspace row lock to serialize concurrent joins. Removing a member frees a place.

- UUID keys, timestamps, foreign keys, bounded names, constrained roles/statuses/priorities and date consistency.
- Cross-workspace task-to-phase and owner relationships are rejected by composite foreign keys.
- Invitation tokens are random UUIDs, expire after seven days and can be used once by the matching verified email.
- Completed / non-archived task count divided by all non-archived tasks defines progress, rounded to the nearest integer. Empty sets are 0%. Phase status is a leader-selected lifecycle label and is separate from computed task progress.
- Audit records contain actor, timestamp, action and entity ID. They are immutable through the public API and do not contain invitation tokens or document content.

## Nonfunctional requirements

Strict TypeScript, real Supabase persistence, server-side authorization, no browser service key, reproducible lockfile, mobile layouts, keyboard access and clear failure reporting. The release must pass typecheck, lint, unit tests, SQL permission tests and production build; browser smoke coverage is documented separately. Live email verification delivery needs the project's Supabase Auth redirect and SMTP configuration.

## MVP 2 permissions and workflows

| Operation | Leader | Member | Assigned supervisor |
|---|---|---|---|
| Read workspace channels/messages; send/reply | Yes | Yes | Yes |
| Create/rename/archive channels | Yes | No | No |
| Edit messages | Own | Own | Own |
| Delete messages | Any in workspace | Own | Own |
| Create/upload document versions | Yes | Accessible documents | No |
| Manage document confidentiality/readers | Leader or creator | Creator | Creator if previously authored |
| Archive documents | Yes | No | No |
| Read restricted documents | Yes | Creator/explicit reader | Yes |
| Comment on accessible documents | Yes | Yes | Yes |
| Submit document versions | Leader or version author | Version author | No |
| Submit milestones | Yes | No | No |
| Academic review | No | No | Yes; never own research |
| Internal review | Yes; not own request | No | No |
| Schedule meetings/comment | Yes | Yes | Yes |
| Edit/cancel meeting, minutes/decisions/actions | Leader or organizer | Organizer | Organizer |
| Convert meeting action to existing task | Yes | No | No |
| Publish/edit/archive/pin announcements | Yes | No | No |
| Read announcements/activity | Yes | Yes | Yes |

Documents use ten default folders, immutable numbered versions and optional phase/task links. File validation allows PDF, DOCX, XLSX, CSV, TXT, Markdown and common raster images from 1 byte to 20 MB. Private signed file access follows current membership and ACLs. Academic/internal review statuses and reviewer history remain separate; phase academic state is independent of task-based progress.

Meetings persist organizer, type, description, UTC start/end instants, IANA timezone, participants, location/link and agenda. Minutes/decisions/comments are authored append-only records. Action items require an active team assignee and deadline; conversion is atomic and idempotent. Announcements preserve author, publication timestamp, priority, pin/archive and optional attachments. Activity excludes private contents and supports member/type/date filtering.
