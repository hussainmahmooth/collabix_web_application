drop policy rf_file_read on storage.objects;
create policy rf_file_read on storage.objects for select to authenticated using(bucket_id='researchflow-files' and exists(select 1 from public.rf_files f where f.path=storage.objects.name and rf_private.can_file(f.workspace_id,f.id)));
