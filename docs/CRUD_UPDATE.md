# ResearchFlow CRUD update

Requested scope: all main modules, with approved decisions and audit history protected.

## Behavior

| Module | Create/read | Update | Recoverable delete |
| --- | --- | --- | --- |
| Tasks | Existing create and task views | Existing task editor/status workflow | Existing Delete / Archived / Trash / Restore |
| Phases | Existing Add and phase cards | Existing full editor; quick metadata edits | Manage records / Trash / Restore |
| Discussions | Existing channel/message creation and threads | Existing author message edits; channel editor | Channel Trash/Restore; existing message soft deletion |
| Documents | Existing create, upload and document views | New title edits; existing access/version workflows | Existing stricter document Trash, also available in Manage records |
| Meetings | Existing scheduling, details, notes and actions | Existing full scheduling editor; new notes/action corrections | Meeting, notes and unconverted action Trash/Restore |
| Announcements | Existing publication and views | Existing full editor; quick text edits | Trash/Restore independent of Archive |
| Papers | Existing paper/section/reference creation and views | Existing paper/section editors; new reference edits | Paper, unapproved section and reference Trash/Restore |
| Datasets | Existing registration, versions and authorized views | Existing metadata/permission editor; quick name/description edits | Trash/Restore; server blocks download issuance and new versions while deleted |
| GitHub | Existing registration/manual linking and views | Repository URL (before links exist), link URL/description | Repository/link Trash/Restore |

Leaders administer the new panels. Existing member and supervisor workflows remain. Document comments also support leader corrections and Trash. No physical row or file deletion is introduced. Core task archiving is unchanged. New deleted markers remain readable under existing RLS; they are not an ACL boundary. Document Trash retains its separate leader-only read policy.

## Database

Migration `20261024173501_complete_module_crud.sql` is applied. The public RPC is security invoker, delegates to a private function with empty search path, explicitly checks the current authenticated workspace leader, uses a closed table/field allowlist, locks rows, scopes every write by workspace/id and retains original identifiers. Unknown entities/fields and workspace reassignment are rejected. There are no generic arbitrary table or SQL parameters.

`rf_record_changes` stores before/after snapshots of panel edits/deletions/restorations with actor and time. RLS allows current leaders only; browser INSERT/UPDATE/DELETE are revoked. Academic decisions and immutable evidence stay in their original tables. Child-write guards protect deleted parents; dataset access-event and upload guards protect downloads/uploads even through stale clients.

Legacy authentication trigger and existing seven-person workspace capacity remain unchanged. Security advisors report only the previously documented legacy/Auth findings; no new ResearchFlow security finding.

## Validation

- Migration preflight and synthetic CRUD suite ran in a transaction and rolled back before applying.
- Live SQL suites passed: CRUD, workspace isolation, MVP2, MVP3, document Trash and pending review corrections. All synthetic identities/data rolled back.
- CRUD suite covers all 14 managed record types, before/after history, invalid fields, cross-workspace denial, member/supervisor/outsider denial, parent guards, approved section/conversion protections, and dataset download/upload blocking/restoration.
- Existing 28 unit tests pass. Production build and lint pass.
- All 24 desktop/mobile browser cases passed (5.0 minutes): CRUD, workspace/capacity, collaboration and research workflows. The new CRUD cases exercise all 14 managed record types on both viewport sizes. API responses in browser cases are isolated fixtures; database authorization is tested independently by the live SQL suites.
- Production source commit: `7d176f4` (`[skip netlify]`). At `2026-10-24T17:43:23.695Z`, all 21 Cloudflare routes returned HTTP 200 with the matching build entry `/assets/index-DKGzb8Sc.js`, CSP, nosniff and frame denial headers. The supplemental built-bundle secret-pattern scan passed; it is not an independent security certification.
- Published-browser verification also passed on desktop and mobile (2 cases, 2.1 minutes), exercising all 14 record types with isolated API fixtures against the real deployed JavaScript/CSP. Screenshots were reviewed for both viewports. Real workspace records were not modified; live server permissions were verified separately through rolled-back SQL fixtures.

## Deliberate limits

Approved decisions, approved paper sections, immutable document/dataset versions and audit/export events are protected rather than made freely editable/deletable. Corrected pending review submissions use their existing withdraw/replace workflow. Repository URLs with linked work require separate registration to avoid silently rewriting contribution links. Converted meeting actions are edited/deleted through Tasks. History in the panel is the latest 100 panel changes, not a replacement for existing audit/module histories.
