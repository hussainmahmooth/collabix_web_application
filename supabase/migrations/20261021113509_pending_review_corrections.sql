-- Corrections preserve the original request and every existing decision.
alter table public.rf_submissions drop constraint rf_submissions_status_check;
alter table public.rf_submissions add constraint rf_submissions_status_check check(status in ('Submitted for Review','Revision Requested','Approved','Rejected','Withdrawn'));
alter table public.rf_submissions add column withdrawn_at timestamptz,
 add column withdrawn_by uuid references public.rf_profiles(id),
 add column correction_reason text check(length(correction_reason)<=2000),
 add column replaces_submission_id uuid,
 add foreign key(workspace_id,replaces_submission_id) references public.rf_submissions(workspace_id,id);
create index rf_submission_replaces on public.rf_submissions(workspace_id,replaces_submission_id) where replaces_submission_id is not null;

create function rf_private.change_submission(action text,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w uuid=(p->>'workspace_id')::uuid; s public.rf_submissions; d public.rf_documents;
 result jsonb; reason text=trim(p->>'reason'); phase_state text;
begin
 if auth.uid() is null or not rf_private.has_role(w,array['leader','member']) then raise exception 'Leader or requester access required' using errcode='42501'; end if;
 select * into s from public.rf_submissions where workspace_id=w and id=(p->>'submission_id')::uuid for update;
 if s.id is null or not rf_private.can_submission(w,s.id) or not(s.requested_by=auth.uid() or rf_private.has_role(w,array['leader'])) then raise exception 'Only the requester or a workspace leader can correct a submission' using errcode='42501'; end if;
 if s.status<>'Submitted for Review' or exists(select 1 from public.rf_reviews where submission_id=s.id and kind='Academic') then raise exception 'Only pending academic submissions can be corrected'; end if;
 if reason is null or length(reason) not between 1 and 2000 then raise exception 'Explain the correction (1 to 2000 characters)'; end if;
 if s.version_id is not null then
  select doc.* into d from public.rf_documents doc join public.rf_document_versions v on v.document_id=doc.id where v.id=s.version_id for update of doc;
  if d.trashed_at is not null then raise exception 'Restore the document before correcting its submission'; end if;
 end if;
 if action not in ('review_withdraw','review_correct') then raise exception 'Unknown review action'; end if;
 update public.rf_submissions set status='Withdrawn',withdrawn_at=now(),withdrawn_by=auth.uid(),correction_reason=reason where id=s.id;
 if s.phase_id is not null then
  select case when r.decision='Rejected' then 'Revision Requested' else r.decision end into phase_state from public.rf_reviews r join public.rf_submissions x on x.id=r.submission_id where x.workspace_id=w and x.phase_id=s.phase_id and r.kind='Academic' order by r.created_at desc limit 1;
  update public.rf_research_phases set review_state=coalesce(phase_state,'Not requested') where workspace_id=w and id=s.phase_id;
 end if;
 if action='review_correct' then
  if s.version_id is not null then
   if (p->>'version_id')::uuid=s.version_id then raise exception 'Choose a different document version, or withdraw the submission'; end if;
   result=rf_private.collaborate('review_request',jsonb_build_object('workspace_id',w,'version_id',(p->>'version_id')::uuid));
  else
   result=rf_private.collaborate('review_request',jsonb_build_object('workspace_id',w,'phase_id',(p->>'phase_id')::uuid));
  end if;
  update public.rf_submissions set replaces_submission_id=s.id where id=(result->>'id')::uuid;
  return result;
 end if;
 return jsonb_build_object('id',s.id);
end $$;
revoke all on function rf_private.change_submission(text,jsonb) from public,anon;
grant execute on function rf_private.change_submission(text,jsonb) to authenticated;

create or replace function public.rf_collaborate(action text,p jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select case when action in ('document_trash','document_restore','document_unarchive') then rf_private.document_lifecycle(action,p)
 when action in ('review_withdraw','review_correct') then rf_private.change_submission(action,p)
 else rf_private.collaborate(action,p) end;
$$;

-- Even a stale client cannot decide a withdrawn request through the original RPC.
create function rf_private.guard_withdrawn_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare state text;
begin
 select status into state from public.rf_submissions where id=new.submission_id for update;
 if state='Withdrawn' then raise exception 'This submission was withdrawn; review its replacement instead'; end if;
 return new;
end $$;
revoke all on function rf_private.guard_withdrawn_review() from public,anon,authenticated;
create trigger rf_review_withdrawn_guard before insert on public.rf_reviews for each row execute function rf_private.guard_withdrawn_review();
