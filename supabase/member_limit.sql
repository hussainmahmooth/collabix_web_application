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
