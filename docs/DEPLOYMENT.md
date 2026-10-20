# Deployment

## Cloudflare Pages

Primary hosting is migrating to `https://researchflow-collabix.pages.dev` using the existing GitHub repository and `master` branch. Build command: `npm run build`; output: `dist`; Node: `22`. Set the existing browser-public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Pages build variables. No service-role or SMTP credential belongs in these variables. `public/_headers` preserves the security headers previously supplied by Netlify. Pages supplies SPA fallback when there is no top-level `404.html`.

Keep the existing Supabase database, Auth, private Storage and Realtime, and the existing Brevo SMTP configuration. Add the new site's exact `/dashboard` and `/reset-password` redirects in Supabase Auth and use the new origin as Site URL after deployment succeeds. Preserve old Netlify redirect entries for existing email links. Users need to sign in again on the new origin; browser sessions do not transfer between domains.

Migration commits use `[skip netlify]` to avoid spending Netlify credits. Existing Netlify hosting remains available during the migration. Update homepage canonical URL, sitemap and robots sitemap URL together when switching the primary origin. Search Console verification/indexing is separate for the new origin.

GitHub repository: `https://github.com/hussainmahmooth/collabix_web_application`.
Existing Netlify project: `teamprojectcolla`, site ID `cfbbd130-f7ed-4e49-8d69-35088e965884`, production branch `master`.
Supabase project: `mephxqyntqqoxfnygavy` (existing Collabix project, additive ResearchFlow tables).

## Local setup

Use Node 22 or newer, `npm ci`, copy `.env.example` to `.env.local`, set the Supabase URL and publishable key, then `npm run dev`. These are browser-public values, not database/admin credentials. The application does not use the prior Gemini integration.

## Database

Migrations in `supabase/migrations/` have been applied to the connected cloud project. Do not replay them there. On a fresh project, apply each once in filename order using Supabase migrations/SQL editor. `supabase/schema.sql` is a consolidated readable snapshot. The MVP 1 capacity migration remains in force. MVP 2 migrations add collaboration, private Storage, Realtime publication, a Storage path-policy correction and review ownership checks. Run transactional SQL tests and advisors afterward.

## Supabase Auth configuration required

In Authentication → URL Configuration set Site URL to `https://teamprojectcolla.netlify.app`. Allow redirects to `https://teamprojectcolla.netlify.app/dashboard` and `https://teamprojectcolla.netlify.app/reset-password`, plus localhost equivalents for development. Keep email confirmation enabled. Brevo SMTP is configured and a password-reset API test succeeded after the username correction. Confirm inbox delivery and real-user signup separately. See `EMAIL_SETUP.md`; Auth configuration lives in the Supabase dashboard.

## Netlify

`npm run build`, publish `dist`, Node 22, SPA rewrite to `index.html`. `netlify.toml` contains these settings and security headers. Remove an explicitly installed Next.js build plugin in Netlify if an old UI-level plugin causes the Vite build to fail. The repository no longer depends on Next.js.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build environment variables. Both were configured and read back in the **production** context through the account connector. The connector's initial `all` context requests reported success without persisting the new variables, so production-context creation was required. Configure other contexts separately before enabling previews. Never use service-role credentials. `.netlify` is ignored if CLI linking is used. Git continuous deployment keeps the live site and GitHub source matched.

After publication, verify HTTPS, root and deep URLs, security headers, JS/CSS assets, login UI and responsive layout. Complete real-email user acceptance before relying on this for confidential research. Track executed checks in `VALIDATION.md`.

## MVP 2 configuration

No new frontend environment variables or external services are required. The migrations create the private `researchflow-files` bucket, default channels/folders for current and future workspaces, protected functions/grants and the Realtime publication entries. Keep the bucket private. Confirm the project's Realtime service is enabled; the live two-client test verified it for this project. Deploy the database first, then the Vite bundle via existing Git continuous deployment. New routes use the existing SPA rewrite. `robots.txt` excludes authenticated application routes; only the public homepage is in the sitemap.

Retain version/review/audit records. Backups, retention, orphan-upload maintenance and storage quota monitoring require operational ownership; no scheduled cleanup worker or irreversible document purge is enabled by this release. Signed links last 60 seconds. New files are limited to 20 MB; large-dataset hosting is outside this document module.
