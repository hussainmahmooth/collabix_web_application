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
