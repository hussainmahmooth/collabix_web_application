-- Sensitive metadata and permission snapshots never enter the workspace-wide activity feed.
create table public.rf_dataset_changes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null, dataset_id uuid not null,
 actor_id uuid not null references public.rf_profiles(id), before_value jsonb, after_value jsonb not null,
 created_at timestamptz not null default now(), foreign key(workspace_id,dataset_id) references public.rf_datasets(workspace_id,id)
);
create index rf_dataset_changes_workspace on public.rf_dataset_changes(workspace_id,dataset_id,created_at desc);
alter table public.rf_dataset_changes enable row level security;
revoke all on public.rf_dataset_changes from public,anon,authenticated;
grant select on public.rf_dataset_changes to authenticated;
create policy dataset_history_read on public.rf_dataset_changes for select to authenticated using(rf_private.can_dataset(workspace_id,dataset_id));
create function rf_private.dataset_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not rf_private.has_role(new.workspace_id) then raise exception 'Workspace membership required'; end if;
 insert into public.rf_dataset_changes(workspace_id,dataset_id,actor_id,before_value,after_value) values(new.workspace_id,new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function rf_private.dataset_history() from public,anon,authenticated;
create trigger dataset_history after insert or update on public.rf_datasets for each row execute function rf_private.dataset_history();
notify pgrst,'reload schema';
