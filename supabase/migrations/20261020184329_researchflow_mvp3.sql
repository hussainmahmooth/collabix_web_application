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
