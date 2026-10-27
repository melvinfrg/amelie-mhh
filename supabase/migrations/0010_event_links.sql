-- Termine zwischen den Bereichen übertragen und verbunden halten.
-- A date from Melvin's calendar (melvin_events), Amelie's Studium (events) or the Batzi's (batzi_events) can be
-- copied into another of these calendars, also into the other person's. Copies that stay connected are listed in
-- event_links; when one of them changes, triggers carry title, time, place and notes over to the others.
-- Deleting one only removes it and its links, the other copies stay.
-- Only members of the Batzi's (batzi_members) can send dates to each other.

create table event_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users on delete set null,
  -- 'studium' = events, 'melvin' = melvin_events, 'batzis' = batzi_events
  a_kind text not null check (a_kind in ('studium', 'melvin', 'batzis')),
  a_id uuid not null,
  a_user uuid references auth.users on delete cascade,
  b_kind text not null check (b_kind in ('studium', 'melvin', 'batzis')),
  b_id uuid not null,
  b_user uuid references auth.users on delete cascade
);
create index on event_links (a_kind, a_id);
create index on event_links (b_kind, b_id);

-- Members see the links so both sides can show the 🔗; only the functions below write them.
alter table event_links enable row level security;
create policy "mitglieder lesen" on event_links for select to authenticated using ((select public.batzi_is_member()));

-- ---------- Umrechnen zwischen den drei Tabellen ----------
-- The common shape is {title, starts_at, ends_at, all_day, location, notes}. The Batzi's store a date plus times
-- (in German time), the others timestamps.

create function public.event_core(ev_kind text, event_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  r jsonb;
begin
  if ev_kind = 'studium' then
    select jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'all_day', e.all_day,
      'location', e.location, 'notes', e.notes, 'user_id', e.user_id)
    into r from public.events e where e.id = event_id;
  elsif ev_kind = 'melvin' then
    select jsonb_build_object('title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'all_day', e.all_day,
      'location', e.location, 'notes', e.notes, 'user_id', e.user_id)
    into r from public.melvin_events e where e.id = event_id;
  elsif ev_kind = 'batzis' then
    select jsonb_build_object(
      'title', e.title,
      'all_day', e.all_day or e.start_time is null,
      'starts_at', ((e.event_date + coalesce(case when e.all_day then null else e.start_time end, '00:00'::time)) at time zone 'Europe/Berlin'),
      'ends_at', case
        when e.all_day or e.start_time is null then
          case when e.end_date > e.event_date then (e.end_date::timestamp at time zone 'Europe/Berlin') end
        when e.end_time is not null then ((coalesce(e.end_date, e.event_date) + e.end_time) at time zone 'Europe/Berlin')
        when e.end_date > e.event_date then ((e.end_date + e.start_time) at time zone 'Europe/Berlin')
      end,
      'location', e.location, 'notes', e.notes, 'user_id', null)
    into r from public.batzi_events e where e.id = event_id;
  end if;
  return r;
end;
$$;

-- The Batzi's columns for a common-shape date.
create function public.event_batzi_fields(core jsonb)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'event_date', ((core ->> 'starts_at')::timestamptz at time zone 'Europe/Berlin')::date,
    'end_date', case
      when core ->> 'ends_at' is not null
        and ((core ->> 'ends_at')::timestamptz at time zone 'Europe/Berlin')::date > ((core ->> 'starts_at')::timestamptz at time zone 'Europe/Berlin')::date
      then ((core ->> 'ends_at')::timestamptz at time zone 'Europe/Berlin')::date end,
    'start_time', case when not (core ->> 'all_day')::boolean then ((core ->> 'starts_at')::timestamptz at time zone 'Europe/Berlin')::time end,
    'end_time', case when not (core ->> 'all_day')::boolean and core ->> 'ends_at' is not null
      then ((core ->> 'ends_at')::timestamptz at time zone 'Europe/Berlin')::time end
  );
$$;

-- Writes title, time, place and notes onto an existing row; its own fields (kind, colour, progress …) stay.
create function public.event_apply(ev_kind text, event_id uuid, core jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  b jsonb;
begin
  if ev_kind = 'studium' then
    update public.events set title = core ->> 'title', starts_at = (core ->> 'starts_at')::timestamptz,
      ends_at = (core ->> 'ends_at')::timestamptz, all_day = (core ->> 'all_day')::boolean,
      location = core ->> 'location', notes = core ->> 'notes'
    where id = event_id;
  elsif ev_kind = 'melvin' then
    update public.melvin_events set title = core ->> 'title', starts_at = (core ->> 'starts_at')::timestamptz,
      ends_at = (core ->> 'ends_at')::timestamptz, all_day = (core ->> 'all_day')::boolean,
      location = core ->> 'location', notes = core ->> 'notes'
    where id = event_id;
  elsif ev_kind = 'batzis' then
    b := public.event_batzi_fields(core);
    update public.batzi_events set title = core ->> 'title', all_day = (core ->> 'all_day')::boolean,
      event_date = (b ->> 'event_date')::date, end_date = (b ->> 'end_date')::date,
      start_time = (b ->> 'start_time')::time, end_time = (b ->> 'end_time')::time,
      location = core ->> 'location', notes = core ->> 'notes'
    where id = event_id;
  end if;
end;
$$;

-- Inserts a copy for `owner` (ignored for the Batzi's, which are shared) and returns its id.
create function public.event_insert(ev_kind text, owner uuid, core jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
  b jsonb;
begin
  if ev_kind = 'studium' then
    insert into public.events (user_id, title, kind, starts_at, ends_at, all_day, location, notes)
    values (owner, core ->> 'title', 'sonstiges', (core ->> 'starts_at')::timestamptz, (core ->> 'ends_at')::timestamptz,
      (core ->> 'all_day')::boolean, core ->> 'location', core ->> 'notes')
    returning id into new_id;
  elsif ev_kind = 'melvin' then
    insert into public.melvin_events (user_id, title, starts_at, ends_at, all_day, location, notes)
    values (owner, core ->> 'title', (core ->> 'starts_at')::timestamptz, (core ->> 'ends_at')::timestamptz,
      (core ->> 'all_day')::boolean, core ->> 'location', core ->> 'notes')
    returning id into new_id;
  elsif ev_kind = 'batzis' then
    b := public.event_batzi_fields(core);
    insert into public.batzi_events (title, event_date, end_date, all_day, start_time, end_time, location, notes, who, color)
    values (core ->> 'title', (b ->> 'event_date')::date, (b ->> 'end_date')::date, (core ->> 'all_day')::boolean,
      (b ->> 'start_time')::time, (b ->> 'end_time')::time, core ->> 'location', core ->> 'notes',
      coalesce(core ->> 'user_id', 'both'), 'sky')
    returning id into new_id;
  end if;
  return new_id;
end;
$$;

revoke all on function public.event_core(text, uuid) from public, anon, authenticated;
revoke all on function public.event_apply(text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.event_insert(text, uuid, jsonb) from public, anon, authenticated;

-- ---------- Wohin kann ich schicken? ----------
-- Every member with an account, and which calendar is theirs: Melvin's area for whoever uses it (or has no
-- Studium dates), otherwise the Studium.
create function public.share_targets()
returns table (user_id uuid, name text, emoji text, area text)
language sql stable security definer
set search_path = ''
as $$
  select u.id, coalesce(p.display_name, split_part(u.email::text, '@', 1)), coalesce(p.emoji, '🙂'),
    case when exists (select 1 from public.melvin_events m where m.user_id = u.id)
           or not exists (select 1 from public.events e where e.user_id = u.id)
      then 'melvin' else 'studium' end
  from auth.users u
  join public.batzi_members bm on lower(bm.email) = lower(u.email)
  left join public.batzi_profiles p on p.id = u.id
  where public.batzi_is_member()
  order by 2;
$$;
revoke all on function public.share_targets() from public, anon;
grant execute on function public.share_targets() to authenticated;

-- ---------- Übertragen ----------
-- Copies a date into another calendar and returns the id of the copy. With keep_linked the two stay connected.
-- Sending the same date to the same calendar again updates the existing copy instead of making a second one.
create function public.share_event(src_kind text, src_id uuid, dest_kind text, dest_user uuid, keep_linked boolean default true)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  core jsonb;
  src_user uuid;
  existing uuid;
  new_id uuid;
begin
  if not public.batzi_is_member() then
    raise exception 'Nur für Mitglieder der Batzi''s';
  end if;
  if dest_kind not in ('studium', 'melvin', 'batzis') then
    raise exception 'Unbekannter Kalender';
  end if;
  core := public.event_core(src_kind, src_id);
  if core is null then
    raise exception 'Termin nicht gefunden';
  end if;
  src_user := (core ->> 'user_id')::uuid;
  -- Own dates only; the Batzi's belong to all members.
  if src_kind <> 'batzis' and src_user is distinct from auth.uid() then
    raise exception 'Kein Zugriff auf diesen Termin';
  end if;
  if dest_kind = 'batzis' then
    dest_user := null;
  elsif dest_user is null or not exists (
    select 1 from auth.users u join public.batzi_members bm on lower(bm.email) = lower(u.email) where u.id = dest_user
  ) then
    raise exception 'Empfänger ist kein Mitglied der Batzi''s';
  end if;
  if src_kind = dest_kind and src_user is not distinct from dest_user then
    raise exception 'Der Termin ist schon in diesem Kalender';
  end if;

  select case when l.a_kind = src_kind and l.a_id = src_id then l.b_id else l.a_id end into existing
  from public.event_links l
  where (l.a_kind = src_kind and l.a_id = src_id and l.b_kind = dest_kind and l.b_user is not distinct from dest_user)
     or (l.b_kind = src_kind and l.b_id = src_id and l.a_kind = dest_kind and l.a_user is not distinct from dest_user)
  limit 1;
  if existing is not null then
    perform public.event_apply(dest_kind, existing, core);
    return existing;
  end if;

  -- Who it is for, shown as "Wer?" in the Batzi's.
  core := core || jsonb_build_object('user_id', coalesce(src_user, auth.uid()));
  new_id := public.event_insert(dest_kind, dest_user, core);
  if keep_linked then
    insert into public.event_links (a_kind, a_id, a_user, b_kind, b_id, b_user)
    values (src_kind, src_id, src_user, dest_kind, new_id, dest_user);
  end if;
  return new_id;
end;
$$;
revoke all on function public.share_event(text, uuid, text, uuid, boolean) from public, anon;
grant execute on function public.share_event(text, uuid, text, uuid, boolean) to authenticated;

-- Ends the connection of a date with all its copies; the copies stay as they are.
create function public.unlink_event(ev_kind text, event_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.batzi_is_member() then
    raise exception 'Nur für Mitglieder der Batzi''s';
  end if;
  if ev_kind <> 'batzis' and (public.event_core(ev_kind, event_id) ->> 'user_id')::uuid is distinct from auth.uid() then
    raise exception 'Kein Zugriff auf diesen Termin';
  end if;
  delete from public.event_links where (a_kind = ev_kind and a_id = event_id) or (b_kind = ev_kind and b_id = event_id);
end;
$$;
revoke all on function public.unlink_event(text, uuid) from public, anon;
grant execute on function public.unlink_event(text, uuid) to authenticated;

-- ---------- Verbunden halten ----------
-- After a change, every date connected to it (also over several hops) gets the new title, time, place and notes.
-- The updates it makes fire this trigger again one level deeper, which returns at once.
create function public.event_links_sync()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  my_kind text := case tg_table_name when 'events' then 'studium' when 'melvin_events' then 'melvin' else 'batzis' end;
  core jsonb;
  n record;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'DELETE' then
    delete from public.event_links where (a_kind = my_kind and a_id = old.id) or (b_kind = my_kind and b_id = old.id);
    return null;
  end if;
  core := public.event_core(my_kind, new.id);
  for n in
    with recursive linked(k, id) as (
      select my_kind, new.id
      union
      select case when l.a_kind = linked.k and l.a_id = linked.id then l.b_kind else l.a_kind end,
             case when l.a_kind = linked.k and l.a_id = linked.id then l.b_id else l.a_id end
      from public.event_links l
      join linked on (l.a_kind = linked.k and l.a_id = linked.id) or (l.b_kind = linked.k and l.b_id = linked.id)
    )
    select k, id from linked where not (k = my_kind and id = new.id)
  loop
    perform public.event_apply(n.k, n.id, core);
  end loop;
  return null;
end;
$$;

create trigger event_links_sync after update of title, starts_at, ends_at, all_day, location, notes or delete on events
  for each row execute function public.event_links_sync();
create trigger event_links_sync after update of title, starts_at, ends_at, all_day, location, notes or delete on melvin_events
  for each row execute function public.event_links_sync();
create trigger event_links_sync after update of title, event_date, end_date, all_day, start_time, end_time, location, notes or delete
  on batzi_events for each row execute function public.event_links_sync();

-- Live updates, so the 🔗 shows up in the Batzi's right away.
alter publication supabase_realtime add table event_links;
