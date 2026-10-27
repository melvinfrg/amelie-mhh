-- Fix for the move page: it sends members as { email } only, and jsonb_populate_recordset turned the
-- missing added_at into null instead of using the column default. Insert just the e-mail instead.

create or replace function public.batzi_import(payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  t text;
  n integer;
  result jsonb := '{}';
begin
  if not public.batzi_is_member() then
    raise exception 'Kein Zugriff';
  end if;
  insert into public.batzi_members (email)
    select lower(m ->> 'email') from jsonb_array_elements(coalesce(payload -> 'members', '[]')) m
    where coalesce(m ->> 'email', '') <> ''
    on conflict do nothing;
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
