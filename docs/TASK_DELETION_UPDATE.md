# Recoverable task deletion

24 October 2026. ResearchFlow, existing Cloudflare Pages deployment.

Leaders can select the trash icon on a task in board or list view and confirm Delete task. Cancel deletion leaves the task unchanged. Deletion sets the existing archived flag, removing it from active task lists and progress totals. Deleted tasks and previously archived tasks share the clearly labelled Archived / Trash view. Restore task returns the same task with its details, status and related records intact. No task, paper, meeting action, file or audit record is physically purged. Workspace membership and existing database leader permissions remain authoritative. Trash visibility follows the existing archived-task visibility; it is not a private document-style Trash.

The delete update includes both workspace and task IDs and requires a returned row so an unsuccessful update is not reported as success. The existing archival and restoration controls remain available. No database migration or change to legacy Auth functions was required.

Verification: expanded browser coverage checks cancellation, disappearance from active work, recovery in Archived / Trash, restoration of the original status and denial of delete/archive controls to an assigned member. The isolation SQL suite now checks leader archival/restoration and member restore denial using rolled-back synthetic fixtures. No real task was deleted during testing.

Final build, browser and deployment evidence is recorded below after verification.

Typecheck, ESLint and production build passed. All ten desktop/mobile workspace browser cases passed in 52.6 seconds, including cancellation, delete/recover and assigned-member denial of management controls. The initial run had one dashboard navigation timeout before controls were used; rerunning with a 120-second cold-load allowance passed all cases. The expanded live isolation SQL suite passed and rolled back all fixtures. Production build retains the known advisory lazy PDF/font chunk warnings.

Published source af086d9c8cd36dcb9f1ee6b4cb5711f0a13de5d1 through the existing GitHub-to-Cloudflare integration with [skip netlify]. At 2026-10-24T17:10:34Z, read-only production checks passed all 21 routes, security headers and bundle secret-pattern checks; entry index-DPZuMvpA.js matches the tested build. Four published-site leader/member desktop/mobile browser checks passed in 27.0 seconds, including delete cancellation, recovery and member management restrictions. These browser checks use isolated API fixtures; backend authorization was separately checked by rolled-back SQL. No real task was altered. Existing untracked manual/export artifacts were left untouched. Evidence-only follow-up skips hosting builds.
