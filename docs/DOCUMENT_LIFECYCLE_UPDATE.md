# Recoverable document deletion and submission corrections

21 October 2026. Existing ResearchFlow application and Cloudflare project.

## Changes

- Leader-only Delete document confirmation moves a document to recoverable Trash, distinct from Archive. Leaders can restore it, retaining its prior archive/access state. Unarchive returns archived documents to active work. No document row, Storage object, version, comment or review decision is physically removed.
- Trash is enforced through existing document RLS helpers, including file/version/comment/submission/decision metadata and Storage signing. Members and supervisors cannot access trashed documents. Trigger guards reject new files, versions, comments and review decisions while trashed. Current leaders can inspect preserved history and restore it. Existing 60-second links cannot be recalled immediately.
- Pending review requests can be corrected or withdrawn by their requester or a leader. Replacements atomically withdraw the original request and create a linked new pending request. The reason, actor and timestamp remain on the original. Academic decisions cannot be overwritten. Stale clients cannot decide a withdrawn request. Failed replacements roll back all changes. Milestone withdrawal restores the latest recorded academic state or Not requested.
- The review page explains when no Supervisor account is assigned and links leaders to team management. Academic authorization remains separate from leader internal reviews. User clarification: the requested review change was correction of mistaken submissions, not a tab rename.

## Migrations

`20261021112926_document_trash_and_review_safety.sql` and `20261021113509_pending_review_corrections.sql` match cloud history. Both were tested transactionally before application. Legacy Auth functions remain unchanged. Existing data is preserved; new fields default to null. Consolidated schema includes both changes.

## Verification

The dedicated transactional document_trash.sql suite passes leader/member/supervisor/outsider permissions, metadata/Storage isolation, preserved versions, duplicate Trash calls, restore/unarchive, atomic invalid correction rollback, pending request replacement, reviewed-request rejection, stale withdrawn decision rejection and independent lecturer review. All synthetic fixtures roll back. Existing MVP 2 and MVP 3 SQL suites also passed. Security advisor reports no new ResearchFlow findings; previously documented legacy/Auth warnings remain.

Browser, build and final deployment results are recorded below after execution. No real document has been deleted, restored, withdrawn or corrected during verification. Existing manual/PDF artifacts generated earlier are separate deliverables; current application instructions are in USER_GUIDE.md.

Typecheck, ESLint and production build passed; 28 unit tests passed. All six extended leader/member/supervisor browser cases passed across desktop/mobile in 2.1 minutes, including delete cancellation, archive/unarchive, Trash/restore, version/history preservation, requester replacement/withdrawal and lecturer feedback. An earlier run hit an ambiguous native-select locator in the existing meeting flow; the locator now uses an exact combobox role and the full suite passed. The new transactional suite passed both preflight and after application; existing MVP2/MVP3 SQL suites also passed. Large lazy PDF/font chunk warnings remain advisory.
