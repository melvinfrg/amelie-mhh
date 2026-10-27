-- The move page can run before everyone has an account on the new site. Rows that belong to a person without
-- an account yet (their profile, diary entries and feelings) wait in batzi_pending under their old account id.
-- When that person opens the Batzi's for the first time, batzi_claim() moves the rows to their new account and
-- rewrites the old id in the shared tables ("Wer?", Packlisten, Ausgaben …).

create table batzi_pending (
  old_id uuid primary key,
  email text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
-- Only the security definer functions below touch it, so no policies.
alter table batzi_pending enable row level security;

-- Shared by batzi_import and batzi_claim; not callable from the API.
create function public.batzi_insert_rows(payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  t text;
  n integer;
  result jsonb := '{}';
begin
  foreach t in array array['profiles', 'todos', 'shopping_items', 'events', 'trackers', 'trips', 'diary_entries',
    'diary_feelings', 'app_settings', 'recipes', 'orga_items', 'photos'] loop
    execute format(
      'insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I, $1) on conflict do nothing',
      'batzi_' || t)
    using coalesce(payload -> t, '[]');
    get diagnostics n = row_count;
    result := result || jsonb_build_object(t, n);
  end loop;
  return result;
end;
$$;
revoke all on function public.batzi_insert_rows(jsonb) from public, anon, authenticated;

create or replace function public.batzi_import(payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.batzi_is_member() then
    raise exception 'Kein Zugriff';
  end if;
  insert into public.batzi_members (email)
    select lower(m ->> 'email') from jsonb_array_elements(coalesce(payload -> 'members', '[]')) m
    where coalesce(m ->> 'email', '') <> ''
    on conflict do nothing;
  insert into public.batzi_pending (old_id, email, payload)
    select (p ->> 'old_id')::uuid, lower(p ->> 'email'), p -> 'payload'
    from jsonb_array_elements(coalesce(payload -> 'pending', '[]')) p
    on conflict (old_id) do update set email = excluded.email, payload = excluded.payload;
  return public.batzi_insert_rows(payload);
end;
$$;

create function public.batzi_claim()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  r record;
  o text;
  n integer := 0;
begin
  if me is null or not public.batzi_is_member() then
    return 0;
  end if;
  for r in
    select * from public.batzi_pending where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  loop
    o := r.old_id::text;
    perform public.batzi_insert_rows(replace(r.payload::text, o, me::text)::jsonb);
    update public.batzi_todos set assignee = me::text where assignee = o;
    update public.batzi_events set who = me::text where who = o;
    update public.batzi_orga_items set payer = me::text where payer = o;
    update public.batzi_trips
      set links = replace(links::text, o, me::text)::jsonb,
          packing = replace(packing::text, o, me::text)::jsonb,
          expenses = replace(expenses::text, o, me::text)::jsonb,
          plan = replace(plan::text, o, me::text)::jsonb
      where (links::text || packing::text || expenses::text || plan::text) like '%' || o || '%';
    update public.batzi_todos set subtasks = replace(subtasks::text, o, me::text)::jsonb
      where subtasks::text like '%' || o || '%';
    update public.batzi_app_settings set value = replace(value::text, o, me::text)::jsonb
      where value::text like '%' || o || '%';
    delete from public.batzi_pending where old_id = r.old_id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.batzi_claim() from public, anon;
grant execute on function public.batzi_claim() to authenticated;
