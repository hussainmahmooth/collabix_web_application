# Backup and recovery

Owner: project administrator. Application: ResearchFlow / Micro Biz Tek. Reviewed 21 October 2026.

## Current status

No production data was exported, deleted, restored or reset during MVP 4. A successful backup and restore drill has **not** been demonstrated. Git history protects source code, not research records, Auth accounts or uploaded files. Before confidential institutional use, the administrator must complete and record an isolated restore drill and approve the recovery objectives below.

Supabase recommends regular off-site exports for Free projects. Database backups include Storage metadata, **not the uploaded objects**. Do not assume a free project has downloadable managed backups or point-in-time recovery. Check current [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) and the project's actual entitlements; no paid upgrade is authorized by this release.

## Backup procedure

1. Choose an encrypted administrator-controlled destination outside the repository and restrict access. Never upload dumps, Auth data, signed URLs or privileged keys to GitHub or Cloudflare build variables.
2. Use an authorized database connection and the currently installed Supabase CLI. Run `supabase db dump --help` first. Export roles, schema and data using the documented backup procedure for that CLI version; explicitly verify coverage of `auth`, `public`, `rf_private`, migration history and Storage metadata. Default dump exclusions must not be mistaken for full coverage.
3. Separately export all bytes from `researchflow-logos`, `researchflow-files` and `researchflow-datasets` using an administrator Storage API/S3 backup tool. Record object paths, byte counts and SHA-256 checksums. Preserve paths referenced by immutable document and dataset version records. Verify actual downloaded bytes; empty API responses do not prove a backup succeeded.
4. Save an encrypted configuration inventory: Auth site/redirect URLs, SMTP provider configuration, Storage limits/policies, Realtime publication, Edge Function source/version, Cloudflare build settings and deployed Git commit. Store credentials in a password manager separately from code. Rotate only when necessary.
5. Record UTC timestamp, export/tool versions, PostgreSQL version, row counts, object counts/checksums, encryption/key custodian and verification results. Check backup integrity before removing an older verified copy.

Suggested starting objectives for administrator approval: maximum 24-hour data loss, one-business-day restoration, daily backups while active and 30-day retention. These are targets, not an implemented scheduler or service guarantee. Monitor export size, egress and available storage to stay within free quotas.

## Isolated restoration drill

Restore only into a new disposable local/self-hosted or explicitly approved test environment with compatible PostgreSQL/Auth/Storage versions. Disable outgoing email and integrations there. Never run `db reset`, restore SQL, DROP or migration replay against the production project `mephxqyntqqoxfnygavy`.

Restore schema/roles/data in the documented order, including required ownership/grants, Auth dependencies, private functions and migration history. Recreate bucket settings and restore object bytes through Storage APIs, rather than inserting arbitrary `storage.objects` rows. Compare recorded row counts and object hashes. Reapply server configuration, deploy the dataset download function, and use test-only frontend variables and Auth redirects.

Run all four transactional SQL suites, sign in with controlled test identities, verify separate workspaces, six-plus-one capacity, immutable reviews and private-file access, download a known file and compare bytes, and generate a PDF. Check ordinary browser clients cannot sign dataset objects directly. Record restoration duration and failed checks. Destroying the test copy requires its own authorized cleanup; do not leave production data in an unprotected test system.

## Incident recovery and rollback

Pause writes through an administrator-managed maintenance process if an integrity incident occurs; there is no built-in global maintenance switch. Preserve evidence and take a pre-recovery backup. Obtain explicit owner approval before any destructive production recovery. Prefer a corrected forward migration and source release; a frontend rollback does not reverse database changes or restore data.

For frontend regressions, reproduce the issue, revert the offending source change in a new reviewed commit, include `[skip netlify]`, and let existing Cloudflare Git integration deploy. Verify the new asset hash, nested URLs, headers and affected workflow. Keep database migrations additive/backward-compatible. Never blindly replay the consolidated schema or restore old database snapshots under a newer frontend.

## Monitoring

Administrator checks: Cloudflare deployment failures/usage, Supabase Auth/SMTP failures and quotas, DB/Storage/egress limits, Realtime errors, Edge Function failures and latest verified backup age. No paid monitoring service or recurring automation was enabled. In-app reconnect/polling is recovery behavior, not an operational alerting service.
