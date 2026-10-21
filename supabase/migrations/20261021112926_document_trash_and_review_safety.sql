-- Recoverable leader-only Trash. No rows or Storage objects are removed.
alter table public.rf_documents add column trashed_at timestamptz;

create or replace function rf_private.can_document(w uuid,d uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and rf_private.has_role(w) and exists(
 select 1 from public.rf_documents x where x.workspace_id=w and x.id=d
 and (x.trashed_at is null or rf_private.has_role(w,array['leader']))
 and (not x.restricted or x.created_by=auth.uid() or rf_private.has_role(w,array['leader','supervisor'])
 or exists(select 1 from public.rf_document_access a where a.workspace_id=w and a.document_id=d and a.user_id=auth.uid())));
$$;

create function rf_private.document_lifecycle(action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w uuid=(p->>'workspace_id')::uuid; d uuid=(p->>'id')::uuid; doc public.rf_documents;
begin
 if auth.uid() is null or not rf_private.has_role(w,array['leader']) then
  raise exception 'Only workspace leaders can delete or restore documents' using errcode='42501';
 end if;
 select * into doc from public.rf_documents where workspace_id=w and id=d for update;
 if doc.id is null then raise exception 'Document not found' using errcode='42501'; end if;
 if action='document_trash' then
  if doc.trashed_at is null then update public.rf_documents set trashed_at=now(),updated_at=now() where id=d; end if;
 elsif action='document_restore' then
  if doc.trashed_at is not null then update public.rf_documents set trashed_at=null,updated_at=now() where id=d; end if;
 elsif action='document_unarchive' then
  if doc.trashed_at is not null then raise exception 'Restore the document from Trash first'; end if;
  update public.rf_documents set archived=false,updated_at=now() where id=d;
 else raise exception 'Unknown document action'; end if;
 return jsonb_build_object('id',d);
end $$;
revoke all on function rf_private.document_lifecycle(text,jsonb) from public,anon;
grant execute on function rf_private.document_lifecycle(text,jsonb) to authenticated;

create or replace function public.rf_collaborate(action text,p jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select case when action in ('document_trash','document_restore','document_unarchive')
 then rf_private.document_lifecycle(action,p) else rf_private.collaborate(action,p) end;
$$;

-- Serialize writes against Trash/restore; no versions, comments, reviews or new file
-- registrations may be added to a trashed document, including by its leader.
create function rf_private.guard_trashed_document() returns trigger
language plpgsql security definer set search_path='' as $$
declare d uuid; v uuid; t timestamptz;
begin
 if tg_table_name='rf_documents' then
  if old.trashed_at is not null and new.trashed_at is not distinct from old.trashed_at then
   raise exception 'Restore the document before modifying it';
  end if;
  return new;
 elsif tg_table_name in ('rf_files','rf_document_versions','rf_document_comments') then d=new.document_id;
 elsif tg_table_name='rf_submissions' then v=new.version_id;
 elsif tg_table_name='rf_reviews' then select version_id into v from public.rf_submissions where id=new.submission_id;
 end if;
 if v is not null then select document_id into d from public.rf_document_versions where id=v; end if;
 if d is not null then
  select trashed_at into t from public.rf_documents where id=d for update;
  if t is not null then raise exception 'Restore the document before modifying it or recording a review'; end if;
 end if;
 return new;
end $$;
revoke all on function rf_private.guard_trashed_document() from public,anon,authenticated;
create trigger rf_trash_guard before update on public.rf_documents for each row execute function rf_private.guard_trashed_document();
create trigger rf_trash_guard before insert on public.rf_files for each row execute function rf_private.guard_trashed_document();
create trigger rf_trash_guard before insert on public.rf_document_versions for each row execute function rf_private.guard_trashed_document();
create trigger rf_trash_guard before insert on public.rf_document_comments for each row execute function rf_private.guard_trashed_document();
create trigger rf_trash_guard before insert on public.rf_submissions for each row execute function rf_private.guard_trashed_document();
create trigger rf_trash_guard before insert on public.rf_reviews for each row execute function rf_private.guard_trashed_document();
