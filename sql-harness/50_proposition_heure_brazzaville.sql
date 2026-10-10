-- PROPOSITION (testée) : heure officielle de Brazzaville (Africa/Brazzaville, WAT, UTC+1) côté serveur.
create or replace function public.brazzaville_now()
returns timestamp language sql stable as $$ select (now() at time zone 'Africa/Brazzaville') $$;

create or replace function public.brazzaville_today()
returns date language sql stable as $$ select (now() at time zone 'Africa/Brazzaville')::date $$;

create or replace function public.server_time()
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'utc',         to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'brazzaville', to_char(now() at time zone 'Africa/Brazzaville', 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"'),
    'date',        (now() at time zone 'Africa/Brazzaville')::date,
    'year',        extract(year from now() at time zone 'Africa/Brazzaville')::int,
    'timezone',    'Africa/Brazzaville',
    'abbr',        'WAT');
$$;
grant execute on function public.brazzaville_now(), public.brazzaville_today(), public.server_time() to authenticated;

-- Les dates « jour » deviennent celles de Brazzaville, plus celles d'UTC.
alter table public.invoices alter column date set default public.brazzaville_today();
alter table public.payments alter column date set default public.brazzaville_today();
