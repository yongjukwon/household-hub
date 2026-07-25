#!/usr/bin/env bash
set -euo pipefail

task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$task_root"

supabase db reset \
  --local \
  --version 20260724221505 \
  --no-seed

supabase db query --local "
  do \$calendar_upgrade\$
  begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-4000-8000-000000000201',
    'authenticated',
    'authenticated',
    'calendar-upgrade@example.test',
    '',
    now(),
    now(),
    now()
  );

  insert into public.households (id, name)
  values (
    '10000000-0000-4000-8000-000000000201',
    'Calendar upgrade household'
  );

  insert into public.household_members (
    id,
    household_id,
    user_id,
    display_name
  )
  values (
    '11000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000201',
    'Calendar upgrade member'
  );

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000201',
    false
  );

  insert into public.calendar_events (
    id,
    household_id,
    created_by,
    title,
    note,
    all_day,
    start_at,
    end_at,
    recurrence_freq
  )
  values (
    '31000000-0000-4000-8000-000000000201',
    '10000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000201',
    'Calendar before mobile',
    null,
    false,
    '2026-08-02T17:00:00.000Z',
    '2026-08-02T18:00:00.000Z',
    'none'
  );
  end
  \$calendar_upgrade\$;
"

supabase migration up --local
supabase test db \
  supabase/tests/20260725_mobile_first_review_round_1.test.sql \
  --local
