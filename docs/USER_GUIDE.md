# ResearchFlow user guide

1. Create an account and verify your email. Sign in using individual credentials. Password recovery is available from sign-in.
2. Create a workspace with your team name and research title. You become its leader. Seven default phases are created; customize them for your discipline.
3. Open **Settings** to edit your team name, institution, programme, supervisor details, dates, description, accent and logo. ResearchFlow and the developer credit remain permanent.
4. Open **Team members**, create an invitation for an exact email address, copy the generated link and share it yourself. The recipient signs in using that verified email, then clicks **Join workspace**. Links expire after seven days. Invitations do not send an automated email.

   Each workspace has six team places, including the leader, plus one separate supervisor place (seven people total). The team page shows both quotas. A free supervisor place cannot be used by an extra team member. When full, remove an existing member to make room; pending links cannot exceed this limit when accepted.
5. Create tasks with an owner, phase, priority, due date and estimated hours. Use filters, search and board/list views. Members change their assigned tasks to In Progress, Blocked or In Review. A leader completes the task after reviewing the work. Archive is reversible from the archive view.
6. Edit phases to set dates, owners and objectives. Phase progress reflects non-archived completed tasks; phase status is a separate leader setting.
7. The dashboard shows real task counts, upcoming work, per-owner task completion and the latest recorded workspace activity. Empty workspaces start at 0%. Activity counts are not scientific evidence of contribution.
8. Use the workspace selector to change teams. On phones, core navigation is at the bottom and other controls are in the menu. The moon/sun control changes theme. Click your sidebar profile area to sign out; edit your profile through Settings.

## Discussions

Open **Discussions**, select a channel and send a message. Replies reference the original message; authors may edit their own messages, and authors/leaders may delete them. Deleted bodies and attachments are hidden. Leaders create, rename, archive or restore channels. Archived channels preserve history but accept no new posts. Attach supported files up to 20 MB. The channel list shows persisted unread counts; opening a channel marks messages through the latest loaded timestamp as read. A reconnect indicator and periodic refresh recover missed updates; **Load earlier messages** retrieves older history.

## Documents

Open **Documents → Upload document**. Select a folder, title and optional phase/task links. Supported files: PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG, JPEG, WebP and GIF, up to 20 MB. Empty/unsupported/mismatched uploads are rejected. A failed initial upload leaves a draft that can be reopened and given a file.

Open a document to download or preview supported files, add a new version, comment, see immutable version/review history or submit a version for academic review. Text previews support 1 MB; larger text is downloadable. PDF opens in the browser; DOCX/XLSX download for viewing. Versions never overwrite previous files. Search, folder, review-status and date/title sorting controls help locate material. Leaders may archive documents; physical deletion is not exposed, preserving evidence.

The creator and leaders may **Manage access**. A restricted document is visible to its creator, leaders, the assigned supervisor and selected current team readers. All workspace members can access unrestricted documents. Previously issued signed links can remain valid for up to 60 seconds after access changes; do not forward confidential downloads.

## Meetings

Open **Meetings → Schedule meeting**. Set title, type, start/end, IANA timezone (for example `Asia/Colombo`), participants, agenda and location/link. The organizer is always included. Times are stored in UTC; cards show the meeting timezone, and the calendar uses your browser timezone. Nonexistent daylight-saving local times are rejected. During repeated daylight-saving hours the converter selects one deterministic valid occurrence; verify the displayed UTC-equivalent time if scheduling during that hour.

Use list/calendar and upcoming/completed/cancelled/all filters. Organizers and leaders edit/cancel meetings and append authored minutes, decisions and action items. Other members, including supervisors, can comment. Actions require a current team member and deadline. Leaders click **Convert to task**; retrying returns the same task, and existing task approval rules remain unchanged.

## Supervisor reviews

An academic supervisor signs in with their own verified account and must accept a supervisor invitation. **Supervisor Reviews** shows their assigned projects, pending document/milestone reviews, upcoming meetings and a link to activity history. Use the workspace selector to change assigned projects.

Leaders submit milestones; version authors and leaders submit document versions. The supervisor records **Approved**, **Revision Requested**, or **Rejected** with written feedback. Internal leader decisions are separate and never grant academic approval. Requesters cannot review their own submissions; supervisors also cannot review their own document/version. Each decision is preserved; revised submissions receive a new request and review history. Academic milestone decisions update the phase review state while leaving computed task progress separate.

## Announcements and activity

Leaders publish/edit/archive announcements, set priority, pin them and attach private files. Members can mark announcements as read. The dashboard includes recent announcements, pending reviews, upcoming meetings, unread discussion counts and recent activity. **Activity history** filters by member, event type and date, showing the latest 200 matching metadata events. It never displays private document contents or message bodies.

On phones, use **Open navigation** to reach the new modules. MVP 3 modules are described below; outbound notifications and authenticated GitHub synchronization remain future scope.

## MVP 3
**Research Papers:** leaders create papers, select authors and use Move up for author order. Set the corresponding author, supervisor, venue and dates. Leaders customize and assign the default 14-section outline. Assigned members write notes and link a draft version uploaded in Documents. Use Supervisor Review to request a decision; supervisors use Feedback & history. Editing resets approval. Import CSV headers `authors,title,year,venue,url,notes`, or export CSV/BibTeX. BibTeX import and word processing are not included.

**Datasets:** leaders configure confidentiality, readers and permission. Record actual evidence, scope, provenance, dates, dictionary, quality findings, phase and retention. Registration is not processing permission. Evidence can precede approval; raw files require Granted permission and active retention/status. Versions & governance shows private snapshots and issuance history. External providers still control external files. Keep customer details out of titles and dashboard summaries.

**Notifications:** the header bell and full page show your personal inbox and preferences. Deadline notices refresh while the app is open. No email, SMS or push notification delivery is configured. Discussion mention recognition supports explicit `@{member-UUID}` tokens; a rich mention picker is not included.

**Analytics:** task metrics use tasks created in the chosen date range, with member/phase/status filters. The page labels workspace-wide summaries and applicable activity/action filters. Empty denominators are unavailable, not misleading percentages. Charts have table alternatives.

**Reports:** choose one of eight types and a reporting period. Individual reports need a member, phase reports need a phase, and weekly/monthly reports need both dates. PDFs use configured branding/institution details, optional PNG/JPEG logos and fixed attribution. Paper reports show the current outline and dated feedback. Dataset reports exclude raw file bytes.

**GitHub Tracking:** leaders register `https://github.com/owner/repository`; members link issue, PR, commit or branch URLs to tasks. Task details shows related links. No API token or synchronization is needed or claimed.

**Research Timeline:** the workspace selector switches independent projects. Filter dates or papers; entries reuse existing phases/milestones, paper submission/publication dates, section-review deadlines and dataset checkpoints. Unset dates are omitted. On phones, scroll the navigation menu to reach all modules.

## Recovery and operating limits
If ResearchFlow displays a reload recovery screen, reload and re-enter any unsaved form changes. If a data request fails, use Retry after connectivity returns; don't assume an incomplete list means records were deleted. Leaders rename teams in Settings → Workspace Settings. Capacity remains six team members including leaders plus one supervisor. Do not upload confidential institutional datasets until your administrator has accepted the security findings and demonstrated backup restoration. Report unavailable signed links by requesting a new authorized download; links expire after 60 seconds.

## Document Trash and submission corrections
Leaders can open a document and choose Delete document, then confirm Move to Trash. This is recoverable: in Documents select Trash, open the document and select Restore document. Only leaders can view Trash; member/lecturer metadata, file signing and pending review access are blocked until restoration. Files, versions, decisions and original access settings are preserved. A document restored from an archived state remains archived; use Archived → Open document → Unarchive document to return it to active work. There is no automatic purge. Already-issued signed links may remain valid for up to 60 seconds.

If the wrong document version was submitted, upload the corrected version first. Open Supervisor Reviews → Open submission → Edit or withdraw submission. Choose a replacement version (or a research phase for a milestone), explain the correction, then Save submission correction. Only a current leader or the original requester can correct pending academic submissions. The original request becomes Withdrawn, a linked replacement becomes pending, and all existing evidence/decisions remain in history. Use Withdraw without replacement when work is not ready. All submissions and decisions shows withdrawn requests and reasons. A failed replacement leaves the original request pending. Lecturers cannot approve withdrawn requests; reviewed academic decisions are not editable through this correction flow.

If no lecturer is assigned, the review page explains how to invite a Supervisor account. Internal leader reviews do not count as academic supervisor approval. Other existing removal controls include task archive/restore, author/leader message deletion, announcement archive and meeting cancellation; these do not erase historical academic evidence.

## Delete and recover tasks
Leaders can click the trash icon on a task card in either board or list view, then confirm Delete task. This is recoverable deletion using the existing archive mechanism: the task leaves active work and progress totals, while its details, linked research and audit history remain. Cancel deletion leaves it unchanged. Open Tasks → Archived / Trash, then use Restore task to recover it. Deleted and previously archived tasks share this view. Other members and supervisors cannot delete or restore tasks. No permanent task purge is provided.
