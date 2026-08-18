-- Collabix PostgreSQL Row-Level Security (RLS) Policies
-- This script hardens database access, ensuring cross-workspace data isolation.

-- ==========================================
-- 1. PROFILES POLICIES
-- ==========================================
-- Profiles are readable by any authenticated user in the system (needed for invitations and DMs)
create policy "Allow profile select to all authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Profiles are only editable by the owner profile user
create policy "Allow profile update to the owner user"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);


-- ==========================================
-- 2. WORKSPACES POLICIES
-- ==========================================
-- Users can view workspaces they are joined to as members
create policy "Select workspace by members"
  on public.workspaces for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Any authenticated user can create a workspace
create policy "Insert workspace by authenticated users"
  on public.workspaces for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Only workspace owners/admins can update workspace parameters
create policy "Update workspace by owner/admin"
  on public.workspaces for update
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN')
    )
  );


-- ==========================================
-- 3. WORKSPACE MEMBERS POLICIES
-- ==========================================
-- Workspace members can view other member records in the same workspace
create policy "Select members by workspace peers"
  on public.workspace_members for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members as peers
      where peers.workspace_id = workspace_id
      and peers.profile_id = auth.uid()
    )
  );

-- Only owners and admins can add/invite members
create policy "Insert members by workspace owner/admin"
  on public.workspace_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspace_members as peers
      where peers.workspace_id = workspace_id
      and peers.profile_id = auth.uid()
      and peers.role in ('OWNER', 'ADMIN')
    )
  );

-- Only owners and admins can update roles or remove members
create policy "Update/delete members by workspace owner/admin"
  on public.workspace_members for all
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members as peers
      where peers.workspace_id = workspace_id
      and peers.profile_id = auth.uid()
      and peers.role in ('OWNER', 'ADMIN')
    )
  );


-- ==========================================
-- 4. PROJECTS POLICIES
-- ==========================================
-- Project lists can be selected by workspace members
create policy "Select projects by workspace members"
  on public.projects for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = projects.workspace_id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Project creation is limited to owners, admins, and project managers
create policy "Insert projects by workspace leads"
  on public.projects for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN', 'PROJECT_MANAGER')
    )
  );

-- Project updates/deletes are limited to owners and admins
create policy "Modify projects by workspace owners/admins"
  on public.projects for all
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = projects.workspace_id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN')
    )
  );


-- ==========================================
-- 5. TASKS POLICIES
-- ==========================================
-- Select tasks in workspaces the user is a member of
create policy "Select tasks by workspace members"
  on public.tasks for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      join public.workspace_members on workspace_members.workspace_id = projects.workspace_id
      where projects.id = tasks.project_id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Create tasks is allowed for workspace members (except VIEWERS)
create policy "Insert tasks by workspace participants"
  on public.tasks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      join public.workspace_members on workspace_members.workspace_id = projects.workspace_id
      where projects.id = project_id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'MEMBER')
    )
  );

-- Update tasks is allowed for workspace members (except VIEWERS)
create policy "Update tasks by workspace participants"
  on public.tasks for update
  to authenticated
  using (
    exists (
      select 1 from public.projects
      join public.workspace_members on workspace_members.workspace_id = projects.workspace_id
      where projects.id = tasks.project_id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN', 'PROJECT_MANAGER', 'MEMBER')
    )
  );

-- Delete tasks is limited to OWNER, ADMIN, and PROJECT_MANAGER roles
create policy "Delete tasks by workspace managers"
  on public.tasks for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      join public.workspace_members on workspace_members.workspace_id = projects.workspace_id
      where projects.id = tasks.project_id
      and workspace_members.profile_id = auth.uid()
      and workspace_members.role in ('OWNER', 'ADMIN', 'PROJECT_MANAGER')
    )
  );


-- ==========================================
-- 6. CHANNELS & MESSAGES POLICIES
-- ==========================================
-- Channels are selectable by workspace members
create policy "Select channels by workspace members"
  on public.channels for select
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = channels.workspace_id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Create channel is allowed for workspace members
create policy "Insert channels by workspace members"
  on public.channels for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspace_id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Messages are selectable by channel workspace members
create policy "Select messages by channel workspace members"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.channels
      join public.workspace_members on workspace_members.workspace_id = channels.workspace_id
      where channels.id = messages.channel_id
      and workspace_members.profile_id = auth.uid()
    )
  );

-- Insert messages is allowed if user is member of the workspace channel
create policy "Insert messages by channel workspace members"
  on public.messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.channels
      join public.workspace_members on workspace_members.workspace_id = channels.workspace_id
      where channels.id = channel_id
      and workspace_members.profile_id = auth.uid()
    )
  );


-- ==========================================
-- 7. NOTIFICATIONS POLICIES
-- ==========================================
-- Notifications are isolated to the specific profile owner
create policy "Notifications restricted to owner"
  on public.notifications for all
  to authenticated
  using (auth.uid() = profile_id);
