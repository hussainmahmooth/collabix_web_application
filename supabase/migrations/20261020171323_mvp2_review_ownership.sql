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
