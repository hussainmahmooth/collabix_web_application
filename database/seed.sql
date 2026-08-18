-- Collabix Database Seed Data
-- Run this script in the Supabase SQL Editor to populate demo data.
-- Note: Make sure schema migration (01_schema.sql) has been run first.

-- 1. Create a Demo Workspace (if not exists)
insert into public.workspaces (id, name, slug, created_by)
values (
  'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11',
  'Collabix Main Workspace',
  'collabix-main',
  null -- will be linked after user registration
)
on conflict (slug) do nothing;

-- 2. Create Workspace Labels
insert into public.labels (id, workspace_id, name, color)
values 
  ('d1111111-1111-1111-1111-111111111111', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'Bug', '#dc2626'),
  ('d2222222-2222-2222-2222-222222222222', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'Feature', '#2563EB'),
  ('d3333333-3333-3333-3333-333333333333', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'Documentation', '#667085'),
  ('d4444444-4444-4444-4444-444444444444', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'Design', '#facc15')
on conflict (workspace_id, name) do nothing;

-- 3. Create Demo Projects
insert into public.projects (id, workspace_id, name, description, status, progress, start_date, due_date)
values 
  (
    'p1111111-1111-1111-1111-111111111111', 
    'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 
    'E-Commerce Platform', 
    'Customer shopping interface and checkout flow redesign.', 
    'ACTIVE', 
    72, 
    current_date - interval '30 days', 
    current_date + interval '10 days'
  ),
  (
    'p2222222-2222-2222-2222-222222222222', 
    'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 
    'Mobile Banking App', 
    'Secure iOS/Android mobile banking application experience.', 
    'ACTIVE', 
    48, 
    current_date - interval '15 days', 
    current_date + interval '20 days'
  ),
  (
    'p3333333-3333-3333-3333-333333333333', 
    'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 
    'Analytics Dashboard', 
    'Business intelligence dashboard and analytics portal reporting tools.', 
    'ACTIVE', 
    86, 
    current_date - interval '20 days', 
    current_date + interval '6 days'
  )
on conflict (id) do nothing;

-- 4. Create Project Milestones
insert into public.project_milestones (id, project_id, title, description, due_date, is_completed)
values
  ('m1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'UI/UX Signoff', 'Finalize wireframes and flow diagrams.', current_date - interval '10 days', true),
  ('m2222222-2222-2222-2222-222222222222', 'p1111111-1111-1111-1111-111111111111', 'Checkout Release', 'Deploy new basket and secure checkout flow.', current_date + interval '5 days', false),
  ('m3333333-3333-3333-3333-333333333333', 'p2222222-2222-2222-2222-222222222222', 'Auth Flow Review', 'Audit login protocols and multi-factor access.', current_date + interval '8 days', false)
on conflict (id) do nothing;

-- 5. Create Default Channels
insert into public.channels (id, workspace_id, name, is_dm)
values 
  ('c1111111-1111-1111-1111-111111111111', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'general', false),
  ('c2222222-2222-2222-2222-222222222222', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'project-ecommerce', false),
  ('c3333333-3333-3333-3333-333333333333', 'e6c0c20a-8d77-4cf2-bc17-ec30a613aa11', 'project-banking', false)
on conflict (id) do nothing;
