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
-- Limit each workspace to six accepted memberships, counting every role.
-- Pending invitations do not reserve seats. Acceptance is checked atomically.
create function rf_private.guard_member_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 -- Serialize admissions for this workspace, including concurrent invitations.
 perform id from public.rf_workspaces where id=new.workspace_id for update;
 if (select count(*) from public.rf_workspace_members where workspace_id=new.workspace_id)>=6 then
  raise exception using errcode='23514', message='This workspace has reached its limit of 6 members, including leaders and supervisors. Remove a member before inviting someone else.';
 end if;
 return new;
end $$;
revoke all on function rf_private.guard_member_limit() from public,anon,authenticated;
create trigger guard_member_limit before insert on public.rf_workspace_members
for each row execute function rf_private.guard_member_limit();
create trigger guard_invitation_capacity before insert on public.rf_workspace_invitations
for each row execute function rf_private.guard_member_limit();
-- Six team members (leaders included) plus one academic supervisor.
create or replace function rf_private.guard_member_limit() returns trigger
language plpgsql security definer set search_path='' as $$
declare excluded_user uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform id from public.rf_workspaces where id=new.workspace_id for update;
 if TG_TABLE_NAME='rf_workspace_members' then excluded_user=new.user_id; end if;
 if new.role='supervisor' then
  if (select count(*) from public.rf_workspace_members where workspace_id=new.workspace_id and role='supervisor' and (excluded_user is null or user_id<>excluded_user))>=1 then
   raise exception using errcode='23514', message='This workspace already has its academic supervisor. Only one supervisor is allowed.';
  end if;
 else
  if (select count(*) from public.rf_workspace_members where workspace_id=new.workspace_id and role in ('leader','member') and (excluded_user is null or user_id<>excluded_user))>=6 then
   raise exception using errcode='23514', message='All 6 team places are filled, including the leader. The separate supervisor place can only be used by a supervisor.';
  end if;
 end if;
 return new;
end $$;
revoke all on function rf_private.guard_member_limit() from public,anon,authenticated;
-- Role changes must obey the same quotas as new memberships.
create trigger guard_member_role_capacity before update of role,workspace_id on public.rf_workspace_members
for each row execute function rf_private.guard_member_limit();

-- MVP 2 collaboration tables, private storage and guarded workflows.
-- ResearchFlow MVP 2: additive collaboration model. No legacy tables changed.
create table public.rf_channels (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), archived boolean not null default false,
 created_by uuid references public.rf_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,name)
);
create table public.rf_messages (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, channel_id uuid not null, author_id uuid not null references public.rf_profiles(id),
 body text not null check(length(body)<=10000), reply_to uuid, deleted boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,channel_id,id), unique(workspace_id,id),
 foreign key(workspace_id,channel_id) references public.rf_channels(workspace_id,id),
 foreign key(workspace_id,channel_id,reply_to) references public.rf_messages(workspace_id,channel_id,id)
);
create index rf_messages_channel_time on public.rf_messages(workspace_id,channel_id,created_at);
create table public.rf_channel_reads (
 workspace_id uuid not null, channel_id uuid not null, user_id uuid not null references public.rf_profiles(id), last_read_at timestamptz not null default now(),
 primary key(workspace_id,channel_id,user_id), foreign key(workspace_id,channel_id) references public.rf_channels(workspace_id,id)
);
create table public.rf_document_folders (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 120), unique(workspace_id,id), unique(workspace_id,name)
);
-- Add a composite target key without changing task behavior.
alter table public.rf_tasks add constraint rf_tasks_workspace_id_key unique(workspace_id,id);
create table public.rf_documents (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 folder_id uuid not null, title text not null check(length(trim(title)) between 1 and 200), created_by uuid not null references public.rf_profiles(id),
 restricted boolean not null default false, archived boolean not null default false, phase_id uuid, task_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,folder_id) references public.rf_document_folders(workspace_id,id),
 foreign key(workspace_id,phase_id) references public.rf_research_phases(workspace_id,id), foreign key(workspace_id,task_id) references public.rf_tasks(workspace_id,id)
);
create table public.rf_document_access (
 workspace_id uuid not null, document_id uuid not null, user_id uuid not null references public.rf_profiles(id),
 primary key(workspace_id,document_id,user_id), foreign key(workspace_id,document_id) references public.rf_documents(workspace_id,id)
);
create table public.rf_announcements (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), body text not null check(length(trim(body)) between 1 and 10000),
 priority text not null default 'Normal' check(priority in ('Normal','Important','Urgent')), pinned boolean not null default false, archived boolean not null default false,
 author_id uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id)
);
create table public.rf_announcement_reads (
 workspace_id uuid not null, announcement_id uuid not null, user_id uuid not null references public.rf_profiles(id), read_at timestamptz not null default now(),
 primary key(workspace_id,announcement_id,user_id), foreign key(workspace_id,announcement_id) references public.rf_announcements(workspace_id,id)
);
create table public.rf_files (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 owner_id uuid not null references public.rf_profiles(id), path text not null unique, name text not null check(length(name) between 1 and 255),
 mime text not null, bytes bigint not null check(bytes between 1 and 20971520), document_id uuid, message_id uuid, announcement_id uuid,
 created_at timestamptz not null default now(), unique(workspace_id,id), check(num_nonnulls(document_id,message_id,announcement_id)=1),
 foreign key(workspace_id,document_id) references public.rf_documents(workspace_id,id),
 foreign key(workspace_id,message_id) references public.rf_messages(workspace_id,id), foreign key(workspace_id,announcement_id) references public.rf_announcements(workspace_id,id)
);
create table public.rf_document_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, document_id uuid not null, file_id uuid not null unique,
 version integer not null check(version>0), notes text not null default '' check(length(notes)<=2000), author_id uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(document_id,version),
 foreign key(workspace_id,document_id) references public.rf_documents(workspace_id,id), foreign key(workspace_id,file_id) references public.rf_files(workspace_id,id)
);
create table public.rf_document_comments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, document_id uuid not null, author_id uuid not null references public.rf_profiles(id),
 body text not null check(length(trim(body)) between 1 and 5000), created_at timestamptz not null default now(),
 foreign key(workspace_id,document_id) references public.rf_documents(workspace_id,id)
);
create table public.rf_meetings (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), description text not null default '' check(length(description)<=10000),
 type text not null check(type in ('Team Meeting','Supervisor Meeting','Research Review','Technical Discussion','Other')),
 starts_at timestamptz not null, ends_at timestamptz not null, timezone text not null, location text not null default '' check(length(location)<=1000),
 agenda text not null default '' check(length(agenda)<=10000), organizer_id uuid not null references public.rf_profiles(id), cancelled boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_at>starts_at), unique(workspace_id,id)
);
create table public.rf_meeting_participants (
 workspace_id uuid not null, meeting_id uuid not null, user_id uuid not null references public.rf_profiles(id),
 primary key(workspace_id,meeting_id,user_id), foreign key(workspace_id,meeting_id) references public.rf_meetings(workspace_id,id)
);
create table public.rf_meeting_notes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, meeting_id uuid not null, author_id uuid not null references public.rf_profiles(id),
 kind text not null check(kind in ('Minutes','Decision','Comment')), body text not null check(length(trim(body)) between 1 and 10000), created_at timestamptz not null default now(),
 foreign key(workspace_id,meeting_id) references public.rf_meetings(workspace_id,id)
);
create table public.rf_meeting_actions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, meeting_id uuid not null, title text not null check(length(trim(title)) between 1 and 200),
 assignee_id uuid not null references public.rf_profiles(id), due_date date not null, task_id uuid, created_by uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(),
 unique(workspace_id,id), foreign key(workspace_id,meeting_id) references public.rf_meetings(workspace_id,id), foreign key(workspace_id,task_id) references public.rf_tasks(workspace_id,id)
);
create table public.rf_submissions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 version_id uuid, phase_id uuid, requested_by uuid not null references public.rf_profiles(id),
 status text not null default 'Submitted for Review' check(status in ('Submitted for Review','Revision Requested','Approved','Rejected')),
 internal_status text not null default 'Submitted for Review' check(internal_status in ('Submitted for Review','Revision Requested','Approved','Rejected')),
 created_at timestamptz not null default now(), unique(workspace_id,id), check(num_nonnulls(version_id,phase_id)=1),
 foreign key(workspace_id,version_id) references public.rf_document_versions(workspace_id,id), foreign key(workspace_id,phase_id) references public.rf_research_phases(workspace_id,id)
);
create table public.rf_reviews (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, submission_id uuid not null,
 reviewer_id uuid not null references public.rf_profiles(id), kind text not null check(kind in ('Academic','Internal')),
 decision text not null check(decision in ('Approved','Revision Requested','Rejected')), feedback text not null check(length(trim(feedback)) between 1 and 10000), created_at timestamptz not null default now(),
 unique(submission_id,kind), foreign key(workspace_id,submission_id) references public.rf_submissions(workspace_id,id)
);
create unique index rf_pending_document_review on public.rf_submissions(workspace_id,version_id) where status='Submitted for Review' and version_id is not null;
create unique index rf_pending_phase_review on public.rf_submissions(workspace_id,phase_id) where status='Submitted for Review' and phase_id is not null;

create function rf_private.can_document(w uuid,d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and rf_private.has_role(w) and exists(select 1 from public.rf_documents x where x.workspace_id=w and x.id=d and
 (not x.restricted or x.created_by=auth.uid() or rf_private.has_role(w,array['leader','supervisor']) or exists(select 1 from public.rf_document_access a where a.workspace_id=w and a.document_id=d and a.user_id=auth.uid())));
$$;
create function rf_private.can_file(w uuid,f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and rf_private.has_role(w) and exists(select 1 from public.rf_files x where x.workspace_id=w and x.id=f and
 ((x.document_id is not null and rf_private.can_document(w,x.document_id)) or (x.message_id is not null and exists(select 1 from public.rf_messages m where m.id=x.message_id and m.workspace_id=w and not m.deleted)) or x.announcement_id is not null));
$$;
create function rf_private.can_submission(w uuid,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and rf_private.has_role(w) and exists(select 1 from public.rf_submissions x where x.id=s and x.workspace_id=w and
 (x.phase_id is not null or exists(select 1 from public.rf_document_versions v where v.id=x.version_id and v.workspace_id=w and rf_private.can_document(w,v.document_id))));
$$;
create function rf_private.seed_collaboration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.rf_channels(workspace_id,name,created_by) select new.workspace_id,n,new.user_id from unnest(array['General Discussion','Research Planning','Literature Review','Dataset and Analysis','AI Development','Prototype Development','Research Paper']) n on conflict(workspace_id,name) do nothing;
 insert into public.rf_document_folders(workspace_id,name) select new.workspace_id,n from unnest(array['Research Proposal','Literature Review','Dataset Documentation','Methodology','Machine Learning Experiments','System Design','Prototype Documentation','Research Paper','Meeting Minutes','Presentation Materials']) n on conflict(workspace_id,name) do nothing;
 return new;
end $$;
-- Backfill defaults before audit triggers exist; no user content is manufactured.
insert into public.rf_channels(workspace_id,name,created_by) select w.id,n,w.created_by from public.rf_workspaces w cross join unnest(array['General Discussion','Research Planning','Literature Review','Dataset and Analysis','AI Development','Prototype Development','Research Paper']) n;
insert into public.rf_document_folders(workspace_id,name) select w.id,n from public.rf_workspaces w cross join unnest(array['Research Proposal','Literature Review','Dataset Documentation','Methodology','Machine Learning Experiments','System Design','Prototype Documentation','Research Paper','Meeting Minutes','Presentation Materials']) n;
create trigger rf_seed_collaboration after insert on public.rf_workspace_members for each row execute function rf_private.seed_collaboration();

-- Browser writes must use the guarded atomic workflow RPC. All reads are RLS-scoped.
do $$ declare t text; begin
 foreach t in array array['rf_channels','rf_messages','rf_channel_reads','rf_document_folders','rf_documents','rf_document_access','rf_announcements','rf_announcement_reads','rf_files','rf_document_versions','rf_document_comments','rf_meetings','rf_meeting_participants','rf_meeting_notes','rf_meeting_actions','rf_submissions','rf_reviews'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create index %I on public.%I(workspace_id)',t||'_workspace_idx',t);
 end loop;
 foreach t in array array['rf_channels','rf_messages','rf_document_folders','rf_announcements','rf_meetings','rf_meeting_participants','rf_meeting_notes','rf_meeting_actions'] loop
 execute format('create policy workspace_read on public.%I for select to authenticated using(rf_private.has_role(workspace_id))',t);
 end loop;
 foreach t in array array['rf_channels','rf_documents','rf_document_versions','rf_document_comments','rf_meetings','rf_meeting_notes','rf_meeting_actions','rf_announcements','rf_submissions','rf_reviews'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function rf_private.audit_change()',t);
 end loop;
end $$;
create policy own_read on public.rf_channel_reads for select to authenticated using(user_id=(select auth.uid()) and rf_private.has_role(workspace_id));
create policy own_read on public.rf_announcement_reads for select to authenticated using(user_id=(select auth.uid()) and rf_private.has_role(workspace_id));
create policy document_read on public.rf_documents for select to authenticated using(rf_private.can_document(workspace_id,id));
create policy document_read on public.rf_document_access for select to authenticated using(rf_private.can_document(workspace_id,document_id));
create policy document_read on public.rf_document_versions for select to authenticated using(rf_private.can_document(workspace_id,document_id));
create policy document_read on public.rf_document_comments for select to authenticated using(rf_private.can_document(workspace_id,document_id));
create policy file_read on public.rf_files for select to authenticated using(rf_private.can_file(workspace_id,id));
create policy submission_read on public.rf_submissions for select to authenticated using(rf_private.can_submission(workspace_id,id));
create policy review_read on public.rf_reviews for select to authenticated using(rf_private.can_submission(workspace_id,submission_id));
create view public.rf_channel_unread with (security_invoker=true) as
 select c.workspace_id,c.id as channel_id,count(m.id)::integer as unread_count
 from public.rf_channels c
 left join public.rf_channel_reads r on r.workspace_id=c.workspace_id and r.channel_id=c.id and r.user_id=auth.uid()
 left join public.rf_messages m on m.workspace_id=c.workspace_id and m.channel_id=c.id and not m.deleted and m.author_id<>auth.uid() and m.created_at>coalesce(r.last_read_at,'epoch'::timestamptz)
 group by c.workspace_id,c.id;
revoke all on public.rf_channel_unread from public,anon;
grant select on public.rf_channel_unread to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('researchflow-files','researchflow-files',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv','text/plain','text/markdown','image/png','image/jpeg','image/webp','image/gif']) on conflict(id) do nothing;
create function rf_private.valid_upload(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare bits text[]; begin
 if auth.uid() is null or path like '%..%' then return false; end if;
 bits=string_to_array(path,'/');
 if array_length(bits,1)<>3 or bits[2]<>auth.uid()::text or bits[3] !~ '^[0-9a-f-]{36}\.(pdf|docx|xlsx|csv|txt|md|png|jpg|jpeg|webp|gif)$' then return false; end if;
 return rf_private.has_role(bits[1]::uuid);
exception when invalid_text_representation then return false;
end $$;
create policy rf_file_insert on storage.objects for insert to authenticated with check(bucket_id='researchflow-files' and rf_private.valid_upload(name));
create policy rf_file_read on storage.objects for select to authenticated using(bucket_id='researchflow-files' and exists(select 1 from public.rf_files f where f.path=name and rf_private.can_file(f.workspace_id,f.id)));
create function rf_private.unregistered_upload(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and rf_private.valid_upload(path) and not exists(select 1 from public.rf_files f where f.path=$1);
$$;
-- Unregistered failed uploads may be removed only by their original uploader.
create policy rf_file_cleanup_read on storage.objects for select to authenticated using(bucket_id='researchflow-files' and rf_private.unregistered_upload(name));
create policy rf_file_cleanup on storage.objects for delete to authenticated using(bucket_id='researchflow-files' and rf_private.unregistered_upload(name));

create function rf_private.collaborate(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w uuid=(p->>'workspace_id')::uuid; u uuid=auth.uid(); id uuid; row_id uuid=(p->>'id')::uuid; d uuid; v uuid; f uuid; m uuid; n integer;
 leader boolean; supervisor boolean; r record; obj record; people uuid[]; person uuid; path text; mime text; size bigint; ext text;
begin
 if u is null or not rf_private.has_role(w) then raise exception 'Workspace access required' using errcode='42501'; end if;
 leader=rf_private.has_role(w,array['leader']); supervisor=rf_private.has_role(w,array['supervisor']);
 case action
 when 'channel_save' then
  if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  if row_id is null then insert into public.rf_channels(workspace_id,name,created_by) values(w,trim(p->>'name'),u) returning rf_channels.id into id;
  else update public.rf_channels set name=trim(p->>'name'),archived=coalesce((p->>'archived')::boolean,false),updated_at=now() where workspace_id=w and rf_channels.id=row_id returning rf_channels.id into id; end if;
 when 'message_send' then
  if not exists(select 1 from public.rf_channels where workspace_id=w and rf_channels.id=(p->>'channel_id')::uuid and not archived) then raise exception 'Choose an active workspace channel'; end if;
  insert into public.rf_messages(workspace_id,channel_id,author_id,body,reply_to) values(w,(p->>'channel_id')::uuid,u,trim(p->>'body'),(p->>'reply_to')::uuid) returning rf_messages.id into id;
  if length(trim(p->>'body'))=0 then raise exception 'Message cannot be empty'; end if;
 when 'message_edit','message_delete' then
  select * into r from public.rf_messages where workspace_id=w and rf_messages.id=row_id for update;
  if r.id is null or not (r.author_id=u or (leader and action='message_delete')) or r.deleted then raise exception 'Message permission denied' using errcode='42501'; end if;
  if action='message_edit' and length(trim(p->>'body'))=0 then raise exception 'Message cannot be empty'; end if;
  update public.rf_messages set body=case when action='message_delete' then '' else trim(p->>'body') end,deleted=(action='message_delete'),updated_at=now() where rf_messages.id=row_id returning rf_messages.id into id;
 when 'channel_read' then
  insert into public.rf_channel_reads(workspace_id,channel_id,user_id,last_read_at) values(w,(p->>'channel_id')::uuid,u,least(now(),(p->>'last_read_at')::timestamptz)) on conflict(workspace_id,channel_id,user_id) do update set last_read_at=greatest(rf_channel_reads.last_read_at,excluded.last_read_at);
  id=(p->>'channel_id')::uuid;
 when 'document_create' then
  if supervisor then raise exception 'Supervisors review team submissions; only team members create documents'; end if;
  insert into public.rf_documents(workspace_id,folder_id,title,created_by,restricted,phase_id,task_id) values(w,(p->>'folder_id')::uuid,trim(p->>'title'),u,coalesce((p->>'restricted')::boolean,false),(p->>'phase_id')::uuid,(p->>'task_id')::uuid) returning rf_documents.id into id;
 when 'document_access' then
  select * into r from public.rf_documents where workspace_id=w and rf_documents.id=row_id for update;
  if r.id is null or not(leader or r.created_by=u) then raise exception 'Document permission denied' using errcode='42501'; end if;
  people=array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p->'readers','[]')) x);
  if exists(select 1 from unnest(people) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Readers must belong to this workspace'; end if;
  update public.rf_documents set restricted=(p->>'restricted')::boolean,updated_at=now() where rf_documents.id=row_id;
  delete from public.rf_document_access where workspace_id=w and document_id=row_id;
  insert into public.rf_document_access select w,row_id,x from unnest(people) x; id=row_id;
 when 'document_archive' then
  if not leader then raise exception 'Only leaders can archive documents' using errcode='42501'; end if;
  update public.rf_documents set archived=true,updated_at=now() where workspace_id=w and rf_documents.id=row_id returning rf_documents.id into id;
 when 'file_register' then
  path=p->>'path';
  if not rf_private.valid_upload(path) or split_part(path,'/',1)<>w::text then raise exception 'Invalid file path'; end if;
  select metadata into obj from storage.objects where bucket_id='researchflow-files' and name=path;
  if obj is null then raise exception 'Upload the file before registering it'; end if;
  mime=obj.metadata->>'mimetype'; size=(obj.metadata->>'size')::bigint; ext=lower(split_part(path,'.',2));
  if size is null or size<1 or size>20971520 or mime is null or not exists(select 1 from storage.buckets b where b.id='researchflow-files' and mime=any(b.allowed_mime_types)) then raise exception 'Unsupported file type or size'; end if;
  if not ((ext='pdf' and mime='application/pdf') or (ext='docx' and mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (ext='xlsx' and mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or (ext in ('csv','txt','md') and mime in ('text/csv','text/plain','text/markdown')) or (ext in ('jpg','jpeg') and mime='image/jpeg') or (ext in ('png','webp','gif') and mime='image/'||ext)) then raise exception 'File extension and content type do not match'; end if;
  d=(p->>'document_id')::uuid; m=(p->>'message_id')::uuid; v=(p->>'announcement_id')::uuid;
  if num_nonnulls(d,m,v)<>1 then raise exception 'Choose exactly one attachment target'; end if;
  if d is not null then
   select * into r from public.rf_documents where workspace_id=w and rf_documents.id=d for update;
   if r.id is null or r.archived or not rf_private.can_document(w,d) or supervisor then raise exception 'Document upload permission denied' using errcode='42501'; end if;
  elsif m is not null then
   if not exists(select 1 from public.rf_messages where workspace_id=w and rf_messages.id=m and author_id=u and not deleted) then raise exception 'Only attach files to your own messages'; end if;
  elsif not leader or not exists(select 1 from public.rf_announcements where workspace_id=w and rf_announcements.id=v) then raise exception 'Announcement permission denied'; end if;
  insert into public.rf_files(workspace_id,owner_id,path,name,mime,bytes,document_id,message_id,announcement_id) values(w,u,path,p->>'name',mime,size,d,m,v) returning rf_files.id into f;
  if d is not null then
   select coalesce(max(version),0)+1 into n from public.rf_document_versions where document_id=d;
   insert into public.rf_document_versions(workspace_id,document_id,file_id,version,notes,author_id) values(w,d,f,n,coalesce(p->>'notes',''),u) returning rf_document_versions.id into id;
   update public.rf_documents set updated_at=now() where rf_documents.id=d;
  else id=f; end if;
 when 'document_comment' then
  d=(p->>'document_id')::uuid;
  if not rf_private.can_document(w,d) then raise exception 'Document permission denied' using errcode='42501'; end if;
  insert into public.rf_document_comments(workspace_id,document_id,author_id,body) values(w,d,u,trim(p->>'body')) returning rf_document_comments.id into id;
 when 'meeting_save' then
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Use a valid IANA timezone'; end if;
  people=array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p->'participants','[]')) x);
  if exists(select 1 from unnest(people) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Participants must belong to this workspace'; end if;
  if row_id is null then
   insert into public.rf_meetings(workspace_id,title,description,type,starts_at,ends_at,timezone,location,agenda,organizer_id) values(w,trim(p->>'title'),coalesce(p->>'description',''),p->>'type',(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,p->>'timezone',coalesce(p->>'location',''),coalesce(p->>'agenda',''),u) returning rf_meetings.id into id;
  else
   select * into r from public.rf_meetings where workspace_id=w and rf_meetings.id=row_id for update;
   if r.id is null or not(leader or r.organizer_id=u) or r.cancelled then raise exception 'Meeting permission denied' using errcode='42501'; end if;
   update public.rf_meetings set title=trim(p->>'title'),description=coalesce(p->>'description',''),type=p->>'type',starts_at=(p->>'starts_at')::timestamptz,ends_at=(p->>'ends_at')::timestamptz,timezone=p->>'timezone',location=coalesce(p->>'location',''),agenda=coalesce(p->>'agenda',''),updated_at=now() where rf_meetings.id=row_id returning rf_meetings.id into id;
   delete from public.rf_meeting_participants where workspace_id=w and meeting_id=id;
  end if;
  insert into public.rf_meeting_participants select w,id,x from unnest(array_append(people,u)) x group by x;
 when 'meeting_cancel' then
  update public.rf_meetings set cancelled=true,updated_at=now() where workspace_id=w and rf_meetings.id=row_id and (organizer_id=u or leader) returning rf_meetings.id into id;
 when 'meeting_note','meeting_action' then
  m=(p->>'meeting_id')::uuid;
  select * into r from public.rf_meetings where workspace_id=w and rf_meetings.id=m;
  if r.id is null or r.cancelled then raise exception 'Choose an active meeting'; end if;
  if not(leader or r.organizer_id=u) and (action='meeting_action' or p->>'kind'<>'Comment') then raise exception 'Only organizers or leaders record minutes, decisions and actions' using errcode='42501'; end if;
  if action='meeting_note' then
   insert into public.rf_meeting_notes(workspace_id,meeting_id,author_id,kind,body) values(w,m,u,p->>'kind',trim(p->>'body')) returning rf_meeting_notes.id into id;
  else
   person=(p->>'assignee_id')::uuid;
   if not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=person and role in ('leader','member')) then raise exception 'Assign an action to a current team member'; end if;
   insert into public.rf_meeting_actions(workspace_id,meeting_id,title,assignee_id,due_date,created_by) values(w,m,trim(p->>'title'),person,(p->>'due_date')::date,u) returning rf_meeting_actions.id into id;
  end if;
 when 'action_convert' then
  if not leader then raise exception 'Leader access required to create tasks' using errcode='42501'; end if;
  select * into r from public.rf_meeting_actions where workspace_id=w and rf_meeting_actions.id=row_id for update;
  if r.id is null then raise exception 'Action not found'; end if;
  if r.task_id is not null then return jsonb_build_object('id',r.task_id); end if;
  if not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=r.assignee_id and role in ('leader','member')) then raise exception 'Reassign this action to a current team member'; end if;
  insert into public.rf_tasks(workspace_id,title,description,assignee_id,due_date,created_by) values(w,r.title,'Meeting action item',r.assignee_id,r.due_date,u) returning rf_tasks.id into id;
  update public.rf_meeting_actions set task_id=id where rf_meeting_actions.id=row_id;
 when 'review_request' then
  if supervisor then raise exception 'Supervisors cannot submit their own academic reviews'; end if;
  v=(p->>'version_id')::uuid; d=(p->>'phase_id')::uuid;
  if num_nonnulls(v,d)<>1 then raise exception 'Select a document version or research phase'; end if;
  if v is not null then
   select x.* into r from public.rf_document_versions x join public.rf_documents y on y.id=x.document_id where x.id=v and x.workspace_id=w and not y.archived;
   if r.id is null or not rf_private.can_document(w,r.document_id) or not(leader or r.author_id=u) then raise exception 'Submission permission denied' using errcode='42501'; end if;
  elsif not leader or not exists(select 1 from public.rf_research_phases where workspace_id=w and rf_research_phases.id=d) then raise exception 'Leader access required for milestone submission'; end if;
  if exists(select 1 from public.rf_submissions where workspace_id=w and ((v is not null and version_id=v) or (d is not null and phase_id=d)) and status='Submitted for Review') then raise exception 'An academic review is already pending'; end if;
  insert into public.rf_submissions(workspace_id,version_id,phase_id,requested_by) values(w,v,d,u) returning rf_submissions.id into id;
  if d is not null then update public.rf_research_phases set review_state='In Review' where workspace_id=w and rf_research_phases.id=d; end if;
 when 'review_decide' then
  select * into r from public.rf_submissions where workspace_id=w and rf_submissions.id=(p->>'submission_id')::uuid for update;
  if r.id is null or not rf_private.can_submission(w,r.id) or r.requested_by=u then raise exception 'You cannot review your own submission' using errcode='42501'; end if;
  if p->>'kind'='Academic' then
   if not supervisor then raise exception 'Assigned supervisor access required' using errcode='42501'; end if;
   if r.version_id is not null and exists(select 1 from public.rf_document_versions where rf_document_versions.id=r.version_id and author_id=u) then raise exception 'You cannot review your own document version'; end if;
  elsif p->>'kind'='Internal' then
   if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  else raise exception 'Invalid review kind'; end if;
  insert into public.rf_reviews(workspace_id,submission_id,reviewer_id,kind,decision,feedback) values(w,r.id,u,p->>'kind',p->>'decision',trim(p->>'feedback')) returning rf_reviews.id into id;
  if p->>'kind'='Academic' then
   update public.rf_submissions set status=p->>'decision' where rf_submissions.id=r.id;
   if r.phase_id is not null then update public.rf_research_phases set review_state=case when p->>'decision'='Rejected' then 'Revision Requested' else p->>'decision' end where workspace_id=w and rf_research_phases.id=r.phase_id; end if;
  else update public.rf_submissions set internal_status=p->>'decision' where rf_submissions.id=r.id; end if;
 when 'announcement_save' then
  if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  if row_id is null then insert into public.rf_announcements(workspace_id,title,body,priority,pinned,author_id) values(w,trim(p->>'title'),trim(p->>'body'),p->>'priority',coalesce((p->>'pinned')::boolean,false),u) returning rf_announcements.id into id;
  else update public.rf_announcements set title=trim(p->>'title'),body=trim(p->>'body'),priority=p->>'priority',pinned=coalesce((p->>'pinned')::boolean,false),archived=coalesce((p->>'archived')::boolean,false),updated_at=now() where workspace_id=w and rf_announcements.id=row_id returning rf_announcements.id into id; end if;
 when 'announcement_read' then
  insert into public.rf_announcement_reads(workspace_id,announcement_id,user_id) values(w,row_id,u) on conflict do nothing; id=row_id;
 else raise exception 'Unknown collaboration action';
 end case;
 if id is null then raise exception 'Resource not found or permission denied' using errcode='42501'; end if;
 return jsonb_build_object('id',id);
end $$;
create function public.rf_collaborate(action text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select rf_private.collaborate(action,p); $$;
revoke all on function rf_private.can_document(uuid,uuid),rf_private.can_file(uuid,uuid),rf_private.can_submission(uuid,uuid),rf_private.valid_upload(text),rf_private.collaborate(text,jsonb),rf_private.seed_collaboration() from public,anon,authenticated;
grant execute on function rf_private.can_document(uuid,uuid),rf_private.can_file(uuid,uuid),rf_private.can_submission(uuid,uuid),rf_private.valid_upload(text),rf_private.collaborate(text,jsonb) to authenticated;
revoke all on function public.rf_collaborate(text,jsonb) from public,anon;
grant execute on function public.rf_collaborate(text,jsonb) to authenticated;
revoke all on function rf_private.unregistered_upload(text) from public,anon;
grant execute on function rf_private.unregistered_upload(text) to authenticated;
-- Academic phase status can only change through a checked workflow, not a direct client update.
create function rf_private.guard_phase_review() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and new.review_state is distinct from old.review_state then raise exception 'Use the supervisor review workflow'; end if; return new;
end $$;
revoke all on function rf_private.guard_phase_review() from public,anon,authenticated;
create trigger rf_guard_phase_review before update on public.rf_research_phases for each row execute function rf_private.guard_phase_review();
alter publication supabase_realtime add table public.rf_messages,public.rf_channels,public.rf_files;
drop policy rf_file_read on storage.objects;
create policy rf_file_read on storage.objects for select to authenticated using(bucket_id='researchflow-files' and exists(select 1 from public.rf_files f where f.path=storage.objects.name and rf_private.can_file(f.workspace_id,f.id)));
create or replace function rf_private.collaborate(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w uuid=(p->>'workspace_id')::uuid; u uuid=auth.uid(); id uuid; row_id uuid=(p->>'id')::uuid; d uuid; v uuid; f uuid; m uuid; n integer;
 leader boolean; supervisor boolean; r record; obj record; people uuid[]; person uuid; path text; mime text; size bigint; ext text;
begin
 if u is null or not rf_private.has_role(w) then raise exception 'Workspace access required' using errcode='42501'; end if;
 leader=rf_private.has_role(w,array['leader']); supervisor=rf_private.has_role(w,array['supervisor']);
 case action
 when 'channel_save' then
  if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  if row_id is null then insert into public.rf_channels(workspace_id,name,created_by) values(w,trim(p->>'name'),u) returning rf_channels.id into id;
  else update public.rf_channels set name=trim(p->>'name'),archived=coalesce((p->>'archived')::boolean,false),updated_at=now() where workspace_id=w and rf_channels.id=row_id returning rf_channels.id into id; end if;
 when 'message_send' then
  if not exists(select 1 from public.rf_channels where workspace_id=w and rf_channels.id=(p->>'channel_id')::uuid and not archived) then raise exception 'Choose an active workspace channel'; end if;
  insert into public.rf_messages(workspace_id,channel_id,author_id,body,reply_to) values(w,(p->>'channel_id')::uuid,u,trim(p->>'body'),(p->>'reply_to')::uuid) returning rf_messages.id into id;
  if length(trim(p->>'body'))=0 then raise exception 'Message cannot be empty'; end if;
 when 'message_edit','message_delete' then
  select * into r from public.rf_messages where workspace_id=w and rf_messages.id=row_id for update;
  if r.id is null or not (r.author_id=u or (leader and action='message_delete')) or r.deleted then raise exception 'Message permission denied' using errcode='42501'; end if;
  if action='message_edit' and length(trim(p->>'body'))=0 then raise exception 'Message cannot be empty'; end if;
  update public.rf_messages set body=case when action='message_delete' then '' else trim(p->>'body') end,deleted=(action='message_delete'),updated_at=now() where rf_messages.id=row_id returning rf_messages.id into id;
 when 'channel_read' then
  insert into public.rf_channel_reads(workspace_id,channel_id,user_id,last_read_at) values(w,(p->>'channel_id')::uuid,u,least(now(),(p->>'last_read_at')::timestamptz)) on conflict(workspace_id,channel_id,user_id) do update set last_read_at=greatest(rf_channel_reads.last_read_at,excluded.last_read_at);
  id=(p->>'channel_id')::uuid;
 when 'document_create' then
  if supervisor then raise exception 'Supervisors review team submissions; only team members create documents'; end if;
  insert into public.rf_documents(workspace_id,folder_id,title,created_by,restricted,phase_id,task_id) values(w,(p->>'folder_id')::uuid,trim(p->>'title'),u,coalesce((p->>'restricted')::boolean,false),(p->>'phase_id')::uuid,(p->>'task_id')::uuid) returning rf_documents.id into id;
 when 'document_access' then
  select * into r from public.rf_documents where workspace_id=w and rf_documents.id=row_id for update;
  if r.id is null or not(leader or r.created_by=u) then raise exception 'Document permission denied' using errcode='42501'; end if;
  people=array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p->'readers','[]')) x);
  if exists(select 1 from unnest(people) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Readers must belong to this workspace'; end if;
  update public.rf_documents set restricted=(p->>'restricted')::boolean,updated_at=now() where rf_documents.id=row_id;
  delete from public.rf_document_access where workspace_id=w and document_id=row_id;
  insert into public.rf_document_access select w,row_id,x from unnest(people) x; id=row_id;
 when 'document_archive' then
  if not leader then raise exception 'Only leaders can archive documents' using errcode='42501'; end if;
  update public.rf_documents set archived=true,updated_at=now() where workspace_id=w and rf_documents.id=row_id returning rf_documents.id into id;
 when 'file_register' then
  path=p->>'path';
  if not rf_private.valid_upload(path) or split_part(path,'/',1)<>w::text then raise exception 'Invalid file path'; end if;
  select metadata into obj from storage.objects where bucket_id='researchflow-files' and name=path;
  if obj is null then raise exception 'Upload the file before registering it'; end if;
  mime=obj.metadata->>'mimetype'; size=(obj.metadata->>'size')::bigint; ext=lower(split_part(path,'.',2));
  if size is null or size<1 or size>20971520 or mime is null or not exists(select 1 from storage.buckets b where b.id='researchflow-files' and mime=any(b.allowed_mime_types)) then raise exception 'Unsupported file type or size'; end if;
  if not ((ext='pdf' and mime='application/pdf') or (ext='docx' and mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (ext='xlsx' and mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') or (ext in ('csv','txt','md') and mime in ('text/csv','text/plain','text/markdown')) or (ext in ('jpg','jpeg') and mime='image/jpeg') or (ext in ('png','webp','gif') and mime='image/'||ext)) then raise exception 'File extension and content type do not match'; end if;
  d=(p->>'document_id')::uuid; m=(p->>'message_id')::uuid; v=(p->>'announcement_id')::uuid;
  if num_nonnulls(d,m,v)<>1 then raise exception 'Choose exactly one attachment target'; end if;
  if d is not null then
   select * into r from public.rf_documents where workspace_id=w and rf_documents.id=d for update;
   if r.id is null or r.archived or not rf_private.can_document(w,d) or supervisor then raise exception 'Document upload permission denied' using errcode='42501'; end if;
  elsif m is not null then
   if not exists(select 1 from public.rf_messages where workspace_id=w and rf_messages.id=m and author_id=u and not deleted) then raise exception 'Only attach files to your own messages'; end if;
  elsif not leader or not exists(select 1 from public.rf_announcements where workspace_id=w and rf_announcements.id=v) then raise exception 'Announcement permission denied'; end if;
  insert into public.rf_files(workspace_id,owner_id,path,name,mime,bytes,document_id,message_id,announcement_id) values(w,u,path,p->>'name',mime,size,d,m,v) returning rf_files.id into f;
  if d is not null then
   select coalesce(max(version),0)+1 into n from public.rf_document_versions where document_id=d;
   insert into public.rf_document_versions(workspace_id,document_id,file_id,version,notes,author_id) values(w,d,f,n,coalesce(p->>'notes',''),u) returning rf_document_versions.id into id;
   update public.rf_documents set updated_at=now() where rf_documents.id=d;
  else id=f; end if;
 when 'document_comment' then
  d=(p->>'document_id')::uuid;
  if not rf_private.can_document(w,d) then raise exception 'Document permission denied' using errcode='42501'; end if;
  insert into public.rf_document_comments(workspace_id,document_id,author_id,body) values(w,d,u,trim(p->>'body')) returning rf_document_comments.id into id;
 when 'meeting_save' then
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Use a valid IANA timezone'; end if;
  people=array(select distinct x::uuid from jsonb_array_elements_text(coalesce(p->'participants','[]')) x);
  if exists(select 1 from unnest(people) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Participants must belong to this workspace'; end if;
  if row_id is null then
   insert into public.rf_meetings(workspace_id,title,description,type,starts_at,ends_at,timezone,location,agenda,organizer_id) values(w,trim(p->>'title'),coalesce(p->>'description',''),p->>'type',(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,p->>'timezone',coalesce(p->>'location',''),coalesce(p->>'agenda',''),u) returning rf_meetings.id into id;
  else
   select * into r from public.rf_meetings where workspace_id=w and rf_meetings.id=row_id for update;
   if r.id is null or not(leader or r.organizer_id=u) or r.cancelled then raise exception 'Meeting permission denied' using errcode='42501'; end if;
   update public.rf_meetings set title=trim(p->>'title'),description=coalesce(p->>'description',''),type=p->>'type',starts_at=(p->>'starts_at')::timestamptz,ends_at=(p->>'ends_at')::timestamptz,timezone=p->>'timezone',location=coalesce(p->>'location',''),agenda=coalesce(p->>'agenda',''),updated_at=now() where rf_meetings.id=row_id returning rf_meetings.id into id;
   delete from public.rf_meeting_participants where workspace_id=w and meeting_id=id;
  end if;
  insert into public.rf_meeting_participants select w,id,x from unnest(array_append(people,u)) x group by x;
 when 'meeting_cancel' then
  update public.rf_meetings set cancelled=true,updated_at=now() where workspace_id=w and rf_meetings.id=row_id and (organizer_id=u or leader) returning rf_meetings.id into id;
 when 'meeting_note','meeting_action' then
  m=(p->>'meeting_id')::uuid;
  select * into r from public.rf_meetings where workspace_id=w and rf_meetings.id=m;
  if r.id is null or r.cancelled then raise exception 'Choose an active meeting'; end if;
  if not(leader or r.organizer_id=u) and (action='meeting_action' or p->>'kind'<>'Comment') then raise exception 'Only organizers or leaders record minutes, decisions and actions' using errcode='42501'; end if;
  if action='meeting_note' then
   insert into public.rf_meeting_notes(workspace_id,meeting_id,author_id,kind,body) values(w,m,u,p->>'kind',trim(p->>'body')) returning rf_meeting_notes.id into id;
  else
   person=(p->>'assignee_id')::uuid;
   if not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=person and role in ('leader','member')) then raise exception 'Assign an action to a current team member'; end if;
   insert into public.rf_meeting_actions(workspace_id,meeting_id,title,assignee_id,due_date,created_by) values(w,m,trim(p->>'title'),person,(p->>'due_date')::date,u) returning rf_meeting_actions.id into id;
  end if;
 when 'action_convert' then
  if not leader then raise exception 'Leader access required to create tasks' using errcode='42501'; end if;
  select * into r from public.rf_meeting_actions where workspace_id=w and rf_meeting_actions.id=row_id for update;
  if r.id is null then raise exception 'Action not found'; end if;
  if r.task_id is not null then return jsonb_build_object('id',r.task_id); end if;
  if not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=r.assignee_id and role in ('leader','member')) then raise exception 'Reassign this action to a current team member'; end if;
  insert into public.rf_tasks(workspace_id,title,description,assignee_id,due_date,created_by) values(w,r.title,'Meeting action item',r.assignee_id,r.due_date,u) returning rf_tasks.id into id;
  update public.rf_meeting_actions set task_id=id where rf_meeting_actions.id=row_id;
 when 'review_request' then
  if supervisor then raise exception 'Supervisors cannot submit their own academic reviews'; end if;
  v=(p->>'version_id')::uuid; d=(p->>'phase_id')::uuid;
  if num_nonnulls(v,d)<>1 then raise exception 'Select a document version or research phase'; end if;
  if v is not null then
   select x.* into r from public.rf_document_versions x join public.rf_documents y on y.id=x.document_id where x.id=v and x.workspace_id=w and not y.archived;
   if r.id is null or not rf_private.can_document(w,r.document_id) or not(leader or r.author_id=u) then raise exception 'Submission permission denied' using errcode='42501'; end if;
  elsif not leader or not exists(select 1 from public.rf_research_phases where workspace_id=w and rf_research_phases.id=d) then raise exception 'Leader access required for milestone submission'; end if;
  if exists(select 1 from public.rf_submissions where workspace_id=w and ((v is not null and version_id=v) or (d is not null and phase_id=d)) and status='Submitted for Review') then raise exception 'An academic review is already pending'; end if;
  insert into public.rf_submissions(workspace_id,version_id,phase_id,requested_by) values(w,v,d,u) returning rf_submissions.id into id;
  if d is not null then update public.rf_research_phases set review_state='In Review' where workspace_id=w and rf_research_phases.id=d; end if;
 when 'review_decide' then
  select * into r from public.rf_submissions where workspace_id=w and rf_submissions.id=(p->>'submission_id')::uuid for update;
  if r.id is null or not rf_private.can_submission(w,r.id) or r.requested_by=u then raise exception 'You cannot review your own submission' using errcode='42501'; end if;
  if p->>'kind'='Academic' then
   if not supervisor then raise exception 'Assigned supervisor access required' using errcode='42501'; end if;
   if r.version_id is not null and exists(select 1 from public.rf_document_versions dv join public.rf_documents doc on doc.id=dv.document_id where dv.id=r.version_id and (dv.author_id=u or doc.created_by=u)) then raise exception 'You cannot review your own document version'; end if;
  elsif p->>'kind'='Internal' then
   if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  else raise exception 'Invalid review kind'; end if;
  insert into public.rf_reviews(workspace_id,submission_id,reviewer_id,kind,decision,feedback) values(w,r.id,u,p->>'kind',p->>'decision',trim(p->>'feedback')) returning rf_reviews.id into id;
  if p->>'kind'='Academic' then
   update public.rf_submissions set status=p->>'decision' where rf_submissions.id=r.id;
   if r.phase_id is not null then update public.rf_research_phases set review_state=case when p->>'decision'='Rejected' then 'Revision Requested' else p->>'decision' end where workspace_id=w and rf_research_phases.id=r.phase_id; end if;
  else update public.rf_submissions set internal_status=p->>'decision' where rf_submissions.id=r.id; end if;
 when 'announcement_save' then
  if not leader then raise exception 'Leader access required' using errcode='42501'; end if;
  if row_id is null then insert into public.rf_announcements(workspace_id,title,body,priority,pinned,author_id) values(w,trim(p->>'title'),trim(p->>'body'),p->>'priority',coalesce((p->>'pinned')::boolean,false),u) returning rf_announcements.id into id;
  else update public.rf_announcements set title=trim(p->>'title'),body=trim(p->>'body'),priority=p->>'priority',pinned=coalesce((p->>'pinned')::boolean,false),archived=coalesce((p->>'archived')::boolean,false),updated_at=now() where workspace_id=w and rf_announcements.id=row_id returning rf_announcements.id into id; end if;
 when 'announcement_read' then
  insert into public.rf_announcement_reads(workspace_id,announcement_id,user_id) values(w,row_id,u) on conflict do nothing; id=row_id;
 else raise exception 'Unknown collaboration action';
 end case;
 if id is null then raise exception 'Resource not found or permission denied' using errcode='42501'; end if;
 return jsonb_build_object('id',id);
end $$;

-- MVP 3 additive research operations. Existing legacy/auth triggers are unchanged.
create table public.rf_papers (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 250), abstract text not null default '' check(length(abstract)<=20000), keywords text not null default '',
 authors uuid[] not null default '{}', corresponding_author uuid, supervisor_id uuid, venue text not null default '', deadline date, publication_date date,
 status text not null default 'Planning' check(status in ('Planning','Drafting','Under Review','Submitted','Accepted','Published','Archived')),
 created_by uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,corresponding_author) references public.rf_workspace_members(workspace_id,user_id), foreign key(workspace_id,supervisor_id) references public.rf_workspace_members(workspace_id,user_id)
);
create table public.rf_paper_sections (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, paper_id uuid not null, title text not null check(length(trim(title)) between 1 and 200),
 position integer not null default 0, notes text not null default '' check(length(notes)<=50000), assignees uuid[] not null default '{}', deadline date,
 status text not null default 'Not Started' check(status in ('Not Started','Drafting','Internal Review','Supervisor Review','Revision Requested','Approved')),
 task_id uuid, version_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,paper_id) references public.rf_papers(workspace_id,id), foreign key(workspace_id,task_id) references public.rf_tasks(workspace_id,id), foreign key(workspace_id,version_id) references public.rf_document_versions(workspace_id,id)
);
create table public.rf_paper_feedback (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, section_id uuid not null, author_id uuid not null references public.rf_profiles(id),
 kind text not null check(kind in ('Comment','Approved','Revision Requested')), body text not null check(length(trim(body)) between 1 and 10000), created_at timestamptz not null default now(),
 foreign key(workspace_id,section_id) references public.rf_paper_sections(workspace_id,id)
);
create table public.rf_references (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, paper_id uuid not null, authors text not null default '', title text not null check(length(trim(title)) between 1 and 1000),
 year integer check(year between 1000 and 2200), venue text not null default '', url text not null default '' check(url='' or url ~ '^https://[^[:space:]]+$'), notes text not null default '' check(length(notes)<=10000), created_at timestamptz not null default now(),
 foreign key(workspace_id,paper_id) references public.rf_papers(workspace_id,id)
);
create table public.rf_datasets (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 250), description text not null default '' check(length(description)<=10000),
 classification text not null default 'Confidential' check(classification in ('Public','Internal','Confidential','Highly Confidential')),
 permission_status text not null default 'Not requested' check(permission_status in ('Not requested','Pending','Granted','Denied','Expired')),
 status text not null default 'Proposed' check(status in ('Proposed','Permission Pending','Approved for Use','Collected','Under Validation','Ready for Analysis','Restricted','Archived')),
 restricted boolean not null default true, readers uuid[] not null default '{}', assignee_id uuid, phase_id uuid, retention_date date, checkpoint_date date,
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=60000),
 created_by uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,assignee_id) references public.rf_workspace_members(workspace_id,user_id), foreign key(workspace_id,phase_id) references public.rf_research_phases(workspace_id,id)
);
create table public.rf_dataset_versions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, dataset_id uuid not null, version integer not null check(version>0),
 kind text not null check(kind in ('Dataset','Data dictionary','Quality report','Permission evidence')), path text unique, name text not null check(length(name) between 1 and 255),
 mime text, bytes bigint check(bytes between 1 and 20971520), external_url text check(external_url ~ '^https://[^[:space:]]+$'), notes text not null default '' check(length(notes)<=10000),
 author_id uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(), unique(dataset_id,version), unique(workspace_id,id),
 check(num_nonnulls(path,external_url)=1), foreign key(workspace_id,dataset_id) references public.rf_datasets(workspace_id,id)
);
create table public.rf_dataset_access_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, version_id uuid not null, user_id uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(),
 foreign key(workspace_id,version_id) references public.rf_dataset_versions(workspace_id,id)
);
-- A short-lived issuance grant is required by Storage SELECT, so clients cannot skip logging by signing directly.
create table rf_private.dataset_download_grants (user_id uuid not null, version_id uuid not null, expires_at timestamptz not null, primary key(user_id,version_id));
create table public.rf_notifications (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade, user_id uuid not null references public.rf_profiles(id),
 category text not null, event_key text not null, message text not null, destination text not null, read_at timestamptz, created_at timestamptz not null default now(), unique(user_id,event_key)
);
create index rf_notification_inbox on public.rf_notifications(user_id,workspace_id,created_at desc);
create table public.rf_notification_preferences (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade, user_id uuid not null references public.rf_profiles(id), category text not null, enabled boolean not null default true, unique(workspace_id,user_id,category)
);
create table public.rf_github_repositories (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade, url text not null check(url ~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
 created_by uuid not null references public.rf_profiles(id), created_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,url)
);
create table public.rf_github_links (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, repository_id uuid not null, task_id uuid not null, member_id uuid not null,
 kind text not null check(kind in ('Issue','Pull request','Commit','Branch')), url text not null check(length(url)<=2000), description text not null default '' check(length(description)<=2000), created_at timestamptz not null default now(),
 foreign key(workspace_id,repository_id) references public.rf_github_repositories(workspace_id,id), foreign key(workspace_id,task_id) references public.rf_tasks(workspace_id,id), foreign key(workspace_id,member_id) references public.rf_workspace_members(workspace_id,user_id), unique(task_id,url)
);
create table public.rf_report_events (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade, user_id uuid not null references public.rf_profiles(id), report_type text not null check(length(report_type)<=120), created_at timestamptz not null default now()
);
create function rf_private.can_dataset(w uuid,d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select rf_private.has_role(w) and exists(select 1 from public.rf_datasets x where x.workspace_id=w and x.id=d and (not x.restricted or x.created_by=auth.uid() or x.assignee_id=auth.uid() or auth.uid()=any(x.readers) or rf_private.has_role(w,array['leader','supervisor'])));
$$;
do $$ declare t text; begin
 foreach t in array array['rf_papers','rf_paper_sections','rf_paper_feedback','rf_references','rf_datasets','rf_dataset_versions','rf_dataset_access_events','rf_notifications','rf_notification_preferences','rf_github_repositories','rf_github_links','rf_report_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create index %I on public.%I(workspace_id)',t||'_workspace_idx',t);
 if t in ('rf_papers','rf_paper_sections','rf_paper_feedback','rf_references','rf_datasets','rf_dataset_versions','rf_github_repositories','rf_github_links') then
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function rf_private.audit_change()',t); end if;
 end loop;
 foreach t in array array['rf_papers','rf_paper_sections','rf_paper_feedback','rf_references','rf_github_repositories','rf_github_links'] loop
 execute format('create policy member_read on public.%I for select to authenticated using(rf_private.has_role(workspace_id))',t); end loop;
 foreach t in array array['rf_notifications','rf_notification_preferences','rf_report_events'] loop
 execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and rf_private.has_role(workspace_id))',t); end loop;
end $$;
create policy dataset_read on public.rf_datasets for select to authenticated using(rf_private.can_dataset(workspace_id,id));
create policy dataset_read on public.rf_dataset_versions for select to authenticated using(rf_private.can_dataset(workspace_id,dataset_id));
create policy access_read on public.rf_dataset_access_events for select to authenticated using(rf_private.has_role(workspace_id,array['leader','supervisor']) or (user_id=(select auth.uid()) and rf_private.has_role(workspace_id)));
create function rf_private.dataset_upload(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
 declare b text[]=string_to_array(path,'/'); begin
 return array_length(b,1)=4 and b[3]=auth.uid()::text and rf_private.can_dataset(b[1]::uuid,b[2]::uuid) and rf_private.has_role(b[1]::uuid,array['leader','member']) and exists(select 1 from public.rf_datasets d where d.id=b[2]::uuid and d.permission_status='Granted' and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date));
 exception when others then return false; end $$;
create function rf_private.dataset_file(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.rf_dataset_versions v join public.rf_datasets d on d.id=v.dataset_id join rf_private.dataset_download_grants g on g.version_id=v.id and g.user_id=auth.uid() and g.expires_at>now() where v.path=dataset_file.path and rf_private.can_dataset(v.workspace_id,v.dataset_id) and d.permission_status='Granted' and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date));
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('researchflow-datasets','researchflow-datasets',false,20971520,array['text/csv','text/plain','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown']);
create policy dataset_insert on storage.objects for insert to authenticated with check(bucket_id='researchflow-datasets' and rf_private.dataset_upload(name));
create policy dataset_select on storage.objects for select to authenticated using(bucket_id='researchflow-datasets' and rf_private.dataset_file(name));
create policy dataset_cleanup on storage.objects for delete to authenticated using(bucket_id='researchflow-datasets' and rf_private.dataset_upload(name) and not exists(select 1 from public.rf_dataset_versions v where v.path=storage.objects.name));
create function rf_private.notify(w uuid,recipient uuid,cat text,k text,dest text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not rf_private.has_role(w) or not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=recipient) then return; end if;
 if exists(select 1 from public.rf_notification_preferences where workspace_id=w and user_id=recipient and category=cat and not enabled) then return; end if;
 insert into public.rf_notifications(workspace_id,user_id,category,event_key,message,destination) values(w,recipient,cat,k,cat||' updated in your workspace',dest) on conflict(user_id,event_key) do nothing;
end $$;
-- No public caller may forge arbitrary notifications.
revoke all on function rf_private.notify(uuid,uuid,text,text,text) from public,anon,authenticated;
create function rf_private.operations_event() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb=to_jsonb(new); oldj jsonb; w uuid=(j->>'workspace_id')::uuid; m record; cat text; dest text; key text; doc uuid;
begin
 if auth.uid() is null then return new; end if;
 if TG_OP='UPDATE' then oldj=to_jsonb(old); if j=oldj then return new; end if; end if;
 cat=case TG_TABLE_NAME when 'rf_tasks' then 'Tasks' when 'rf_research_phases' then 'Milestones' when 'rf_paper_sections' then 'Papers' when 'rf_paper_feedback' then 'Papers' when 'rf_datasets' then 'Datasets' when 'rf_announcements' then 'Announcements' when 'rf_meetings' then 'Meetings' when 'rf_messages' then 'Mentions' else 'Reviews' end;
 dest=case cat when 'Tasks' then '/tasks' when 'Milestones' then '/phases' when 'Papers' then '/papers' when 'Datasets' then '/datasets' when 'Announcements' then '/announcements' when 'Meetings' then '/meetings' when 'Mentions' then '/discussions' else '/reviews' end;
 key=TG_TABLE_NAME||':'||(j->>'id')||':'||md5(j::text);
 for m in select user_id,role from public.rf_workspace_members where workspace_id=w and user_id<>auth.uid() loop
 if TG_TABLE_NAME='rf_tasks' and m.user_id::text is distinct from j->>'assignee_id' then continue; end if;
 if TG_TABLE_NAME='rf_research_phases' and j->>'status'<>'Completed' then continue; end if;
 if TG_TABLE_NAME='rf_paper_sections' and not (j->'assignees' ? m.user_id::text) and m.role not in ('leader','supervisor') then continue; end if;
 if TG_TABLE_NAME='rf_messages' and position('@{'||m.user_id||'}' in coalesce(j->>'body',''))=0 then continue; end if;
 if TG_TABLE_NAME='rf_datasets' and not (not (j->>'restricted')::boolean or j->>'created_by'=m.user_id::text or j->>'assignee_id'=m.user_id::text or j->'readers' ? m.user_id::text or m.role in ('leader','supervisor')) then continue; end if;
 -- Do not reveal private document/review events to users without that document's access.
 doc=null;
 if TG_TABLE_NAME='rf_document_versions' then doc=(j->>'document_id')::uuid;
 elsif TG_TABLE_NAME='rf_submissions' then select document_id into doc from public.rf_document_versions where id=(j->>'version_id')::uuid;
 elsif TG_TABLE_NAME='rf_reviews' then select v.document_id into doc from public.rf_submissions s join public.rf_document_versions v on v.id=s.version_id where s.id=(j->>'submission_id')::uuid; end if;
 if doc is not null and not exists(select 1 from public.rf_documents d where d.id=doc and (not d.restricted or d.created_by=m.user_id or m.role in ('leader','supervisor') or exists(select 1 from public.rf_document_access a where a.document_id=doc and a.user_id=m.user_id))) then continue; end if;
 perform rf_private.notify(w,m.user_id,cat,key,dest);
 end loop;
 return new;
end $$;
do $$ declare t text; begin foreach t in array array['rf_tasks','rf_research_phases','rf_document_versions','rf_submissions','rf_reviews','rf_meetings','rf_announcements','rf_messages','rf_paper_sections','rf_paper_feedback','rf_datasets'] loop
 execute format('create trigger operations_notify after insert or update on public.%I for each row execute function rf_private.operations_event()',t); end loop; end $$;
create function rf_private.operations(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid=(p->>'workspace_id')::uuid; u uuid=auth.uid(); rid uuid=nullif(p->>'id','')::uuid; id uuid; leader boolean; supervisor boolean; r record; a uuid[]; v uuid; n integer; path text; meta jsonb; item jsonb; repo text; ext text;
begin
 if u is null or not rf_private.has_role(w) then raise exception 'Workspace access required' using errcode='42501'; end if;
 if octet_length(p::text)>250000 then raise exception 'Request too large'; end if;
 leader=rf_private.has_role(w,array['leader']); supervisor=rf_private.has_role(w,array['supervisor']);
 a=array(select jsonb_array_elements_text(coalesce(p->'assignees',p->'authors',p->'readers','[]'::jsonb))::uuid);
 if exists(select 1 from unnest(a) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Every selected user must belong to this workspace'; end if;
 case action
 when 'paper_save' then
  if not leader then raise exception 'Only leaders manage paper metadata' using errcode='42501'; end if;
  if nullif(p->>'supervisor_id','') is not null and not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=(p->>'supervisor_id')::uuid and role='supervisor') then raise exception 'Choose an assigned supervisor'; end if;
  if nullif(p->>'corresponding_author','') is not null and not ((p->>'corresponding_author')::uuid=any(a)) then raise exception 'Corresponding author must be in the author list'; end if;
  if cardinality(a)<>(select count(distinct x) from unnest(a) x) then raise exception 'Duplicate author'; end if;
  if rid is null then
   insert into public.rf_papers(workspace_id,title,abstract,keywords,authors,corresponding_author,supervisor_id,venue,deadline,publication_date,status,created_by) values(w,p->>'title',coalesce(p->>'abstract',''),coalesce(p->>'keywords',''),a,nullif(p->>'corresponding_author','')::uuid,nullif(p->>'supervisor_id','')::uuid,coalesce(p->>'venue',''),nullif(p->>'deadline','')::date,nullif(p->>'publication_date','')::date,p->>'status',u) returning rf_papers.id into id;
   insert into public.rf_paper_sections(workspace_id,paper_id,title,position) select w,id,t,ord::integer from unnest(array['Abstract','Introduction','Problem Statement','Research Objectives','Literature Review','Methodology','Data Collection and Preparation','Experimental Design','Results','Discussion','Limitations','Conclusion','References','Appendices']) with ordinality as s(t,ord);
  else update public.rf_papers set title=p->>'title',abstract=coalesce(p->>'abstract',''),keywords=coalesce(p->>'keywords',''),authors=a,corresponding_author=nullif(p->>'corresponding_author','')::uuid,supervisor_id=nullif(p->>'supervisor_id','')::uuid,venue=coalesce(p->>'venue',''),deadline=nullif(p->>'deadline','')::date,publication_date=nullif(p->>'publication_date','')::date,status=p->>'status',updated_at=now() where workspace_id=w and rf_papers.id=rid returning rf_papers.id into id; end if;
 when 'section_save' then
  if rid is not null then select * into r from public.rf_paper_sections where workspace_id=w and rf_paper_sections.id=rid for update; if not found then raise exception 'Section not found'; end if; end if;
  if not leader and (rid is null or not(u=any(r.assignees)) or supervisor) then raise exception 'Section assignment required' using errcode='42501'; end if;
  if p->>'status'='Approved' then raise exception 'Use supervisor review to approve'; end if;
  if rid is not null and not leader and (a<>r.assignees or p->>'title'<>r.title or nullif(p->>'deadline','')::date is distinct from r.deadline or (p->>'position')::integer<>r.position or nullif(p->>'task_id','')::uuid is distinct from r.task_id) then raise exception 'Only leaders change assignments and planning'; end if;
  v=nullif(p->>'version_id','')::uuid;
  if v is not null and not exists(select 1 from public.rf_document_versions x where x.id=v and x.workspace_id=w and rf_private.can_document(w,x.document_id)) then raise exception 'Document version unavailable'; end if;
  if rid is null then insert into public.rf_paper_sections(workspace_id,paper_id,title,position,notes,assignees,deadline,status,task_id,version_id) values(w,(p->>'paper_id')::uuid,p->>'title',coalesce((p->>'position')::integer,0),coalesce(p->>'notes',''),a,nullif(p->>'deadline','')::date,p->>'status',nullif(p->>'task_id','')::uuid,v) returning rf_paper_sections.id into id;
  else update public.rf_paper_sections set title=p->>'title',position=(p->>'position')::integer,notes=coalesce(p->>'notes',''),assignees=a,deadline=nullif(p->>'deadline','')::date,status=p->>'status',task_id=nullif(p->>'task_id','')::uuid,version_id=v,updated_at=now() where workspace_id=w and rf_paper_sections.id=rid returning rf_paper_sections.id into id; end if;
 when 'section_feedback' then
  select s.*,p2.created_by into r from public.rf_paper_sections s join public.rf_papers p2 on p2.id=s.paper_id where s.workspace_id=w and s.id=(p->>'section_id')::uuid for update of s;
  if not found then raise exception 'Section not found'; end if;
  if p->>'kind'<>'Comment' then
   if not supervisor or u=any(r.assignees) or r.created_by=u or r.status<>'Supervisor Review' then raise exception 'Only an independent workspace supervisor can review a submitted section' using errcode='42501'; end if;
   if p->>'kind' not in ('Approved','Revision Requested') then raise exception 'Invalid decision'; end if;
   update public.rf_paper_sections set status=p->>'kind',updated_at=now() where rf_paper_sections.id=r.id;
  end if;
  insert into public.rf_paper_feedback(workspace_id,section_id,author_id,kind,body) values(w,r.id,u,p->>'kind',p->>'body') returning rf_paper_feedback.id into id;
 when 'reference_save' then
  if supervisor then raise exception 'Team authors manage references'; end if;
  for item in select * from jsonb_array_elements(p->'references') loop
   insert into public.rf_references(workspace_id,paper_id,authors,title,year,venue,url,notes) values(w,(p->>'paper_id')::uuid,coalesce(item->>'authors',''),item->>'title',nullif(item->>'year','')::integer,coalesce(item->>'venue',''),coalesce(item->>'url',''),coalesce(item->>'notes','')) returning rf_references.id into id;
  end loop;
 when 'dataset_save' then
  if supervisor then raise exception 'Team members manage datasets'; end if;
  if rid is not null then select * into r from public.rf_datasets where workspace_id=w and rf_datasets.id=rid for update; if not found or not rf_private.can_dataset(w,rid) or not(leader or r.created_by=u or r.assignee_id=u) then raise exception 'Dataset management permission denied'; end if; end if;
  if not leader and (rid is null or a<>r.readers or (p->>'restricted')::boolean<>r.restricted or p->>'permission_status'<>r.permission_status or p->>'classification'<>r.classification or nullif(p->>'assignee_id','')::uuid is distinct from r.assignee_id) then raise exception 'Leaders manage dataset permissions and classification'; end if;
  if p->>'status' in ('Approved for Use','Collected','Under Validation','Ready for Analysis') and (p->>'permission_status'<>'Granted' or length(trim(coalesce(p->'metadata'->>'permission_evidence','')))=0 or length(trim(coalesce(p->'metadata'->>'usage_scope','')))=0) then raise exception 'Record granted permission, evidence and usage scope before use'; end if;
  if rid is null then
   insert into public.rf_datasets(workspace_id,name,description,classification,permission_status,status,restricted,readers,assignee_id,phase_id,retention_date,checkpoint_date,metadata,created_by) values(w,p->>'name',coalesce(p->>'description',''),p->>'classification',p->>'permission_status',p->>'status',coalesce((p->>'restricted')::boolean,true),a,nullif(p->>'assignee_id','')::uuid,nullif(p->>'phase_id','')::uuid,nullif(p->>'retention_date','')::date,nullif(p->>'checkpoint_date','')::date,coalesce(p->'metadata','{}'),u) returning rf_datasets.id into id;
  else update public.rf_datasets set name=p->>'name',description=coalesce(p->>'description',''),classification=p->>'classification',permission_status=p->>'permission_status',status=p->>'status',restricted=(p->>'restricted')::boolean,readers=a,assignee_id=nullif(p->>'assignee_id','')::uuid,phase_id=nullif(p->>'phase_id','')::uuid,retention_date=nullif(p->>'retention_date','')::date,checkpoint_date=nullif(p->>'checkpoint_date','')::date,metadata=coalesce(p->'metadata','{}'),updated_at=now() where workspace_id=w and rf_datasets.id=rid returning rf_datasets.id into id; end if;
 when 'dataset_version' then
  select * into r from public.rf_datasets where workspace_id=w and rf_datasets.id=(p->>'dataset_id')::uuid for update;
  if not found or not rf_private.can_dataset(w,r.id) or supervisor then raise exception 'Dataset access denied'; end if;
  path=nullif(p->>'path','');
  if path is not null then
   if not rf_private.dataset_upload(path) or split_part(path,'/',1)<>w::text or split_part(path,'/',2)<>r.id::text then raise exception 'Permission, retention or dataset status prevents upload'; end if;
   select metadata into meta from storage.objects o where o.bucket_id='researchflow-datasets' and o.name=path;
   if meta is null then raise exception 'Upload bytes first'; end if;
  end if;
  select coalesce(max(version),0)+1 into n from public.rf_dataset_versions where dataset_id=r.id;
  insert into public.rf_dataset_versions(workspace_id,dataset_id,version,kind,path,name,mime,bytes,external_url,notes,author_id) values(w,r.id,n,p->>'kind',path,p->>'name',meta->>'mimetype',(meta->>'size')::bigint,nullif(p->>'external_url',''),coalesce(p->>'notes',''),u) returning rf_dataset_versions.id into id;
 when 'dataset_download' then
  select v1.*,d.permission_status,d.status,d.retention_date into r from public.rf_dataset_versions v1 join public.rf_datasets d on d.id=v1.dataset_id where v1.workspace_id=w and v1.id=rid;
  if not found or not rf_private.can_dataset(w,r.dataset_id) or r.permission_status<>'Granted' or r.status in ('Restricted','Archived') or r.retention_date<current_date then raise exception 'Dataset download denied'; end if;
  insert into public.rf_dataset_access_events(workspace_id,version_id,user_id) values(w,rid,u) returning rf_dataset_access_events.id into id;
  insert into rf_private.dataset_download_grants values(u,rid,now()+interval '15 seconds') on conflict(user_id,version_id) do update set expires_at=excluded.expires_at;
 when 'notifications_read' then update public.rf_notifications set read_at=coalesce(read_at,now()) where workspace_id=w and user_id=u and (rid is null or rf_notifications.id=rid); id=u;
 when 'preference' then
  if p->>'category' not in ('Tasks','Deadlines','Reviews','Papers','Datasets','Meetings','Announcements','Mentions','Milestones') then raise exception 'Unknown category'; end if;
  insert into public.rf_notification_preferences(workspace_id,user_id,category,enabled) values(w,u,p->>'category',(p->>'enabled')::boolean) on conflict(workspace_id,user_id,category) do update set enabled=excluded.enabled returning rf_notification_preferences.id into id;
 when 'deadline_refresh' then
  -- Server checks the timezone and derives the date; a client cannot forge somebody else's deadlines.
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Invalid timezone'; end if;
  for r in select * from public.rf_tasks where workspace_id=w and assignee_id=u and not archived and status<>'Completed' and due_date<=(now() at time zone (p->>'timezone'))::date+7 loop
   perform rf_private.notify(w,u,'Deadlines','deadline:'||r.id||':'||r.due_date||':'||((now() at time zone (p->>'timezone'))::date),'/tasks');
  end loop; id=u;
 when 'repository_save' then
  if not leader then raise exception 'Only leaders register repositories'; end if;
  insert into public.rf_github_repositories(workspace_id,url,created_by) values(w,p->>'url',u) returning rf_github_repositories.id into id;
 when 'github_link' then
  if supervisor then raise exception 'Team members track development'; end if;
  select url into repo from public.rf_github_repositories where workspace_id=w and rf_github_repositories.id=(p->>'repository_id')::uuid;
  ext=case p->>'kind' when 'Issue' then '/issues/[0-9]+' when 'Pull request' then '/pull/[0-9]+' when 'Commit' then '/commit/[a-fA-F0-9]{7,40}' when 'Branch' then '/tree/[A-Za-z0-9_./%~-]+' else null end;
  if repo is null or ext is null or p->>'url' !~ ('^'||replace(repo,'.','[.]')||ext||'$') or position('..' in substring(p->>'url' from length(repo)+1))>0 then raise exception 'URL must match the registered GitHub repository and link type'; end if;
  if not leader and (p->>'member_id')::uuid<>u then raise exception 'Members record their own links'; end if;
  insert into public.rf_github_links(workspace_id,repository_id,task_id,member_id,kind,url,description) values(w,(p->>'repository_id')::uuid,(p->>'task_id')::uuid,(p->>'member_id')::uuid,p->>'kind',p->>'url',coalesce(p->>'description','')) returning rf_github_links.id into id;
 when 'report_event' then insert into public.rf_report_events(workspace_id,user_id,report_type) values(w,u,p->>'report_type') returning rf_report_events.id into id;
 else raise exception 'Unknown research operation'; end case;
 if id is null then raise exception 'Record not found'; end if;
 return jsonb_build_object('id',id);
end $$;
create function public.rf_operations(action text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select rf_private.operations(action,p); $$;
revoke all on function public.rf_operations(text,jsonb) from public,anon;
revoke all on function rf_private.operations(text,jsonb) from public,anon;
grant execute on function public.rf_operations(text,jsonb),rf_private.operations(text,jsonb) to authenticated;
revoke all on function rf_private.can_dataset(uuid,uuid),rf_private.dataset_upload(text),rf_private.dataset_file(text),rf_private.operations_event() from public,anon;
grant execute on function rf_private.can_dataset(uuid,uuid),rf_private.dataset_upload(text),rf_private.dataset_file(text) to authenticated;
alter publication supabase_realtime add table public.rf_notifications;
notify pgrst,'reload schema';


-- Clarify row-dependent guards and allow permission evidence before raw-data authorization.
create or replace function rf_private.dataset_upload(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare b text[]=string_to_array(path,'/'); begin
 return array_length(b,1)=4 and b[3]=auth.uid()::text and rf_private.can_dataset(b[1]::uuid,b[2]::uuid) and rf_private.has_role(b[1]::uuid,array['leader','member']) and exists(select 1 from public.rf_datasets d where d.id=b[2]::uuid and (d.permission_status='Granted' or b[4] like 'evidence-%') and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date));
exception when others then return false; end $$;
create or replace function rf_private.dataset_file(path text) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.rf_dataset_versions v join public.rf_datasets d on d.id=v.dataset_id join rf_private.dataset_download_grants g on g.version_id=v.id and g.user_id=auth.uid() and g.expires_at>now() where v.path=dataset_file.path and rf_private.can_dataset(v.workspace_id,v.dataset_id) and (v.kind='Permission evidence' or d.permission_status='Granted') and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date)); $$;
create or replace function rf_private.operations(action text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid=(p->>'workspace_id')::uuid; u uuid=auth.uid(); rid uuid=nullif(p->>'id','')::uuid; id uuid; leader boolean; supervisor boolean; r record; a uuid[]; v uuid; n integer; path text; meta jsonb; item jsonb; repo text; ext text;
begin
 if u is null or not rf_private.has_role(w) then raise exception 'Workspace access required' using errcode='42501'; end if;
 if octet_length(p::text)>250000 then raise exception 'Request too large'; end if;
 leader=rf_private.has_role(w,array['leader']); supervisor=rf_private.has_role(w,array['supervisor']);
 a=array(select jsonb_array_elements_text(coalesce(p->'assignees',p->'authors',p->'readers','[]'::jsonb))::uuid);
 if exists(select 1 from unnest(a) x where not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=x)) then raise exception 'Every selected user must belong to this workspace'; end if;
 case action
 when 'paper_save' then
  if not leader then raise exception 'Only leaders manage paper metadata' using errcode='42501'; end if;
  if nullif(p->>'supervisor_id','') is not null and not exists(select 1 from public.rf_workspace_members where workspace_id=w and user_id=(p->>'supervisor_id')::uuid and role='supervisor') then raise exception 'Choose an assigned supervisor'; end if;
  if nullif(p->>'corresponding_author','') is not null and not ((p->>'corresponding_author')::uuid=any(a)) then raise exception 'Corresponding author must be in the author list'; end if;
  if cardinality(a)<>(select count(distinct x) from unnest(a) x) then raise exception 'Duplicate author'; end if;
  if rid is null then
   insert into public.rf_papers(workspace_id,title,abstract,keywords,authors,corresponding_author,supervisor_id,venue,deadline,publication_date,status,created_by) values(w,p->>'title',coalesce(p->>'abstract',''),coalesce(p->>'keywords',''),a,nullif(p->>'corresponding_author','')::uuid,nullif(p->>'supervisor_id','')::uuid,coalesce(p->>'venue',''),nullif(p->>'deadline','')::date,nullif(p->>'publication_date','')::date,p->>'status',u) returning rf_papers.id into id;
   insert into public.rf_paper_sections(workspace_id,paper_id,title,position) select w,id,t,ord::integer from unnest(array['Abstract','Introduction','Problem Statement','Research Objectives','Literature Review','Methodology','Data Collection and Preparation','Experimental Design','Results','Discussion','Limitations','Conclusion','References','Appendices']) with ordinality as s(t,ord);
  else update public.rf_papers set title=p->>'title',abstract=coalesce(p->>'abstract',''),keywords=coalesce(p->>'keywords',''),authors=a,corresponding_author=nullif(p->>'corresponding_author','')::uuid,supervisor_id=nullif(p->>'supervisor_id','')::uuid,venue=coalesce(p->>'venue',''),deadline=nullif(p->>'deadline','')::date,publication_date=nullif(p->>'publication_date','')::date,status=p->>'status',updated_at=now() where workspace_id=w and rf_papers.id=rid returning rf_papers.id into id; end if;
 when 'section_save' then
  if rid is not null then select * into r from public.rf_paper_sections where workspace_id=w and rf_paper_sections.id=rid for update; if not found then raise exception 'Section not found'; end if; end if;
  if not leader then if rid is null then raise exception 'Only leaders create sections'; end if; if not(u=any(r.assignees)) or supervisor then raise exception 'Section assignment required' using errcode='42501'; end if; end if;
  if p->>'status'='Approved' then raise exception 'Use supervisor review to approve'; end if;
  if not leader then if (a<>r.assignees or p->>'title'<>r.title or nullif(p->>'deadline','')::date is distinct from r.deadline or (p->>'position')::integer<>r.position or nullif(p->>'task_id','')::uuid is distinct from r.task_id) then raise exception 'Only leaders change assignments and planning'; end if; end if;
  v=nullif(p->>'version_id','')::uuid;
  if v is not null and not exists(select 1 from public.rf_document_versions x where x.id=v and x.workspace_id=w and rf_private.can_document(w,x.document_id)) then raise exception 'Document version unavailable'; end if;
  if rid is null then insert into public.rf_paper_sections(workspace_id,paper_id,title,position,notes,assignees,deadline,status,task_id,version_id) values(w,(p->>'paper_id')::uuid,p->>'title',coalesce((p->>'position')::integer,0),coalesce(p->>'notes',''),a,nullif(p->>'deadline','')::date,p->>'status',nullif(p->>'task_id','')::uuid,v) returning rf_paper_sections.id into id;
  else update public.rf_paper_sections set title=p->>'title',position=(p->>'position')::integer,notes=coalesce(p->>'notes',''),assignees=a,deadline=nullif(p->>'deadline','')::date,status=p->>'status',task_id=nullif(p->>'task_id','')::uuid,version_id=v,updated_at=now() where workspace_id=w and rf_paper_sections.id=rid returning rf_paper_sections.id into id; end if;
 when 'section_feedback' then
  select s.*,p2.created_by into r from public.rf_paper_sections s join public.rf_papers p2 on p2.id=s.paper_id where s.workspace_id=w and s.id=(p->>'section_id')::uuid for update of s;
  if not found then raise exception 'Section not found'; end if;
  if p->>'kind'<>'Comment' then
   if exists(select 1 from public.rf_document_versions dv join public.rf_documents d on d.id=dv.document_id where dv.id=r.version_id and (dv.author_id=u or d.created_by=u)) then raise exception 'Authors cannot academically approve their own draft'; end if;
   if not supervisor or u=any(r.assignees) or r.created_by=u or r.status<>'Supervisor Review' then raise exception 'Only an independent workspace supervisor can review a submitted section' using errcode='42501'; end if;
   if p->>'kind' not in ('Approved','Revision Requested') then raise exception 'Invalid decision'; end if;
   update public.rf_paper_sections set status=p->>'kind',updated_at=now() where rf_paper_sections.id=r.id;
  end if;
  insert into public.rf_paper_feedback(workspace_id,section_id,author_id,kind,body) values(w,r.id,u,p->>'kind',p->>'body') returning rf_paper_feedback.id into id;
 when 'reference_save' then
  if supervisor then raise exception 'Team authors manage references'; end if;
  for item in select * from jsonb_array_elements(p->'references') loop
   insert into public.rf_references(workspace_id,paper_id,authors,title,year,venue,url,notes) values(w,(p->>'paper_id')::uuid,coalesce(item->>'authors',''),item->>'title',nullif(item->>'year','')::integer,coalesce(item->>'venue',''),coalesce(item->>'url',''),coalesce(item->>'notes','')) returning rf_references.id into id;
  end loop;
 when 'dataset_save' then
 if nullif(p->'metadata'->>'related_document_id','') is not null and not exists(select 1 from public.rf_documents d where d.workspace_id=w and d.id=(p->'metadata'->>'related_document_id')::uuid and rf_private.can_document(w,d.id)) then raise exception 'Related document unavailable'; end if;
 if nullif(p->'metadata'->>'record_count','') is not null and (p->'metadata'->>'record_count') !~ '^[0-9]{1,15}$' then raise exception 'Record count must be a nonnegative integer'; end if;
 if nullif(p->'metadata'->>'date_from','')::date > nullif(p->'metadata'->>'date_to','')::date then raise exception 'Invalid dataset date range'; end if;
  if supervisor then raise exception 'Team members manage datasets'; end if;
  if rid is not null then select * into r from public.rf_datasets where workspace_id=w and rf_datasets.id=rid for update; if not found or not rf_private.can_dataset(w,rid) or not(leader or r.created_by=u or r.assignee_id=u) then raise exception 'Dataset management permission denied'; end if; end if;
  if not leader then if rid is null then raise exception 'Only leaders register datasets'; end if; if (a<>r.readers or (p->>'restricted')::boolean<>r.restricted or p->>'permission_status'<>r.permission_status or p->>'classification'<>r.classification or nullif(p->>'assignee_id','')::uuid is distinct from r.assignee_id) then raise exception 'Leaders manage dataset permissions and classification'; end if; end if;
  if (p->>'permission_status'='Granted' or p->>'status' in ('Approved for Use','Collected','Under Validation','Ready for Analysis')) and (p->>'permission_status'<>'Granted' or length(trim(coalesce(p->'metadata'->>'permission_evidence','')))=0 or length(trim(coalesce(p->'metadata'->>'usage_scope','')))=0) then raise exception 'Record granted permission, evidence and usage scope before use'; end if;
  if rid is null then
   insert into public.rf_datasets(workspace_id,name,description,classification,permission_status,status,restricted,readers,assignee_id,phase_id,retention_date,checkpoint_date,metadata,created_by) values(w,p->>'name',coalesce(p->>'description',''),p->>'classification',p->>'permission_status',p->>'status',coalesce((p->>'restricted')::boolean,true),a,nullif(p->>'assignee_id','')::uuid,nullif(p->>'phase_id','')::uuid,nullif(p->>'retention_date','')::date,nullif(p->>'checkpoint_date','')::date,coalesce(p->'metadata','{}'),u) returning rf_datasets.id into id;
  else update public.rf_datasets set name=p->>'name',description=coalesce(p->>'description',''),classification=p->>'classification',permission_status=p->>'permission_status',status=p->>'status',restricted=(p->>'restricted')::boolean,readers=a,assignee_id=nullif(p->>'assignee_id','')::uuid,phase_id=nullif(p->>'phase_id','')::uuid,retention_date=nullif(p->>'retention_date','')::date,checkpoint_date=nullif(p->>'checkpoint_date','')::date,metadata=coalesce(p->'metadata','{}'),updated_at=now() where workspace_id=w and rf_datasets.id=rid returning rf_datasets.id into id; end if;
 when 'dataset_version' then
  select * into r from public.rf_datasets where workspace_id=w and rf_datasets.id=(p->>'dataset_id')::uuid for update;
  if not found or not rf_private.can_dataset(w,r.id) or supervisor then raise exception 'Dataset access denied'; end if;
  path=nullif(p->>'path','');
  if path is not null then
   if not rf_private.dataset_upload(path) or split_part(path,'/',1)<>w::text or split_part(path,'/',2)<>r.id::text or ((p->>'kind'='Permission evidence') is distinct from (split_part(path,'/',4) like 'evidence-%')) then raise exception 'Permission, retention or dataset status prevents upload'; end if;
   select metadata into meta from storage.objects o where o.bucket_id='researchflow-datasets' and o.name=path;
   if meta is null then raise exception 'Upload bytes first'; end if;
  end if;
  select coalesce(max(version),0)+1 into n from public.rf_dataset_versions where dataset_id=r.id;
  insert into public.rf_dataset_versions(workspace_id,dataset_id,version,kind,path,name,mime,bytes,external_url,notes,author_id) values(w,r.id,n,p->>'kind',path,p->>'name',meta->>'mimetype',(meta->>'size')::bigint,nullif(p->>'external_url',''),coalesce(p->>'notes',''),u) returning rf_dataset_versions.id into id;
 when 'dataset_download' then
  select v1.*,d.permission_status,d.status,d.retention_date into r from public.rf_dataset_versions v1 join public.rf_datasets d on d.id=v1.dataset_id where v1.workspace_id=w and v1.id=rid;
  if not found or not rf_private.can_dataset(w,r.dataset_id) or (r.kind<>'Permission evidence' and r.permission_status<>'Granted') or r.status in ('Restricted','Archived') or r.retention_date<current_date then raise exception 'Dataset download denied'; end if;
  insert into public.rf_dataset_access_events(workspace_id,version_id,user_id) values(w,rid,u) returning rf_dataset_access_events.id into id;
  insert into rf_private.dataset_download_grants values(u,rid,now()+interval '15 seconds') on conflict(user_id,version_id) do update set expires_at=excluded.expires_at;
 when 'notifications_read' then update public.rf_notifications set read_at=coalesce(read_at,now()) where workspace_id=w and user_id=u and (rid is null or rf_notifications.id=rid); id=u;
 when 'preference' then
  if p->>'category' not in ('Tasks','Deadlines','Reviews','Papers','Datasets','Meetings','Announcements','Mentions','Milestones') then raise exception 'Unknown category'; end if;
  insert into public.rf_notification_preferences(workspace_id,user_id,category,enabled) values(w,u,p->>'category',(p->>'enabled')::boolean) on conflict(workspace_id,user_id,category) do update set enabled=excluded.enabled returning rf_notification_preferences.id into id;
 when 'deadline_refresh' then
  -- Server checks the timezone and derives the date; a client cannot forge somebody else's deadlines.
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Invalid timezone'; end if;
  for r in select * from public.rf_tasks where workspace_id=w and assignee_id=u and not archived and status<>'Completed' and due_date<=(now() at time zone (p->>'timezone'))::date+7 loop
   perform rf_private.notify(w,u,'Deadlines','deadline:'||r.id||':'||r.due_date||':'||((now() at time zone (p->>'timezone'))::date),'/tasks');
  end loop; id=u;
 when 'repository_save' then
  if not leader then raise exception 'Only leaders register repositories'; end if;
  insert into public.rf_github_repositories(workspace_id,url,created_by) values(w,p->>'url',u) returning rf_github_repositories.id into id;
 when 'github_link' then
  if supervisor then raise exception 'Team members track development'; end if;
  select url into repo from public.rf_github_repositories where workspace_id=w and rf_github_repositories.id=(p->>'repository_id')::uuid;
  ext=case p->>'kind' when 'Issue' then '/issues/[0-9]+' when 'Pull request' then '/pull/[0-9]+' when 'Commit' then '/commit/[a-fA-F0-9]{7,40}' when 'Branch' then '/tree/[A-Za-z0-9_./%~-]+' else null end;
  if repo is null or ext is null or p->>'url' !~ ('^'||replace(repo,'.','[.]')||ext||'$') or position('..' in substring(p->>'url' from length(repo)+1))>0 then raise exception 'URL must match the registered GitHub repository and link type'; end if;
  if not leader and (p->>'member_id')::uuid<>u then raise exception 'Members record their own links'; end if;
  insert into public.rf_github_links(workspace_id,repository_id,task_id,member_id,kind,url,description) values(w,(p->>'repository_id')::uuid,(p->>'task_id')::uuid,(p->>'member_id')::uuid,p->>'kind',p->>'url',coalesce(p->>'description','')) returning rf_github_links.id into id;
 when 'report_event' then insert into public.rf_report_events(workspace_id,user_id,report_type) values(w,u,p->>'report_type') returning rf_report_events.id into id;
 else raise exception 'Unknown research operation'; end case;
 if id is null then raise exception 'Record not found'; end if;
 return jsonb_build_object('id',id);
end $$;

notify pgrst,'reload schema';


-- Dataset bytes are signed only by the authenticated Edge Function, never by browser clients.
drop policy dataset_select on storage.objects;
-- The private, expiring issuance-grant table is retained for compatibility with the audit RPC.
-- No client SELECT policy consumes those grants; clients cannot choose a longer signed-link lifetime.
notify pgrst,'reload schema';


-- Sensitive metadata and permission snapshots never enter the workspace-wide activity feed.
create table public.rf_dataset_changes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, dataset_id uuid not null,
 actor_id uuid not null references public.rf_profiles(id), before_value jsonb, after_value jsonb not null,
 created_at timestamptz not null default now(), foreign key(workspace_id,dataset_id) references public.rf_datasets(workspace_id,id)
);
create index rf_dataset_changes_workspace on public.rf_dataset_changes(workspace_id,dataset_id,created_at desc);
alter table public.rf_dataset_changes enable row level security;
revoke all on public.rf_dataset_changes from public,anon,authenticated;
grant select on public.rf_dataset_changes to authenticated;
create policy dataset_history_read on public.rf_dataset_changes for select to authenticated using(rf_private.can_dataset(workspace_id,dataset_id));
create function rf_private.dataset_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not rf_private.has_role(new.workspace_id) then raise exception 'Workspace membership required'; end if;
 insert into public.rf_dataset_changes(workspace_id,dataset_id,actor_id,before_value,after_value) values(new.workspace_id,new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function rf_private.dataset_history() from public,anon,authenticated;
create trigger dataset_history after insert or update on public.rf_datasets for each row execute function rf_private.dataset_history();
notify pgrst,'reload schema';
