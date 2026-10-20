-- Collabix PostgreSQL Database Schema Migration
-- Designed for Supabase with PostgreSQL RLS support.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  avatar_url text,
  role text default 'MEMBER', -- OWNER, ADMIN, PROJECT_MANAGER, MEMBER, VIEWER
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- 2. WORKSPACES TABLE
create table if not exists public.workspaces (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.workspaces enable row level security;

-- 3. WORKSPACE MEMBERS TABLE
create table if not exists public.workspace_members (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'MEMBER' not null, -- OWNER, ADMIN, PROJECT_MANAGER, MEMBER, VIEWER
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (workspace_id, profile_id)
);

alter table public.workspace_members enable row level security;

-- 4. PROJECTS TABLE
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  description text,
  status text default 'ACTIVE' not null, -- ACTIVE, ARCHIVED, COMPLETED
  progress integer default 0 not null,
  start_date date,
  due_date date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;

-- 5. PROJECT MEMBERS TABLE
create table if not exists public.project_members (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'MEMBER' not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (project_id, profile_id)
);

alter table public.project_members enable row level security;

-- 6. TASKS TABLE
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  status text default 'TODO' not null, -- TODO, IN_PROGRESS, IN_REVIEW, COMPLETED, BLOCKED, CANCELLED
  priority text default 'MEDIUM' not null, -- LOW, MEDIUM, HIGH, URGENT
  due_date timestamptz,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

-- 7. TASK ASSIGNEES TABLE (Many-to-many)
create table if not exists public.task_assignees (
  task_id uuid references public.tasks(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  assigned_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (task_id, profile_id)
);

alter table public.task_assignees enable row level security;

-- 8. LABELS TABLE
create table if not exists public.labels (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  color text default '#2563EB' not null,
  unique (workspace_id, name)
);

alter table public.labels enable row level security;

-- 9. TASK LABELS TABLE
create table if not exists public.task_labels (
  task_id uuid references public.tasks(id) on delete cascade not null,
  label_id uuid references public.labels(id) on delete cascade not null,
  primary key (task_id, label_id)
);

alter table public.task_labels enable row level security;

-- 10. TASK COMMENTS TABLE
create table if not exists public.task_comments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.task_comments enable row level security;

-- 11. TASK ATTACHMENTS TABLE
create table if not exists public.task_attachments (
  id uuid default uuid_generate_v4() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.task_attachments enable row level security;

-- 12. CHANNELS TABLE
create table if not exists public.channels (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name text not null,
  is_dm boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.channels enable row level security;

-- 13. CHANNEL MEMBERS TABLE
create table if not exists public.channel_members (
  channel_id uuid references public.channels(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default timezone('utc'::text, now()) not null,
  primary key (channel_id, profile_id)
);

alter table public.channel_members enable row level security;

-- 14. MESSAGES TABLE
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  channel_id uuid references public.channels(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

-- 15. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  content text not null,
  type text not null, -- assignment, comment, deadline, chat
  is_read boolean default false not null,
  link text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.notifications enable row level security;

-- 16. CALENDAR EVENTS TABLE
create table if not exists public.calendar_events (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  creator_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.calendar_events enable row level security;

-- 17. ACTIVITY LOGS TABLE
create table if not exists public.activity_logs (
  id uuid default uuid_generate_v4() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.activity_logs enable row level security;

-- 18. PROJECT MILESTONES TABLE
create table if not exists public.project_milestones (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date not null,
  is_completed boolean default false not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.project_milestones enable row level security;

-- 19. AI CONVERSATIONS TABLE
create table if not exists public.ai_conversations (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.ai_conversations enable row level security;

-- 20. AI MESSAGES TABLE
create table if not exists public.ai_messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.ai_conversations(id) on delete cascade not null,
  sender text not null, -- user, ai
  content text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.ai_messages enable row level security;


-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
create index if not exists idx_workspace_members_profile on public.workspace_members(profile_id);
create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_projects_workspace on public.projects(workspace_id);
create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_profile on public.project_members(profile_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_task_assignees_profile on public.task_assignees(profile_id);
create index if not exists idx_messages_channel on public.messages(channel_id);
create index if not exists idx_notifications_profile_read on public.notifications(profile_id, is_read);
create index if not exists idx_calendar_events_workspace on public.calendar_events(workspace_id);
create index if not exists idx_activity_logs_workspace on public.activity_logs(workspace_id);


-- ==========================================
-- SUPABASE AUTH TRIGGER TO CREATE PROFILE
-- ==========================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    'MEMBER'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition (wrapped in drop/create to prevent duplicates)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
