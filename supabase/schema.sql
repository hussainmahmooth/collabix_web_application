-- ResearchFlow MVP 1. Additive: legacy Collabix tables remain untouched.
create schema if not exists rf_private;
revoke all on schema rf_private from public;
grant usage on schema rf_private to authenticated;

create table public.rf_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(full_name) between 1 and 120),
 skills text not null default '', created_at timestamptz not null default now()
);
create table public.rf_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120),
 research_title text not null default '', institution text not null default '', department text not null default '',
 programme text not null default '', supervisor_details text not null default '', description text not null default '',
 logo_path text, accent_color text not null default '#168e88' check(accent_color ~ '^#[0-9a-fA-F]{6}$'),
 start_date date, deadline date, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(deadline is null or start_date is null or deadline >= start_date)
);
create table public.rf_workspace_members (
 workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 user_id uuid not null references public.rf_profiles(id),
 role text not null check(role in ('leader','member','supervisor')),
 responsibilities text not null default '', created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index rf_members_user_idx on public.rf_workspace_members(user_id);
create table public.rf_workspace_invitations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 email text not null, role text not null check(role in ('member','supervisor')),
 token uuid not null unique default gen_random_uuid(), expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create table public.rf_research_phases (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 name text not null check(length(name) between 1 and 200), description text not null default '', objectives text not null default '',
 start_date date, deadline date, owner_id uuid, position integer not null default 0,
 status text not null default 'To Do' check(status in ('To Do','In Progress','Completed')),
 review_state text not null default 'Not requested' check(review_state in ('Not requested','In Review','Revision Requested','Approved')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id), foreign key(workspace_id,owner_id) references public.rf_workspace_members(workspace_id,user_id),
 check(deadline is null or start_date is null or deadline >= start_date)
);
create table public.rf_tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 phase_id uuid, title text not null check(length(title) between 1 and 200), description text not null default '',
 assignee_id uuid, status text not null default 'To Do' check(status in ('To Do','In Progress','Blocked','In Review','Completed')),
 priority text not null default 'Medium' check(priority in ('Low','Medium','High','Critical')),
 due_date date, estimated_hours numeric check(estimated_hours > 0), archived boolean not null default false,
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,phase_id) references public.rf_research_phases(workspace_id,id),
 foreign key(workspace_id,assignee_id) references public.rf_workspace_members(workspace_id,user_id)
);
create index rf_tasks_workspace_idx on public.rf_tasks(workspace_id,due_date);
create index rf_phases_workspace_idx on public.rf_research_phases(workspace_id);
create index rf_invitations_workspace_idx on public.rf_workspace_invitations(workspace_id);
create table public.rf_audit_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 actor_id uuid references auth.users(id), action text not null, entity_id text not null, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index rf_audit_workspace_idx on public.rf_audit_events(workspace_id,created_at desc);

-- Definer helpers are confined to a non-exposed schema; all check authenticated identity.
create function rf_private.has_role(w uuid, roles text[] default array['leader','member','supervisor']) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.rf_workspace_members m where m.workspace_id=w and m.user_id=auth.uid() and m.role=any(roles));
$$;
create function rf_private.shares_workspace(other_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.rf_workspace_members a join public.rf_workspace_members b on a.workspace_id=b.workspace_id where a.user_id=auth.uid() and b.user_id=other_user);
$$;
create function rf_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; w uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 row_data=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 w=case when TG_TABLE_NAME='rf_workspaces' then (row_data->>'id')::uuid else (row_data->>'workspace_id')::uuid end;
 insert into public.rf_audit_events(workspace_id,actor_id,action,entity_id,details) values(w,auth.uid(),TG_TABLE_NAME||'.'||TG_OP,coalesce(row_data->>'id',row_data->>'user_id'),jsonb_build_object('operation',TG_OP));
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create function rf_private.guard_update() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id<>old.id then raise exception 'Identity is immutable'; end if;
 if TG_TABLE_NAME='rf_workspaces' then
  if new.created_by<>old.created_by then raise exception 'Creator is immutable'; end if;
 else
  if new.workspace_id<>old.workspace_id then raise exception 'Workspace is immutable'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
create function rf_private.guard_task() returns trigger language plpgsql set search_path='' as $$
begin
 if new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'Creator and creation time are immutable'; end if;
 if not rf_private.has_role(old.workspace_id,array['leader']) then
  if new.title<>old.title or new.description<>old.description or new.assignee_id is distinct from old.assignee_id or new.phase_id is distinct from old.phase_id or new.priority<>old.priority or new.due_date is distinct from old.due_date or new.estimated_hours is distinct from old.estimated_hours or new.archived<>old.archived then raise exception 'Only leaders can change task details'; end if;
  if old.status='Completed' or new.status='Completed' then raise exception 'Leader approval is required for completion'; end if;
 end if; return new;
end $$;

alter table public.rf_profiles enable row level security;
create policy profile_read on public.rf_profiles for select to authenticated using(id=auth.uid() or rf_private.shares_workspace(id));
create policy profile_insert on public.rf_profiles for insert to authenticated with check(id=auth.uid());
create policy profile_update on public.rf_profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
alter table public.rf_workspaces enable row level security;
create policy workspace_read on public.rf_workspaces for select to authenticated using(rf_private.has_role(id));
create policy workspace_update on public.rf_workspaces for update to authenticated using(rf_private.has_role(id,array['leader'])) with check(rf_private.has_role(id,array['leader']));
alter table public.rf_workspace_members enable row level security;
create policy member_read on public.rf_workspace_members for select to authenticated using(rf_private.has_role(workspace_id));
-- Membership writes only through guarded RPCs: no direct insert/update/delete grants.
alter table public.rf_workspace_invitations enable row level security;
create policy invite_read on public.rf_workspace_invitations for select to authenticated using(rf_private.has_role(workspace_id,array['leader']));
create policy invite_insert on public.rf_workspace_invitations for insert to authenticated with check(rf_private.has_role(workspace_id,array['leader']) and created_by=auth.uid() and expires_at<=now()+interval '7 days' and accepted_at is null);
create policy invite_delete on public.rf_workspace_invitations for delete to authenticated using(rf_private.has_role(workspace_id,array['leader']));
alter table public.rf_research_phases enable row level security;
create policy phase_read on public.rf_research_phases for select to authenticated using(rf_private.has_role(workspace_id));
create policy phase_insert on public.rf_research_phases for insert to authenticated with check(rf_private.has_role(workspace_id,array['leader']));
create policy phase_update on public.rf_research_phases for update to authenticated using(rf_private.has_role(workspace_id,array['leader'])) with check(rf_private.has_role(workspace_id,array['leader']));
alter table public.rf_tasks enable row level security;
create policy task_read on public.rf_tasks for select to authenticated using(rf_private.has_role(workspace_id));
create policy task_insert on public.rf_tasks for insert to authenticated with check(rf_private.has_role(workspace_id,array['leader']) and created_by=auth.uid());
create policy task_update on public.rf_tasks for update to authenticated using(rf_private.has_role(workspace_id,array['leader']) or (assignee_id=auth.uid() and rf_private.has_role(workspace_id,array['member']))) with check(rf_private.has_role(workspace_id,array['leader']) or (assignee_id=auth.uid() and rf_private.has_role(workspace_id,array['member'])));
alter table public.rf_audit_events enable row level security;
create policy audit_read on public.rf_audit_events for select to authenticated using(rf_private.has_role(workspace_id));

create function rf_private.create_workspace(team_name text, title text, full_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid; phase text; i integer=0;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verified account required'; end if;
 insert into public.rf_profiles(id,full_name) values(auth.uid(),full_name) on conflict(id) do nothing;
 insert into public.rf_workspaces(name,research_title,created_by) values(trim(team_name),title,auth.uid()) returning id into w;
 insert into public.rf_workspace_members(workspace_id,user_id,role) values(w,auth.uid(),'leader');
 foreach phase in array array['Research Foundation and Title Submission','Literature Review','Dataset Collection and Preparation','Machine Learning Development and Evaluation','Prototype Development','Research Paper and Symposium Preparation','Commercial Product Roadmap'] loop
  insert into public.rf_research_phases(workspace_id,name,position) values(w,phase,i); i=i+1;
 end loop; return w;
end $$;
create function rf_private.accept_invitation(invite_token uuid, full_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.rf_workspace_invitations; account_email text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select email into account_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into inv from public.rf_workspace_invitations where token=invite_token and lower(email)=lower(account_email) and accepted_at is null and expires_at>now() for update;
 if inv.id is null then raise exception 'Invitation invalid, expired, already accepted, or addressed to another verified email'; end if;
 insert into public.rf_profiles(id,full_name) values(auth.uid(),full_name) on conflict(id) do nothing;
 insert into public.rf_workspace_members(workspace_id,user_id,role) values(inv.workspace_id,auth.uid(),inv.role);
 update public.rf_workspace_invitations set accepted_at=now() where id=inv.id;
 return inv.workspace_id;
end $$;
create function rf_private.manage_member(w uuid, target uuid, new_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not rf_private.has_role(w,array['leader']) then raise exception 'Leader access required'; end if;
 -- Workspace creator remains leader; additional leaders can be appointed or removed.
 if exists(select 1 from public.rf_workspaces where id=w and created_by=target) then raise exception 'The founding leader cannot be removed or demoted'; end if;
 if new_role is null then
  update public.rf_tasks set assignee_id=null where workspace_id=w and assignee_id=target;
  update public.rf_research_phases set owner_id=null where workspace_id=w and owner_id=target;
  delete from public.rf_workspace_members where workspace_id=w and user_id=target;
 elsif new_role in ('leader','member','supervisor') then update public.rf_workspace_members set role=new_role where workspace_id=w and user_id=target;
 else raise exception 'Invalid role'; end if;
end $$;

create function public.rf_create_workspace(team_name text,title text,full_name text) returns uuid language sql security invoker set search_path='' as $$ select rf_private.create_workspace(team_name,title,full_name); $$;
create function public.rf_accept_invitation(invite_token uuid,full_name text) returns uuid language sql security invoker set search_path='' as $$ select rf_private.accept_invitation(invite_token,full_name); $$;
create function public.rf_manage_member(w uuid,target uuid,new_role text) returns void language sql security invoker set search_path='' as $$ select rf_private.manage_member(w,target,new_role); $$;

do $$ declare t text; begin
 foreach t in array array['rf_workspaces','rf_research_phases','rf_tasks'] loop
 execute format('create trigger guard_update before update on public.%I for each row execute function rf_private.guard_update()',t);
 end loop;
 foreach t in array array['rf_workspaces','rf_workspace_members','rf_workspace_invitations','rf_research_phases','rf_tasks'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function rf_private.audit_change()',t);
 end loop;
end $$;
create trigger guard_task before update on public.rf_tasks for each row execute function rf_private.guard_task();
revoke all on all functions in schema rf_private from public,anon;
grant execute on all functions in schema rf_private to authenticated;
revoke all on function public.rf_create_workspace(text,text,text),public.rf_accept_invitation(uuid,text),public.rf_manage_member(uuid,uuid,text) from public,anon;
grant execute on function public.rf_create_workspace(text,text,text),public.rf_accept_invitation(uuid,text),public.rf_manage_member(uuid,uuid,text) to authenticated;
revoke all on public.rf_profiles,public.rf_workspaces,public.rf_workspace_members,public.rf_workspace_invitations,public.rf_research_phases,public.rf_tasks,public.rf_audit_events from anon,authenticated;
grant select,insert,update on public.rf_profiles to authenticated;
grant select,update on public.rf_workspaces to authenticated;
grant select on public.rf_workspace_members,public.rf_audit_events to authenticated;
grant select,insert,delete on public.rf_workspace_invitations to authenticated;
grant select,insert,update on public.rf_research_phases,public.rf_tasks to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('researchflow-logos','researchflow-logos',false,2097152,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy rf_logo_read on storage.objects for select to authenticated using(bucket_id='researchflow-logos' and rf_private.has_role((storage.foldername(name))[1]::uuid));
create policy rf_logo_insert on storage.objects for insert to authenticated with check(bucket_id='researchflow-logos' and rf_private.has_role((storage.foldername(name))[1]::uuid,array['leader']));
-- Immutable file paths: upload new logo versions, never overwrite.
