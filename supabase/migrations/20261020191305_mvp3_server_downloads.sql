-- Dataset bytes are signed only by the authenticated Edge Function, never by browser clients.
drop policy dataset_select on storage.objects;
-- The private, expiring issuance-grant table is retained for compatibility with the audit RPC.
-- No client SELECT policy consumes those grants; clients cannot choose a longer signed-link lifetime.
notify pgrst,'reload schema';
