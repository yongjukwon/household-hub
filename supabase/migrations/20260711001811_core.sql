create extension if not exists "pgcrypto";

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create or replace function is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members hm
    where hm.household_id = target_household_id and hm.user_id = auth.uid()
  );
$$;

alter table households enable row level security;
alter table household_members enable row level security;
create policy "member can read own household" on households for select using (is_household_member(id));
create policy "member can read household roster" on household_members for select using (is_household_member(household_id));
-- no insert/update/delete policies: rows provisioned only via service_role seed script

create type page_section as enum ('budget', 'trip', 'grocery', 'notes');
create type page_template as enum ('blank', 'budget', 'trip', 'grocery');

create table pages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  section page_section not null,
  template page_template not null,
  title text not null,
  created_by uuid not null references auth.users(id),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pages enable row level security;
create policy "household rw" on pages for all
  using (is_household_member(household_id)) with check (is_household_member(household_id));

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_pages_updated_at before update on pages
  for each row execute function set_updated_at();
