-- Phase 3 extension: media bucket for profile pictures + team logos + headers.
-- Writes always go through server actions using the service-role key so we
-- can run sharp resize + MIME validation before the bytes land. Reads are
-- public (paths are unguessable UUIDs) to keep rendering cheap.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Deny all direct writes from authenticated/anon clients. Server actions use
-- the service-role key, which bypasses RLS.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_no_client_insert'
  ) then
    execute $policy$
      create policy media_no_client_insert on storage.objects
        for insert to authenticated, anon with check (false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_no_client_update'
  ) then
    execute $policy$
      create policy media_no_client_update on storage.objects
        for update to authenticated, anon using (false) with check (false)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'media_no_client_delete'
  ) then
    execute $policy$
      create policy media_no_client_delete on storage.objects
        for delete to authenticated, anon using (false)
    $policy$;
  end if;
end$$;
