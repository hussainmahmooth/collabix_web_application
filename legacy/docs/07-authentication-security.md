# Authentication & Security

- **Authentication**: Powered by Supabase Auth with secure JWT cookies.
- **Route Guard Protection**: Next.js middleware intercepting pages under `/dashboard`, `/tasks`, etc., checking active sessions.
- **Row Level Security (RLS)**: Enforced in PostgreSQL. Every table checks workspace membership using subqueries to prevent cross-tenant data leaks.\n