# Implementation and release gate

## MVP 1 delivered scope

React/Vite foundation, shared branding/footer, Supabase authentication flows, atomic workspace creation with seven editable default phases, team switcher, email-bound invitations, roles/removal, phase editing, task CRUD/archive/filter/status workflow, board/list views, database-derived dashboard, profile/settings/theme, private logo upload, audit triggers, RLS and composite foreign keys.

## Review gate

1. Inspect this implementation and security/validation record.
2. Configure and verify email confirmation, production redirect URLs and SMTP in Supabase Auth.
3. Run a real two-account user acceptance test: create workspace, invite member, update assigned task, request leader completion, verify isolation with a second workspace.
4. Confirm mobile behavior and academic phase defaults with the intended research team.
5. Review backup, retention, account deletion and operational ownership before broad usage.

Do not begin later milestones until MVP 1 has been reviewed and verified by the owner.

## Follow-up scope

First: supervisor reviews with immutable evidence, milestones, task comments/checklists/dependencies/calendar and multiple assignees. Then: realtime channels, immutable document versions and meeting action items. Later: dataset registry, paper authoring tracking, notifications, weekly PDF reports, evidence-based contribution metrics and manual GitHub links. GitHub OAuth/webhooks are a separate authenticated integration, not a simulated sync.
