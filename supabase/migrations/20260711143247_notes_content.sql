-- Freeform/blank pages store one rich-text document (Tiptap JSON) per page.
alter table pages
  add column content jsonb not null default '{"type":"doc","content":[]}'::jsonb;

-- created_by is server-derived, never client-supplied (same philosophy as
-- household_id derivation): force it on insert.
create or replace function set_created_by()
returns trigger language plpgsql as $$
begin
  new.created_by = auth.uid();
  return new;
end; $$;

create trigger trg_pages_created_by before insert on pages
  for each row execute function set_created_by();
