-- Cloud integration test: temporary synthetic users, all data rolled back.
begin;
create function pg_temp.must_fail(command text) returns void language plpgsql as $$
begin
 begin execute command; exception when others then return; end;
 raise exception 'FAIL: unauthorized/invalid operation succeeded: %',command;
end $$;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is not true then raise exception 'FAIL: %',label; end if; end $$;
select set_config('rf.test.leader',gen_random_uuid()::text,true),set_config('rf.test.member',gen_random_uuid()::text,true),set_config('rf.test.supervisor',gen_random_uuid()::text,true),set_config('rf.test.outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select current_setting('rf.test.'||n)::uuid,'rf-mvp3-'||current_setting('rf.test.'||n)||'@example.invalid',now(),jsonb_build_object('full_name','MVP3 test '||n) from unnest(array['leader','member','supervisor','outsider']) n;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
select set_config('rf.test.w',public.rf_create_workspace('MVP3 test team','Isolated test research','Test Leader')::text,true);
select pg_temp.assert_true((select count(*)=7 from public.rf_channels where workspace_id=current_setting('rf.test.w')::uuid),'seven default channels');
select pg_temp.assert_true((select count(*)=10 from public.rf_document_folders where workspace_id=current_setting('rf.test.w')::uuid),'ten default folders');
insert into public.rf_workspace_invitations(workspace_id,email,role) select current_setting('rf.test.w')::uuid,'rf-mvp3-'||current_setting('rf.test.'||n)||'@example.invalid',n from unnest(array['member','supervisor']) n;
select set_config('rf.test.tokenmember',(select token::text from public.rf_workspace_invitations where workspace_id=current_setting('rf.test.w')::uuid and role='member'),true),set_config('rf.test.tokensupervisor',(select token::text from public.rf_workspace_invitations where workspace_id=current_setting('rf.test.w')::uuid and role='supervisor'),true);
select set_config('request.jwt.claim.sub',current_setting('rf.test.member'),true);
select public.rf_accept_invitation(current_setting('rf.test.tokenmember')::uuid,'Test Member');
select set_config('request.jwt.claim.sub',current_setting('rf.test.supervisor'),true);
select public.rf_accept_invitation(current_setting('rf.test.tokensupervisor')::uuid,'Test Supervisor');
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);


select set_config('rf.test.doc',(public.rf_collaborate('document_create',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'folder_id',(select id from public.rf_document_folders where workspace_id=current_setting('rf.test.w')::uuid limit 1),'title','CRUD document'))->>'id'),true);
select set_config('rf.test.paper',(public.rf_operations('paper_save',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'title','CRUD paper','status','Planning','authors','[]'::jsonb))->>'id'),true);
select set_config('rf.test.dataset',(public.rf_operations('dataset_save',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'name','CRUD dataset','classification','Public','permission_status','Not requested','status','Proposed','restricted',false,'readers','[]'::jsonb))->>'id'),true);
select set_config('rf.test.repo',(public.rf_operations('repository_save',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'url','https://github.com/example/crud'))->>'id'),true);
select set_config('rf.test.version',(public.rf_operations('dataset_version',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'dataset_id',current_setting('rf.test.dataset'),'kind','Permission evidence','external_url','https://example.invalid/evidence','name','Synthetic evidence'))->>'id'),true);
reset role;
insert into public.rf_meetings(workspace_id,title,type,starts_at,ends_at,timezone,organizer_id) values(current_setting('rf.test.w')::uuid,'CRUD meeting','Team Meeting',now(),now()+interval '1 hour','Asia/Colombo',current_setting('rf.test.leader')::uuid);
insert into public.rf_announcements(workspace_id,title,body,author_id) values(current_setting('rf.test.w')::uuid,'CRUD announcement','Original body',current_setting('rf.test.leader')::uuid);
insert into public.rf_references(workspace_id,paper_id,title) values(current_setting('rf.test.w')::uuid,current_setting('rf.test.paper')::uuid,'CRUD reference');
insert into public.rf_document_comments(workspace_id,document_id,body,author_id) values(current_setting('rf.test.w')::uuid,current_setting('rf.test.doc')::uuid,'Original comment',current_setting('rf.test.leader')::uuid);
insert into public.rf_meeting_notes(workspace_id,meeting_id,kind,body,author_id) select workspace_id,id,'Minutes','Original minutes',organizer_id from public.rf_meetings where workspace_id=current_setting('rf.test.w')::uuid;
insert into public.rf_meeting_actions(workspace_id,meeting_id,title,assignee_id,due_date,created_by) select workspace_id,id,'CRUD action',organizer_id,current_date,organizer_id from public.rf_meetings where workspace_id=current_setting('rf.test.w')::uuid;
insert into public.rf_tasks(workspace_id,title) values(current_setting('rf.test.w')::uuid,'CRUD task');
insert into public.rf_github_links(workspace_id,repository_id,task_id,member_id,kind,url) select workspace_id,current_setting('rf.test.repo')::uuid,id,current_setting('rf.test.leader')::uuid,'Issue','https://github.com/example/crud/issues/1' from public.rf_tasks where workspace_id=current_setting('rf.test.w')::uuid;
create temporary table crud_fixtures(entity text,t text,rid uuid,changes jsonb);
do $$ declare e text; t text; rid uuid; changes jsonb; begin
 foreach e in array array['phases','channels','documents','meetings','announcements','papers','sections','references','datasets','repositories','links','document_comments','meeting_notes','meeting_actions'] loop
  t=case e when 'phases' then 'rf_research_phases' when 'sections' then 'rf_paper_sections' when 'repositories' then 'rf_github_repositories' when 'links' then 'rf_github_links' else 'rf_'||e end;
  execute format('select id from public.%I where workspace_id=$1 order by id limit 1',t) into rid using current_setting('rf.test.w')::uuid;
  changes=case when e in ('phases','channels','datasets') then '{"name":"Corrected name"}'::jsonb when e='repositories' then '{"url":"https://github.com/example/crud"}'::jsonb when e='links' then '{"description":"Corrected link"}'::jsonb when e in ('document_comments','meeting_notes') then '{"body":"Corrected body"}'::jsonb else '{"title":"Corrected title"}'::jsonb end;
  insert into crud_fixtures values(e,t,rid,changes);
 end loop;
end $$;
grant select on crud_fixtures to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
do $$ declare f record; rowdata jsonb; begin
 for f in select * from crud_fixtures loop
  perform public.rf_manage_record(f.entity,'edit',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid,'changes',f.changes));
  execute format('select to_jsonb(x) from public.%I x where id=$1',f.t) into rowdata using f.rid;
  perform pg_temp.assert_true(rowdata @> f.changes,'updated '||f.entity);
  perform pg_temp.must_fail(format('select public.rf_manage_record(%L,''edit'',%L::jsonb)',f.entity,jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid,'changes',jsonb_build_object('workspace_id',gen_random_uuid()))));
  perform public.rf_manage_record(f.entity,'trash',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid));
  execute format('select to_jsonb(x) from public.%I x where id=$1',f.t) into rowdata using f.rid;
  perform pg_temp.assert_true(coalesce(rowdata->>'deleted_at',rowdata->>'trashed_at') is not null,'trashed '||f.entity);
  perform pg_temp.must_fail(format('select public.rf_manage_record(%L,''edit'',%L::jsonb)',f.entity,jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid,'changes',f.changes)));
  if f.entity='datasets' then
   perform pg_temp.must_fail(format('select public.rf_operations(''dataset_download'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',current_setting('rf.test.version'))));
   perform pg_temp.must_fail(format('select rf_private.operations(''dataset_download'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',current_setting('rf.test.version'))));
   perform pg_temp.assert_true(not rf_private.dataset_upload(current_setting('rf.test.w')||'/'||f.rid||'/'||current_setting('rf.test.leader')||'/evidence-'||gen_random_uuid()||'.csv'),'Trash blocks dataset uploads');
  end if;
  if f.entity='papers' then
   perform pg_temp.must_fail(format('select public.rf_operations(''reference_save'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'paper_id',f.rid,'references',jsonb_build_array(jsonb_build_object('title','Stale child')))));
   perform pg_temp.must_fail(format('select public.rf_operations(''section_feedback'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'section_id',(select id from public.rf_paper_sections where paper_id=f.rid limit 1),'kind','Comment','body','Stale feedback')));
  end if;
  if f.entity='phases' then perform pg_temp.must_fail(format('select public.rf_collaborate(''review_request'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'phase_id',f.rid))); end if;
  if f.entity='channels' then perform pg_temp.must_fail(format('select public.rf_collaborate(''message_send'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'channel_id',f.rid,'body','Stale message'))); end if;
  perform public.rf_manage_record(f.entity,'restore',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid));
  execute format('select to_jsonb(x) from public.%I x where id=$1',f.t) into rowdata using f.rid;
  perform pg_temp.assert_true(coalesce(rowdata->>'deleted_at',rowdata->>'trashed_at') is null,'restored '||f.entity);
 end loop;
end $$;
select pg_temp.assert_true((select count(*)>=40 from public.rf_record_changes where workspace_id=current_setting('rf.test.w')::uuid),'immutable before/after snapshots recorded');
select pg_temp.must_fail('update public.rf_record_changes set action=''forged''');
select public.rf_operations('dataset_download',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',current_setting('rf.test.version')));
do $$ declare who text; f record; op text; begin
 foreach who in array array['member','supervisor','outsider'] loop
  perform set_config('request.jwt.claim.sub',current_setting('rf.test.'||who),true);
  for f in select * from crud_fixtures loop
   foreach op in array array['edit','trash','restore'] loop
    perform pg_temp.must_fail(format('select public.rf_manage_record(%L,%L,%L::jsonb)',f.entity,op,jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',f.rid,'changes',f.changes)));
   end loop;
  end loop;
  perform pg_temp.assert_true((select count(*)=0 from public.rf_record_changes where workspace_id=current_setting('rf.test.w')::uuid),'change snapshots hidden from '||who);
 end loop;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
select pg_temp.must_fail(format('select public.rf_manage_record(''papers'',''trash'',%L::jsonb)',jsonb_build_object('workspace_id',gen_random_uuid(),'id',current_setting('rf.test.paper'))));
select pg_temp.must_fail(format('select public.rf_manage_record(''reviews'',''trash'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',gen_random_uuid())));
reset role;
update public.rf_paper_sections set status='Approved' where id=(select rid from crud_fixtures where entity='sections');
update public.rf_meeting_actions set task_id=(select id from public.rf_tasks where workspace_id=current_setting('rf.test.w')::uuid limit 1) where id=(select rid from crud_fixtures where entity='meeting_actions');
set local role authenticated;
select pg_temp.must_fail(format('select public.rf_manage_record(''sections'',''trash'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',(select rid from crud_fixtures where entity='sections'))));
select pg_temp.must_fail(format('select public.rf_manage_record(''meeting_actions'',''trash'',%L::jsonb)',jsonb_build_object('workspace_id',current_setting('rf.test.w'),'id',(select rid from crud_fixtures where entity='meeting_actions'))));
select 'CRUD authorization, recovery and history checks passed' as result;
rollback;
