-- Die Batzi's: the shared household app (ToDos, Einkauf, Kalender, Reisen, Tagebuch …) moves into this project,
-- so one login works for everything. All tables carry the prefix batzi_ to stay apart from the Studium tables.
-- Unlike the Studium tables, these rows are shared: everyone whose e-mail is in batzi_members sees and edits them.

-- ---------- Wer darf rein? ----------
create table batzi_members (
  email text primary key,
  added_at timestamptz not null default now()
);
alter table batzi_members enable row level security;

create function public.batzi_is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.batzi_members m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.batzi_is_member() from public, anon;
grant execute on function public.batzi_is_member() to authenticated;

create policy "members: lesen" on batzi_members
  for select to authenticated using ((select public.batzi_is_member()));

-- ---------- Tabellen ----------
create table batzi_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  emoji text not null default '🐻',
  color text not null default 'peach',
  created_at timestamptz not null default now()
);

create table batzi_todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  assignee text,                         -- user-id, 'both' oder null
  category text,
  recurrence text not null default 'none',
  subtasks jsonb not null default '[]'::jsonb,
  done boolean not null default false,
  done_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_shopping_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity text,
  category text,
  note text,
  store text,
  checked boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  end_date date,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  location text,
  notes text,
  who text,
  color text not null default 'peach',
  recurrence text not null default 'none',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_trackers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '⏳',
  start_date date not null,
  description text,
  color text not null default 'peach',
  pinned boolean not null default true,
  history jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  destination text,
  country text,
  start_date date,
  end_date date,
  emoji text not null default '🧳',
  cover_url text,
  notes text,
  rating smallint check (rating between 1 and 5),
  budget numeric(10, 2),
  links jsonb not null default '[]'::jsonb,
  packing jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_diary_entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  message text not null check (char_length(message) between 1 and 2000),
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entry_date)
);

create table batzi_diary_feelings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  score smallint not null check (score between 1 and 5),
  note text check (char_length(note) <= 1000),
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, entry_date)
);

create table batzi_app_settings (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table batzi_recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '🍽️',
  minutes integer,
  servings integer default 2,
  tags jsonb not null default '[]'::jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  steps text,
  url text,
  image_url text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_orga_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Verträge',
  title text not null,
  provider text,
  amount numeric(10, 2),
  interval text not null default 'monthly',
  payer text,
  contract_no text,
  start_date date,
  end_date date,
  cancel_by date,
  notice text,
  contact text,
  url text,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table batzi_photos (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  caption text,
  on_dashboard boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index on batzi_todos (due_date) where not done;
create index on batzi_todos (created_by);
create index on batzi_shopping_items (created_by);
create index on batzi_events (event_date);
create index on batzi_events (created_by);
create index on batzi_trackers (created_by);
create index on batzi_trips (created_by);
create index on batzi_diary_entries (entry_date desc);
create index on batzi_recipes (created_by);
create index on batzi_orga_items (created_by);
create index on batzi_photos (created_by);

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['batzi_profiles', 'batzi_todos', 'batzi_shopping_items', 'batzi_events', 'batzi_trackers',
    'batzi_trips', 'batzi_diary_entries', 'batzi_diary_feelings', 'batzi_app_settings', 'batzi_recipes',
    'batzi_orga_items', 'batzi_photos'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  -- Gemeinsame Tabellen: alle Mitglieder dürfen alles
  foreach t in array array['batzi_todos', 'batzi_shopping_items', 'batzi_events', 'batzi_trackers', 'batzi_trips',
    'batzi_app_settings', 'batzi_recipes', 'batzi_orga_items', 'batzi_photos'] loop
    execute format(
      'create policy "mitglieder" on %I for all to authenticated
         using ((select public.batzi_is_member())) with check ((select public.batzi_is_member()))', t);
  end loop;
end $$;

-- Profile: alle lesen, jeder nur sein eigenes schreiben
create policy "profiles: lesen" on batzi_profiles
  for select to authenticated using ((select public.batzi_is_member()));
create policy "profiles: eigenes anlegen" on batzi_profiles
  for insert to authenticated with check ((select public.batzi_is_member()) and id = (select auth.uid()));
create policy "profiles: eigenes ändern" on batzi_profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tagebuch: beide lesen, jeder nur eigene Nachrichten schreiben
create policy "diary: lesen" on batzi_diary_entries
  for select to authenticated using ((select public.batzi_is_member()));
create policy "diary: eigene anlegen" on batzi_diary_entries
  for insert to authenticated with check ((select public.batzi_is_member()) and author_id = (select auth.uid()));
create policy "diary: eigene ändern" on batzi_diary_entries
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "diary: eigene löschen" on batzi_diary_entries
  for delete to authenticated using (author_id = (select auth.uid()));

-- Gefühle: eigene immer sichtbar, fremde nur wenn nicht privat
create policy "feelings: lesen" on batzi_diary_feelings
  for select to authenticated
  using ((select public.batzi_is_member()) and (author_id = (select auth.uid()) or not is_private));
create policy "feelings: eigene anlegen" on batzi_diary_feelings
  for insert to authenticated with check ((select public.batzi_is_member()) and author_id = (select auth.uid()));
create policy "feelings: eigene ändern" on batzi_diary_feelings
  for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "feelings: eigene löschen" on batzi_diary_feelings
  for delete to authenticated using (author_id = (select auth.uid()));

-- ---------- Fotos (privat, nur Mitglieder) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('batzi-photos', 'batzi-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "batzi photos: lesen" on storage.objects
  for select to authenticated using (bucket_id = 'batzi-photos' and (select public.batzi_is_member()));
create policy "batzi photos: hochladen" on storage.objects
  for insert to authenticated with check (bucket_id = 'batzi-photos' and (select public.batzi_is_member()));
create policy "batzi photos: löschen" on storage.objects
  for delete to authenticated using (bucket_id = 'batzi-photos' and (select public.batzi_is_member()));

-- ---------- Live-Updates ----------
do $$
declare t text;
begin
  foreach t in array array['batzi_profiles', 'batzi_todos', 'batzi_shopping_items', 'batzi_events', 'batzi_trackers',
    'batzi_trips', 'batzi_diary_entries', 'batzi_diary_feelings', 'batzi_app_settings', 'batzi_recipes',
    'batzi_orga_items', 'batzi_photos'] loop
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;

-- ---------- Umzug aus dem alten Batzis-Projekt ----------
-- The move page (public/batzis/umzug.html) reads the old project in the browser and needs the new account ids
-- for the old e-mail addresses, so it can rewrite who wrote what.
create function public.batzi_user_ids(emails text[])
returns table (email text, id uuid)
language sql stable security definer
set search_path = ''
as $$
  select u.email::text, u.id from auth.users u
  where public.batzi_is_member() and lower(u.email) in (select lower(e) from unnest(emails) e);
$$;
revoke all on function public.batzi_user_ids(text[]) from public, anon;
grant execute on function public.batzi_user_ids(text[]) to authenticated;

-- Inserts the old rows (ids already rewritten) in one go. It bypasses the per-author diary policies,
-- which is why only members may call it; rows that already exist are skipped, so it can run twice.
create function public.batzi_import(payload jsonb)
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
  insert into public.batzi_members select * from jsonb_populate_recordset(null::public.batzi_members, payload -> 'members')
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
revoke all on function public.batzi_import(jsonb) from public, anon;
grant execute on function public.batzi_import(jsonb) to authenticated;

-- Freischalten (the move page brings the old members along):
-- insert into batzi_members (email) values ('name@example.de');
