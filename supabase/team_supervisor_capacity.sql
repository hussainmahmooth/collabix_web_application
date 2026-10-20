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
