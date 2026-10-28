-- Erinnerung 3 Monate vor jeder Prüfung: Amelies Geräte melden sich für Push-Benachrichtigungen an
-- (Einstellungen → Benachrichtigungen), und ein täglicher Vercel-Cron (/api/erinnerungen) schickt
-- jede Prüfung einmal, sobald sie drei Monate oder weniger entfernt ist.

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device text,
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;
create policy "own rows" on push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- When the reminder went out; null = still to send.
alter table events add column reminded_at timestamptz;

-- An exam moved further than three months away gets its reminder again at the right time.
create function public.events_reset_reminder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at and new.starts_at > now() + interval '3 months' then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

create trigger events_reset_reminder before update of starts_at on events
  for each row execute function public.events_reset_reminder();

-- The cron job has no login. It proves itself with CRON_SECRET (set in Vercel); only its SHA-256 is stored here,
-- so these functions hand out nothing without the secret.
create function public.check_cron_token(cron_token text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if encode(sha256(convert_to(coalesce(cron_token, ''), 'UTF8')), 'hex')
     <> 'f03c21c7ea033a23235d791e4a4a934ca3fde0159ab7fd32eb16fd11ad60f2c1' then
    raise exception 'not allowed';
  end if;
end;
$$;

-- Exams that are three months or less away and haven't been reminded of yet, once per registered device.
create function public.exam_reminders_due(cron_token text)
returns table (event_id uuid, title text, starts_at timestamptz, all_day boolean, location text, endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(cron_token);
  return query
    select e.id, e.title, e.starts_at, e.all_day, e.location, p.endpoint, p.p256dh, p.auth
    from public.events e
    join public.push_subscriptions p on p.user_id = e.user_id
    where e.kind = 'pruefung'
      and not e.done
      and e.reminded_at is null
      and e.starts_at > now()
      and e.starts_at <= now() + interval '3 months'
    order by e.starts_at;
end;
$$;

create function public.mark_exams_reminded(cron_token text, event_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(cron_token);
  update public.events set reminded_at = now() where id = any(event_ids);
end;
$$;

-- Devices that uninstalled the app or turned notifications off answer with 404/410; they are dropped.
create function public.forget_push_endpoints(cron_token text, endpoints text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(cron_token);
  delete from public.push_subscriptions where endpoint = any(endpoints);
end;
$$;

revoke all on function public.check_cron_token(text) from public;
revoke all on function public.exam_reminders_due(text) from public;
revoke all on function public.mark_exams_reminded(text, uuid[]) from public;
revoke all on function public.forget_push_endpoints(text, text[]) from public;
grant execute on function public.exam_reminders_due(text) to anon;
grant execute on function public.mark_exams_reminded(text, uuid[]) to anon;
grant execute on function public.forget_push_endpoints(text, text[]) to anon;
