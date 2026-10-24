-- Recoverable lifecycle for mutable research records. No physical deletes or legacy changes.
do $$ declare t text; begin
 foreach t in array array['rf_research_phases','rf_channels','rf_meetings','rf_announcements','rf_papers','rf_paper_sections','rf_references','rf_datasets','rf_github_repositories','rf_github_links','rf_document_comments','rf_meeting_notes','rf_meeting_actions'] loop
  execute format('alter table public.%I add column deleted_at timestamptz',t);
 end loop;
end $$;

create table public.rf_record_changes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.rf_workspaces(id) on delete cascade,
 entity text not null, entity_id uuid not null, actor_id uuid not null references public.rf_profiles(id),
 action text not null, before_value jsonb not null, after_value jsonb not null, created_at timestamptz not null default now()
);
create index rf_record_changes_workspace_idx on public.rf_record_changes(workspace_id,entity,entity_id,created_at desc);
create index rf_record_changes_actor_idx on public.rf_record_changes(actor_id);
alter table public.rf_record_changes enable row level security;
revoke all on public.rf_record_changes from public,anon,authenticated;
grant select on public.rf_record_changes to authenticated;
create policy leader_read on public.rf_record_changes for select to authenticated using(rf_private.has_role(workspace_id,array['leader']));

create function rf_private.manage_record(entity text,operation text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w uuid=(p->>'workspace_id')::uuid; rid uuid=(p->>'id')::uuid; t text; allowed text[]; oldrow jsonb; newrow jsonb; changes jsonb=coalesce(p->'changes','{}'); assignments text; repo text; ext text;
begin
 if auth.uid() is null or not rf_private.has_role(w,array['leader']) then raise exception 'Leader access required' using errcode='42501'; end if;
 case entity
 when 'phases' then t='rf_research_phases'; allowed=array['name','description','objectives'];
 when 'channels' then t='rf_channels'; allowed=array['name'];
 when 'documents' then t='rf_documents'; allowed=array['title','folder_id','phase_id','task_id'];
 when 'meetings' then t='rf_meetings'; allowed=array['title','description','location','agenda'];
 when 'announcements' then t='rf_announcements'; allowed=array['title','body'];
 when 'papers' then t='rf_papers'; allowed=array['title','abstract','keywords','venue'];
 when 'sections' then t='rf_paper_sections'; allowed=array['title','notes'];
 when 'references' then t='rf_references'; allowed=array['authors','title','year','venue','url','notes'];
 when 'datasets' then t='rf_datasets'; allowed=array['name','description'];
 when 'repositories' then t='rf_github_repositories'; allowed=array['url'];
 when 'links' then t='rf_github_links'; allowed=array['url','description'];
 when 'document_comments' then t='rf_document_comments'; allowed=array['body'];
 when 'meeting_notes' then t='rf_meeting_notes'; allowed=array['body'];
 when 'meeting_actions' then t='rf_meeting_actions'; allowed=array['title','due_date'];
 else raise exception 'Unsupported record type'; end case;
 execute format('select to_jsonb(x) from public.%I x where workspace_id=$1 and id=$2 for update',t) into oldrow using w,rid;
 if oldrow is null then raise exception 'Record not found'; end if;
 if entity='documents' and operation in ('trash','restore') then
  perform rf_private.document_lifecycle(case when operation='trash' then 'document_trash' else 'document_restore' end,p);
 else
  if entity='sections' and oldrow->>'status'='Approved' then raise exception 'Approved sections are protected. Keep the decision and create a new section for further work.'; end if;
  if entity='meeting_actions' and oldrow->>'task_id' is not null then raise exception 'This action is already a task. Manage it in Tasks to preserve the conversion record.'; end if;
  if operation='edit' then
   if oldrow->>'deleted_at' is not null or oldrow->>'trashed_at' is not null then raise exception 'Restore this record before editing'; end if;
   if jsonb_typeof(changes)<>'object' or changes='{}'::jsonb or exists(select 1 from jsonb_object_keys(changes) k where not(k=any(allowed))) then raise exception 'Invalid editable fields'; end if;
   newrow=oldrow||changes;
   if entity='repositories' and newrow->>'url' is distinct from oldrow->>'url' and exists(select 1 from public.rf_github_links where workspace_id=w and repository_id=rid) then raise exception 'Repository has linked work. Register the corrected repository separately to preserve those links.'; end if;
   if entity='repositories' and (newrow->>'url' !~ '^https://github[.]com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' or position('..' in newrow->>'url')>0) then raise exception 'Use a GitHub repository HTTPS URL'; end if;
   if entity='links' then
    select url into repo from public.rf_github_repositories where workspace_id=w and id=(oldrow->>'repository_id')::uuid and deleted_at is null;
    ext=case oldrow->>'kind' when 'Issue' then '/issues/[0-9]+' when 'Pull request' then '/pull/[0-9]+' when 'Commit' then '/commit/[a-fA-F0-9]{7,40}' when 'Branch' then '/tree/[A-Za-z0-9_./%~-]+' end;
    if repo is null or ext is null or newrow->>'url' !~ ('^'||replace(repo,'.','[.]')||ext||'$') or position('..' in substring(newrow->>'url' from length(repo)+1))>0 then raise exception 'URL must match the registered repository and link type'; end if;
   end if;
   select string_agg(format('%1$I = (jsonb_populate_record(null::public.%2$I,$1)).%1$I',k,t),',') into assignments from jsonb_object_keys(changes) k;
   if oldrow ? 'updated_at' then assignments=assignments||',updated_at=now()'; end if;
   execute format('update public.%I set %s where workspace_id=$2 and id=$3',t,assignments) using newrow,w,rid;
  elsif operation in ('trash','restore') then
   execute format('update public.%I set deleted_at=$1 where workspace_id=$2 and id=$3',t) using case when operation='trash' then coalesce((oldrow->>'deleted_at')::timestamptz,now()) else null::timestamptz end,w,rid;
  else raise exception 'Unsupported record operation'; end if;
 end if;
 execute format('select to_jsonb(x) from public.%I x where workspace_id=$1 and id=$2',t) into newrow using w,rid;
 if oldrow is distinct from newrow then
  insert into public.rf_record_changes(workspace_id,entity,entity_id,actor_id,action,before_value,after_value) values(w,entity,rid,auth.uid(),operation,oldrow,newrow);
 end if;
 return jsonb_build_object('id',rid);
end $$;
create function public.rf_manage_record(entity text,operation text,p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select rf_private.manage_record(entity,operation,p); $$;
revoke all on function public.rf_manage_record(text,text,jsonb),rf_private.manage_record(text,text,jsonb) from public,anon;
grant execute on function public.rf_manage_record(text,text,jsonb),rf_private.manage_record(text,text,jsonb) to authenticated;

-- Prevent stale clients modifying deleted records or appending to deleted parents.
create function rf_private.guard_deleted_record() returns trigger language plpgsql security definer set search_path='' as $$
declare parent_table text; parent_key text; parent_id uuid; trashed timestamptz;
begin
 if tg_op='UPDATE' and to_jsonb(old)->>'deleted_at' is not null and to_jsonb(new)->>'deleted_at' is not null and (to_jsonb(old)-'deleted_at') is distinct from (to_jsonb(new)-'deleted_at') then raise exception 'Restore this record before editing'; end if;
 case tg_table_name
 when 'rf_messages' then parent_table='rf_channels'; parent_key='channel_id';
 when 'rf_document_comments' then parent_table='rf_documents'; parent_key='document_id';
 when 'rf_meeting_notes','rf_meeting_actions' then parent_table='rf_meetings'; parent_key='meeting_id';
 when 'rf_paper_sections','rf_references' then parent_table='rf_papers'; parent_key='paper_id';
 when 'rf_paper_feedback' then
  select coalesce(s.deleted_at,p.deleted_at) into trashed from public.rf_paper_sections s join public.rf_papers p on p.id=s.paper_id where s.id=new.section_id for update of s,p;
  if trashed is not null then raise exception 'Restore the paper and section before adding feedback'; end if;
  return new;
 when 'rf_submissions' then
  if new.phase_id is not null then
   select deleted_at into trashed from public.rf_research_phases where id=new.phase_id for update;
   if trashed is not null then raise exception 'Restore the phase before requesting review'; end if;
  end if;
  return new;
 when 'rf_reviews' then
  select p.deleted_at into trashed from public.rf_submissions s join public.rf_research_phases p on p.id=s.phase_id where s.id=new.submission_id for update of p;
  if trashed is not null then raise exception 'Restore the phase before reviewing'; end if;
  return new;
 when 'rf_dataset_versions' then parent_table='rf_datasets'; parent_key='dataset_id';
 when 'rf_dataset_access_events' then
  select d.deleted_at into trashed from public.rf_dataset_versions v join public.rf_datasets d on d.id=v.dataset_id where v.id=new.version_id for update of d;
  if trashed is not null then raise exception 'Restore the dataset before downloading'; end if;
  return new;
 when 'rf_github_links' then parent_table='rf_github_repositories'; parent_key='repository_id';
 else return new; end case;
 parent_id=(to_jsonb(new)->>parent_key)::uuid;
 -- Restoring a child requires restoring its parent first.
 if tg_table_name='rf_document_comments' then
  select trashed_at into trashed from public.rf_documents where id=parent_id for update;
 else
  execute format('select deleted_at from public.%I where id=$1 for update',parent_table) into trashed using parent_id;
 end if;
 if trashed is not null then raise exception 'Restore the parent record first'; end if;
 return new;
end $$;
revoke all on function rf_private.guard_deleted_record() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['rf_research_phases','rf_channels','rf_meetings','rf_announcements','rf_papers','rf_paper_sections','rf_references','rf_datasets','rf_github_repositories','rf_github_links','rf_document_comments','rf_meeting_notes','rf_meeting_actions','rf_messages','rf_paper_feedback','rf_dataset_versions','rf_dataset_access_events','rf_submissions','rf_reviews'] loop
  execute format('create trigger guard_deleted_record before insert or update on public.%I for each row execute function rf_private.guard_deleted_record()',t);
 end loop;
end $$;

create or replace function rf_private.dataset_upload(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare b text[]=string_to_array(path,'/'); begin
 return array_length(b,1)=4 and b[3]=auth.uid()::text and rf_private.can_write_dataset(b[1]::uuid,b[2]::uuid) and exists(select 1 from public.rf_datasets d where d.id=b[2]::uuid and d.deleted_at is null and (d.permission_status='Granted' or b[4] like 'evidence-%') and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date));
exception when others then return false; end $$;

-- Downloads remain blocked in Trash, including for leaders, through the existing Edge Function.
create or replace function public.rf_operations(action text,p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if action='dataset_download' and exists(select 1 from public.rf_dataset_versions v join public.rf_datasets d on d.id=v.dataset_id where v.workspace_id=(p->>'workspace_id')::uuid and v.id=(p->>'id')::uuid and d.deleted_at is not null) then raise exception 'Restore the dataset before downloading'; end if;
 return rf_private.operations(action,p);
end $$;
notify pgrst,'reload schema';
