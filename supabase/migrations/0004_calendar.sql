-- All-day and multi-day events, where an event came from (to avoid duplicate suggestions),
-- and secret subscription links so calendar apps can follow the dates.

alter table events add column ends_at timestamptz;
alter table events add column all_day boolean not null default false;
alter table events add column source text;

create table calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  token uuid not null unique default gen_random_uuid(),
  name text not null,
  filter jsonb not null default '{}'
);

create index on calendar_feeds (user_id);

alter table calendar_feeds enable row level security;
create policy "own rows" on calendar_feeds for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Calendar apps can't log in, so the feed is read through its secret token only.
create function public.calendar_feed(feed_token uuid)
returns table (
  feed_name text,
  feed_filter jsonb,
  id uuid,
  title text,
  kind text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  location text,
  notes text,
  subject_id uuid,
  subject_name text,
  done boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, f.filter, e.id, e.title, e.kind, e.starts_at, e.ends_at, e.all_day, e.location, e.notes,
         e.subject_id, s.name, e.done
  from public.calendar_feeds f
  join public.events e on e.user_id = f.user_id
  left join public.subjects s on s.id = e.subject_id
  where f.token = feed_token;
$$;

revoke all on function public.calendar_feed(uuid) from public;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
