-- Fixtures roll back: six team places (leaders included) and one supervisor.
begin;
create temporary table rf_limit_fixture as select n,gen_random_uuid() as id,'rf-cap-'||gen_random_uuid()||'@example.invalid' as email from generate_series(1,9) n;
grant select on rf_limit_fixture to authenticated;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select id,email,now(),jsonb_build_object('full_name','Capacity Test '||n) from rf_limit_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
select set_config('rf.test.cap_workspace',public.rf_create_workspace('Capacity test','Six team plus supervisor','Capacity Leader')::text,true);
insert into public.rf_workspace_invitations(workspace_id,email,role) select current_setting('rf.test.cap_workspace')::uuid,email,case when n=9 then 'supervisor' else 'member' end from rf_limit_fixture where n in (8,9);
select set_config('rf.test.team_token',(select token::text from public.rf_workspace_invitations where email=(select email from rf_limit_fixture where n=8)),true);
select set_config('rf.test.super_token',(select token::text from public.rf_workspace_invitations where email=(select email from rf_limit_fixture where n=9)),true);
do $$ declare person record; token uuid; begin
 for person in select * from rf_limit_fixture where n between 2 and 6 order by n loop
  perform set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
  insert into public.rf_workspace_invitations(workspace_id,email,role) values(current_setting('rf.test.cap_workspace')::uuid,person.email,'member') returning rf_workspace_invitations.token into token;
  perform set_config('request.jwt.claim.sub',person.id::text,true);
  perform public.rf_accept_invitation(token,'Team Member');
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=8),true);
do $$ begin
 begin perform public.rf_accept_invitation(current_setting('rf.test.team_token')::uuid,'Extra team member'); raise exception 'FAIL: seventh team member admitted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
insert into public.rf_workspace_invitations(workspace_id,email,role) select current_setting('rf.test.cap_workspace')::uuid,email,'supervisor' from rf_limit_fixture where n=7;
select set_config('rf.test.first_super_token',(select token::text from public.rf_workspace_invitations where email=(select email from rf_limit_fixture where n=7)),true);
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=7),true);
select public.rf_accept_invitation(current_setting('rf.test.first_super_token')::uuid,'Supervisor');
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=9),true);
do $$ begin
 begin perform public.rf_accept_invitation(current_setting('rf.test.super_token')::uuid,'Second Supervisor'); raise exception 'FAIL: second supervisor admitted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
do $$ begin
 if (select count(*) from public.rf_workspace_members where workspace_id=current_setting('rf.test.cap_workspace')::uuid)<>7 then raise exception 'FAIL: expected seven people'; end if;
 begin perform public.rf_manage_member(current_setting('rf.test.cap_workspace')::uuid,(select id from rf_limit_fixture where n=7),'member'); raise exception 'FAIL: supervisor converted into seventh team member'; exception when check_violation then null; end;
 begin perform public.rf_manage_member(current_setting('rf.test.cap_workspace')::uuid,(select id from rf_limit_fixture where n=2),'supervisor'); raise exception 'FAIL: member converted into second supervisor'; exception when check_violation then null; end;
 begin insert into public.rf_workspace_invitations(workspace_id,email,role) values(current_setting('rf.test.cap_workspace')::uuid,'extra-team@example.invalid','member'); raise exception 'FAIL: full-team invite'; exception when check_violation then null; end;
 begin insert into public.rf_workspace_invitations(workspace_id,email,role) values(current_setting('rf.test.cap_workspace')::uuid,'extra-super@example.invalid','supervisor'); raise exception 'FAIL: extra supervisor invite'; exception when check_violation then null; end;
 if exists(select 1 from public.rf_workspace_invitations where token in (current_setting('rf.test.team_token')::uuid,current_setting('rf.test.super_token')::uuid) and accepted_at is not null) then raise exception 'FAIL: rejected invitation consumed'; end if;
 perform public.rf_manage_member(current_setting('rf.test.cap_workspace')::uuid,(select id from rf_limit_fixture where n=2),null);
 perform public.rf_manage_member(current_setting('rf.test.cap_workspace')::uuid,(select id from rf_limit_fixture where n=7),null);
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=8),true);
select public.rf_accept_invitation(current_setting('rf.test.team_token')::uuid,'Replacement Member');
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=9),true);
select public.rf_accept_invitation(current_setting('rf.test.super_token')::uuid,'Replacement Supervisor');
do $$ begin
 if (select count(*) from public.rf_workspace_members where workspace_id=current_setting('rf.test.cap_workspace')::uuid)<>7 then raise exception 'FAIL: replacement seats'; end if;
 perform public.rf_create_workspace('Independent team','Independent quota','Replacement Supervisor');
end $$;
reset role;
rollback;
select 'PASS: six team members plus one supervisor; separate quotas, invitations, role-change bypass protection, reusable rejected links, replacements and workspace isolation; fixtures rolled back' as result;
