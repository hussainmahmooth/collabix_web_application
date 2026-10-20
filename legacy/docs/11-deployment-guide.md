# Deployment Guide

## Deployment Targets
- **Frontend**: Vercel.
- **Database & Auth**: Supabase Cloud.

## Environment Variables
Create `.env.local` containing:
```text
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```\n