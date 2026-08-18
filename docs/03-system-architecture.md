# System Architecture

Collabix utilizes a three-tier decoupled architecture:

1. **Client Interface**: Next.js App Router (React, TypeScript, Tailwind CSS, Recharts) hosted on Vercel.
2. **Server Middleware / Actions**: Next.js Server Actions and Route Handlers for business logic, JWT validation, and context assembly.
3. **Backend Service Layer**: Supabase Platform, providing:
   - PostgreSQL Database for storage.
   - Supabase Auth for session tokens.
   - Supabase Realtime via WebSockets.
   - Supabase Storage for files.
4. **AI Processing Layer**: Google Gemini API via server-side API keys.\n