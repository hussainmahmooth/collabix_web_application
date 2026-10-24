-- Run against Supabase as postgres. All fixtures roll back; no real accounts are changed.
begin;
select set_config('rf.test.leader',gen_random_uuid()::text,true),set_config('rf.test.member',gen_random_uuid()::text,true),set_config('rf.test.outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select current_setting('rf.test.'||n)::uuid,'rf-test-'||n||'-'||current_setting('rf.test.'||n)||'@example.invalid',now(),jsonb_build_object('full_name','RF test '||n) from unnest(array['leader','member','outsider']) n;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
select set_config('rf.test.workspace',public.rf_create_workspace('Isolation test','Test research','Test Leader')::text,true);
insert into public.rf_workspace_invitations(workspace_id,email,role)
values(current_setting('rf.test.workspace')::uuid,'rf-test-member-'||current_setting('rf.test.member')||'@example.invalid','member');
select set_config('rf.test.token',(select token::text from public.rf_workspace_invitations where workspace_id=current_setting('rf.test.workspace')::uuid),true);
select set_config('request.jwt.claim.sub',current_setting('rf.test.outsider'),true);
do $$ begin
 if (select count(*) from public.rf_workspaces)<>0 then raise exception 'FAIL outsider read workspace'; end if;
 if (select count(*) from public.rf_workspace_invitations)<>0 then raise exception 'FAIL outsider read invitations'; end if;
 begin perform public.rf_accept_invitation(current_setting('rf.test.token')::uuid,'Wrong Email'); raise exception 'FAIL wrong email accepted'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.member'),true);
select public.rf_accept_invitation(current_setting('rf.test.token')::uuid,'Test Member');
do $$ begin
 if (select count(*) from public.rf_workspaces)<>1 then raise exception 'FAIL member workspace read'; end if;
 begin update public.rf_workspace_members set role='leader' where user_id=auth.uid(); raise exception 'FAIL self promotion'; exception when insufficient_privilege then null; end;
 begin perform public.rf_manage_member(current_setting('rf.test.workspace')::uuid,auth.uid(),'leader'); raise exception 'FAIL RPC self promotion'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
 begin insert into public.rf_tasks(workspace_id,title) values(current_setting('rf.test.workspace')::uuid,'Unauthorized'); raise exception 'FAIL member created task'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
insert into public.rf_tasks(workspace_id,title,assignee_id) values(current_setting('rf.test.workspace')::uuid,'Assigned task',current_setting('rf.test.member')::uuid);
select set_config('rf.test.task',(select id::text from public.rf_tasks where workspace_id=current_setting('rf.test.workspace')::uuid limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('rf.test.member'),true);
update public.rf_tasks set status='In Progress' where id=current_setting('rf.test.task')::uuid;
do $$ begin
 if (select status from public.rf_tasks where id=current_setting('rf.test.task')::uuid)<>'In Progress' then raise exception 'FAIL member status'; end if;
 begin update public.rf_tasks set status='Completed' where id=current_setting('rf.test.task')::uuid; raise exception 'FAIL member self approval'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
 begin update public.rf_tasks set priority='Critical' where id=current_setting('rf.test.task')::uuid; raise exception 'FAIL member task reassignment'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
 if (select count(*) from public.rf_workspace_invitations)>0 then raise exception 'FAIL member invite read'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
update public.rf_tasks set status='Completed' where id=current_setting('rf.test.task')::uuid;
do $$ begin
 if (select status from public.rf_tasks where id=current_setting('rf.test.task')::uuid)<>'Completed' then raise exception 'FAIL leader approval'; end if;
 if not exists(select 1 from public.rf_audit_events where workspace_id=current_setting('rf.test.workspace')::uuid and action='rf_tasks.UPDATE') then raise exception 'FAIL audit'; end if;
 begin perform public.rf_manage_member(current_setting('rf.test.workspace')::uuid,auth.uid(),null); raise exception 'FAIL founding leader removed'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.outsider'),true);
select set_config('rf.test.other_workspace',public.rf_create_workspace('Other team','Independent research','Test Outsider')::text,true);
do $$ declare phase uuid; begin
 select id into phase from public.rf_research_phases where workspace_id=current_setting('rf.test.other_workspace')::uuid limit 1;
 perform set_config('rf.test.other_phase',phase::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
do $$ begin
 begin update public.rf_tasks set phase_id=current_setting('rf.test.other_phase')::uuid where id=current_setting('rf.test.task')::uuid; raise exception 'FAIL cross workspace phase'; exception when foreign_key_violation then null; end;
 begin update public.rf_tasks set workspace_id=current_setting('rf.test.other_workspace')::uuid where id=current_setting('rf.test.task')::uuid; raise exception 'FAIL workspace changed'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
-- Recoverable task deletion uses the existing archive boundary.
update public.rf_tasks set status='In Progress',archived=true where id=current_setting('rf.test.task')::uuid;
do $$ begin
 if not exists(select 1 from public.rf_tasks where id=current_setting('rf.test.task')::uuid and archived) then raise exception 'FAIL leader task delete'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.member'),true);
do $$ begin
 begin
  update public.rf_tasks set archived=false where id=current_setting('rf.test.task')::uuid;
  if found then raise exception 'FAIL member task restore'; end if;
 exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rf.test.leader'),true);
update public.rf_tasks set archived=false where id=current_setting('rf.test.task')::uuid;
do $$ begin
 if not exists(select 1 from public.rf_tasks where id=current_setting('rf.test.task')::uuid and not archived and status='In Progress') then raise exception 'FAIL leader task restore preserves task'; end if;
end $$;
reset role;
rollback;
select 'PASS: workspace isolation, invitation binding, member permissions, approval boundary, audit, founding leader, cross-workspace relationships; fixtures rolled back' as result;
