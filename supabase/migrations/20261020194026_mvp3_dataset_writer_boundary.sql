create function rf_private.can_write_dataset(w uuid,d uuid) returns boolean language sql stable security definer set search_path='' as $$
 select rf_private.has_role(w,array['leader','member']) and rf_private.can_dataset(w,d) and exists(select 1 from public.rf_datasets x where x.workspace_id=w and x.id=d and (x.created_by=auth.uid() or x.assignee_id=auth.uid() or rf_private.has_role(w,array['leader'])));
$$;
revoke all on function rf_private.can_write_dataset(uuid,uuid) from public,anon;
grant execute on function rf_private.can_write_dataset(uuid,uuid) to authenticated;
create or replace function rf_private.dataset_upload(path text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare b text[]=string_to_array(path,'/'); begin
 return array_length(b,1)=4 and b[3]=auth.uid()::text and rf_private.can_write_dataset(b[1]::uuid,b[2]::uuid) and exists(select 1 from public.rf_datasets d where d.id=b[2]::uuid and (d.permission_status='Granted' or b[4] like 'evidence-%') and d.status not in ('Restricted','Archived') and (d.retention_date is null or d.retention_date>=current_date));
exception when others then return false; end $$;
create function rf_private.guard_dataset_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not rf_private.can_write_dataset(new.workspace_id,new.dataset_id) then raise exception 'Only leaders, custodians and assigned researchers append dataset versions' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function rf_private.guard_dataset_version() from public,anon,authenticated;
create trigger guard_dataset_version before insert on public.rf_dataset_versions for each row execute function rf_private.guard_dataset_version();
