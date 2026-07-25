-- Every Statement starts with the approved income categories in all 12 months.
create or replace function public.mobile_ensure_default_income_categories(
  target_year_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_household_id uuid;
  target_created_by uuid;
begin
  select household_id, created_by
  into target_household_id, target_created_by
  from public.ledger_years
  where id = target_year_id;

  if not found then
    return;
  end if;

  insert into public.ledger_categories (
    id,
    household_id,
    year_id,
    kind,
    system_key,
    created_by,
    revision
  )
  select
    gen_random_uuid(),
    target_household_id,
    target_year_id,
    'income',
    defaults.system_key,
    target_created_by,
    1
  from (
    values
      ('salary'),
      ('bonus'),
      ('rrsp'),
      ('tfsa'),
      ('espp'),
      ('government_benefit')
  ) defaults(system_key)
  on conflict (year_id, system_key) where system_key is not null do nothing;

  insert into public.household_entity_revisions (
    household_id,
    entity_type,
    entity_id,
    revision,
    deleted,
    last_operation_id,
    winner_type,
    winner_entity_type,
    winner_entity_id,
    applied_at
  )
  select
    category.household_id,
    'ledger_category',
    category.id,
    category.revision,
    false,
    gen_random_uuid(),
    'ledger.category.upsert',
    'ledger_category',
    category.id,
    category.created_at
  from public.ledger_categories category
  where category.year_id = target_year_id
    and category.system_key = any(array[
      'salary', 'bonus', 'rrsp', 'tfsa', 'espp', 'government_benefit'
    ])
  on conflict on constraint household_entity_revisions_pkey do nothing;

  insert into public.ledger_month_categories (
    household_id,
    month_id,
    category_id,
    name,
    sort_order,
    revision
  )
  select
    target_household_id,
    month_row.id,
    category.id,
    defaults.display_name,
    defaults.sort_order,
    1
  from public.ledger_months month_row
  join public.ledger_categories category
    on category.year_id = month_row.year_id
  join (
    values
      ('salary', 'Salary', 0),
      ('bonus', 'Bonus', 1),
      ('rrsp', 'RRSP', 2),
      ('tfsa', 'TFSA', 3),
      ('espp', 'ESPP', 4),
      ('government_benefit', 'Government benefit', 5)
  ) defaults(system_key, display_name, sort_order)
    on defaults.system_key = category.system_key
  where month_row.year_id = target_year_id
  on conflict (month_id, category_id) do nothing;
end;
$$;

create or replace function public.mobile_ensure_year_income_categories_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.mobile_ensure_default_income_categories(
    coalesce(
      (to_jsonb(new)->>'year_id')::uuid,
      (to_jsonb(new)->>'id')::uuid
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_mobile_ledger_year_income_categories
  on public.ledger_years;
create trigger trg_mobile_ledger_year_income_categories
after insert on public.ledger_years
for each row execute function public.mobile_ensure_year_income_categories_trigger();

drop trigger if exists trg_mobile_ledger_month_income_categories
  on public.ledger_months;
create trigger trg_mobile_ledger_month_income_categories
after insert on public.ledger_months
for each row execute function public.mobile_ensure_year_income_categories_trigger();

do $$
declare
  year_row record;
begin
  for year_row in select id from public.ledger_years loop
    perform public.mobile_ensure_default_income_categories(year_row.id);
  end loop;
end;
$$;

revoke all on function public.mobile_ensure_default_income_categories(uuid)
  from public;
revoke all on function public.mobile_ensure_year_income_categories_trigger()
  from public;
