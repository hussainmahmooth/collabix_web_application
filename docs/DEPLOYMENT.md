# Deployment

GitHub repository: `https://github.com/hussainmahmooth/collabix_web_application`.
Existing Netlify project: `teamprojectcolla`, site ID `cfbbd130-f7ed-4e49-8d69-35088e965884`, production branch `master`.
Supabase project: `mephxqyntqqoxfnygavy` (existing Collabix project, additive ResearchFlow tables).

## Local setup

Use Node 22 or newer, `npm ci`, copy `.env.example` to `.env.local`, set the Supabase URL and publishable key, then `npm run dev`. These are browser-public values, not database/admin credentials. The application does not use the prior Gemini integration.

## Database

The migration in `supabase/migrations/20261020093304_researchflow_mvp1.sql` has been applied to the connected cloud project. Do not replay it there. On a fresh project, apply it once using Supabase migrations/SQL editor. `supabase/schema.sql` is the same readable snapshot. Run the transactional SQL tests and advisors afterward.

## Supabase Auth configuration required

In Authentication → URL Configuration set Site URL to `https://teamprojectcolla.netlify.app`. Allow redirects to `https://teamprojectcolla.netlify.app/dashboard` and `https://teamprojectcolla.netlify.app/reset-password`, plus localhost equivalents for development. Keep email confirmation enabled. Configure a production SMTP provider, then verify signup and reset emails with real accounts. No SMTP credentials were provided by the user. The integration tools do not expose Auth configuration; this step must be verified in the Supabase dashboard.

## Netlify

`npm run build`, publish `dist`, Node 22, SPA rewrite to `index.html`. `netlify.toml` contains these settings and security headers. Remove an explicitly installed Next.js build plugin in Netlify if an old UI-level plugin causes the Vite build to fail. The repository no longer depends on Next.js.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as build environment variables. Both were configured on this Netlify site through the account connector. Never use service-role credentials. `.netlify` is ignored if CLI linking is used. Git continuous deployment is preferred so the live site and GitHub source match.

After publication, verify HTTPS, root and deep URLs, security headers, JS/CSS assets, login UI and responsive layout. Complete real-email user acceptance before relying on this for confidential research. Track executed checks in `VALIDATION.md`.
