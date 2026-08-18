# Collabix — Team Collaboration & Task Management Platform

Collabix is a production-grade web-based team collaboration platform similar to Jira or Trello, styled with a premium blue-and-yellow visual system. It incorporates workspace-restricted Gemini AI queries, real-time message boards, and interactive progress calendars.

---

## 🛠 Technology Stack
- **Frontend Core**: Next.js App Router (React, TypeScript)
- **Styling**: Tailwind CSS v4
- **Database & Auth**: Supabase (PostgreSQL, Auth cookie management)
- **Real-time Engine**: Supabase Realtime Channels (WebSockets)
- **Visualizations**: Recharts performance graphs
- **AI Integrations**: Google Gemini API

---

## 🚀 Getting Started

### 1. Installation
Navigate to the `collabix` subdirectory and install dependencies:
```bash
npm install --legacy-peer-deps
```

### 2. Database Migration (Supabase)
Create a project on [Supabase Console](https://supabase.com).
1. Go to the **SQL Editor** in your Supabase dashboard.
2. Open and copy the contents of `database/migrations/01_schema.sql` and execute it to create tables, indexes, and profiles triggers.
3. Open and copy the contents of `database/migrations/02_security_policies.sql` and execute it to activate Postgres Row-Level Security (RLS) policies.
4. Execute `database/seed.sql` to populate initial demo data (workspace, projects, and milestones).

### 3. Environment Variables
Duplicate `.env.example` as `.env.local` in the project root:
```bash
cp .env.example .env.local
```
Fill in the parameters with your specific Supabase endpoint URL, Anon key, and Google Gemini API key:
```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
```

### 4. Running Locally
Start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view your Collabix dashboard.

---

## 📂 Project Structure
- `/app`: App router views (dashboard, tasks, calendar, reports, settings, AI assistant).
- `/components/layout`: Sidebar navigation, search header, and modal managers.
- `/lib`: Supabase and Gemini AI configurations, Zustand state store.
- `/docs`: Technical system specifications and development guides.
- `/database`: Migration schemas and data seeding files.
