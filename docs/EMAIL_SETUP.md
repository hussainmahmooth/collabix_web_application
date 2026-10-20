# Signup email delivery: required account setup

## Confirmed issue

Supabase Auth logs on 20 October 2026 show `/signup` returning HTTP 429 with code `over_email_send_rate_limit`. This is an email-sending quota, separate from workspace capacity. Repeated signup clicks cannot increase that quota.

Supabase's built-in mail service is intended for testing, currently limits sending to two messages per hour, and restricts recipients to organization-authorized addresses. Production signup and password reset require a custom SMTP provider. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

The app now explains this error, prevents duplicate in-flight requests, and pauses email-producing requests for 60 seconds after a successful send or an email-quota rejection. The pause survives page reload within the tab; normal password sign-in remains available. This improves handling; it **does not remove the provider's hourly quota**.

## Set up a sender

Brevo was subsequently configured by the owner. Supabase now uses the Brevo host on port 587 and the account's exact SMTP login. A password-reset request succeeded after the login correction. Recipient inbox delivery and a real signup remain acceptance checks; this status supersedes the original missing-provider diagnosis.

1. Create the provider account and complete its required sender verification and transactional-email activation. Use an address you control. Follow the provider's domain authentication guidance for reliable delivery.
2. Obtain SMTP host, port, login, SMTP password/key and verified sender address from that provider. Never commit or paste these credentials into chat.
3. Open [this project's SMTP settings](https://supabase.com/dashboard/project/mephxqyntqqoxfnygavy/auth/smtp). Enable custom SMTP and enter the provider's exact values. Set sender name to ResearchFlow. Keep email confirmation enabled.
4. Open [Auth rate limits](https://supabase.com/dashboard/project/mephxqyntqqoxfnygavy/auth/rate-limits). After custom SMTP is active, select an email-send limit sufficient for seven people plus resets (for example 30/hour if the provider permits). Do not weaken other authentication limits.
5. In [URL configuration](https://supabase.com/dashboard/project/mephxqyntqqoxfnygavy/auth/url-configuration), verify Site URL is `https://teamprojectcolla.netlify.app`, and allow redirects to `/dashboard` and `/reset-password` on that domain.
6. Test one real signup and one password-reset message. Confirm successful delivery and correct redirect before onboarding the remaining people. Use the provider's delivery logs and Supabase Auth logs if delivery fails.

[Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) and [sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email).

The owner enters SMTP keys directly in Supabase; none are stored in this repository. The connected database tools cannot change Supabase Auth SMTP configuration. Do not substitute a Brevo account password or an API key for an SMTP key.
