-- Termine im Studium: mehrere Fächer pro Termin und Anpinnen auf der Startseite.

-- Alle Fächer eines Termins. subject_id bleibt als erstes Fach erhalten, damit ältere Stellen weiter funktionieren.
alter table events add column subject_ids uuid[] not null default '{}';
update events set subject_ids = array[subject_id] where subject_id is not null;

-- Angepinnte Termine stehen auf der Startseite, egal wie weit sie entfernt sind.
alter table events add column pinned boolean not null default false;

-- Das Kalender-Abo liefert jetzt alle Fächer eines Termins mit (Namen durch Komma getrennt).
drop function public.calendar_feed(uuid);
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
  subject_ids uuid[],
  subject_name text,
  done boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.name, f.filter, e.id, e.title, e.kind, e.starts_at, e.ends_at, e.all_day, e.location, e.notes,
         e.subject_id, e.subject_ids,
         (select string_agg(s.name, ', ' order by s.name) from public.subjects s where s.id = any(e.subject_ids)),
         e.done
  from public.calendar_feeds f
  left join public.events e on e.user_id = f.user_id
  where f.token = feed_token;
$$;

revoke all on function public.calendar_feed(uuid) from public;
grant execute on function public.calendar_feed(uuid) to anon, authenticated;
