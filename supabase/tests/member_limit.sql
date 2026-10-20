-- Synthetic fixtures are rolled back. Includes leader and supervisor in the cap.
begin;
create temporary table rf_limit_fixture as select n,gen_random_uuid() as id,'rf-cap-'||gen_random_uuid()||'@example.invalid' as email from generate_series(1,7) n;
grant select on rf_limit_fixture to authenticated;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) select id,email,now(),jsonb_build_object('full_name','Capacity Test '||n) from rf_limit_fixture;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
select set_config('rf.test.cap_workspace',public.rf_create_workspace('Capacity test','Six member limit','Capacity Leader')::text,true);
insert into public.rf_workspace_invitations(workspace_id,email,role) select current_setting('rf.test.cap_workspace')::uuid,email,'member' from rf_limit_fixture where n=7;
select set_config('rf.test.cap_token',(select token::text from public.rf_workspace_invitations where workspace_id=current_setting('rf.test.cap_workspace')::uuid),true);
do $$ declare person record; token uuid; begin
 for person in select * from rf_limit_fixture where n between 2 and 6 order by n loop
  perform set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
  insert into public.rf_workspace_invitations(workspace_id,email,role) values(current_setting('rf.test.cap_workspace')::uuid,person.email,case when person.n=6 then 'supervisor' else 'member' end) returning rf_workspace_invitations.token into token;
  perform set_config('request.jwt.claim.sub',person.id::text,true);
  perform public.rf_accept_invitation(token,'Capacity Member');
 end loop;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=7),true);
do $$ begin
 begin perform public.rf_accept_invitation(current_setting('rf.test.cap_token')::uuid,'Seventh Member'); raise exception 'FAIL: seventh member admitted'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=1),true);
do $$ begin
 if (select count(*) from public.rf_workspace_members where workspace_id=current_setting('rf.test.cap_workspace')::uuid)<>6 then raise exception 'FAIL: incorrect capacity'; end if;
 if (select accepted_at from public.rf_workspace_invitations where token=current_setting('rf.test.cap_token')::uuid) is not null then raise exception 'FAIL: rejected invitation consumed'; end if;
 begin insert into public.rf_workspace_invitations(workspace_id,email,role) values(current_setting('rf.test.cap_workspace')::uuid,'another@example.invalid','supervisor'); raise exception 'FAIL: invitation created for full team'; exception when check_violation then null; end;
 perform public.rf_manage_member(current_setting('rf.test.cap_workspace')::uuid,(select id from rf_limit_fixture where n=2),null);
end $$;
select set_config('request.jwt.claim.sub',(select id::text from rf_limit_fixture where n=7),true);
select public.rf_accept_invitation(current_setting('rf.test.cap_token')::uuid,'Replacement Member');
do $$ begin
 if (select count(*) from public.rf_workspace_members where workspace_id=current_setting('rf.test.cap_workspace')::uuid)<>6 then raise exception 'FAIL: replacement did not fill sixth seat'; end if;
 perform public.rf_create_workspace('Independent team','Separate capacity','Replacement Member');
end $$;
reset role;
rollback;
select 'PASS: six accepted including leader/supervisor, seventh rejected, full-team invitations rejected, rejected token preserved, replacement allowed, independent workspace unaffected; fixtures rolled back' as result;
