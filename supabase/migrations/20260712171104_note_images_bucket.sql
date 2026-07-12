-- Storage bucket for images embedded in Notes/blank pages (Reminder.md).
--
-- Public-read so the permanent object URL stored in a page's Tiptap document
-- keeps working offline (once cached) and never expires — unlike a signed
-- URL, which would rot inside the persisted doc. Objects are keyed by an
-- unguessable UUID under a household-id folder: `{household_id}/{uuid}.{ext}`.
--
-- Write access is the real control: only a member of the owning household
-- (the first path segment) may upload or delete. Read is effectively public
-- via the object URL, which is acceptable here — the bucket holds only this
-- two-person household's own note images, addressed by random UUIDs.

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

create policy "household members read note images"
  on storage.objects for select
  using (
    bucket_id = 'note-images'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "household members upload note images"
  on storage.objects for insert
  with check (
    bucket_id = 'note-images'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy "household members delete note images"
  on storage.objects for delete
  using (
    bucket_id = 'note-images'
    and is_household_member((storage.foldername(name))[1]::uuid)
  );
