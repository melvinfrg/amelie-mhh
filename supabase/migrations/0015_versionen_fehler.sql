-- Versionen, Update-Log und „Fehler melden“, wie auf der Gruppe-2.1-Seite.
-- Die Versionen selbst stehen im Code (src/data/changelog.json). Hier liegen nur:
--   * app_config: eigene Änderungen am Update-Log (Schlüssel „changelog_edits“), für alle Konten gleich;
--   * bug_reports: gemeldete Fehler der Webseite, für alle Konten sichtbar;
--   * die Push-Nachricht bei einer neuen Version: welche Version zuletzt gemeldet wurde, und pro Gerät, ob es sie haben will.
-- Neue Konten lassen sich nicht selbst anlegen (README, Schritt 3), deshalb heißt „angemeldet“ hier: Amelie oder Melvin.

create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users on delete set null
);

alter table app_config enable row level security;
create policy "members read" on app_config for select to authenticated using (true);
create policy "members write" on app_config for insert to authenticated with check (key = 'changelog_edits');
create policy "members update" on app_config for update to authenticated using (key = 'changelog_edits') with check (key = 'changelog_edits');

create table bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  area text not null,
  kind text not null,
  text text not null,
  steps text,
  reporter text,
  device text,
  version text,
  done boolean not null default false
);

alter table bug_reports enable row level security;
create policy "members read" on bug_reports for select to authenticated using (true);
create policy "own insert" on bug_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy "members update" on bug_reports for update to authenticated using (true) with check (true);
create policy "members delete" on bug_reports for delete to authenticated using (true);

-- Pro Gerät abschaltbar (Einstellungen → Benachrichtigungen → „Neue Versionen melden“).
alter table push_subscriptions add column notify_updates boolean not null default true;

-- Welche Version zuletzt per Push gemeldet wurde. Nur der Cron (mit CRON_SECRET) liest und schreibt das.
create table version_notice (
  id boolean primary key default true check (id),
  version text not null,
  sent_at timestamptz not null default now()
);
alter table version_notice enable row level security;
revoke all on version_notice from anon, authenticated;

-- Alle Geräte, die über `current_version` informiert werden wollen, solange diese Version noch nicht gemeldet wurde.
create function public.version_push_due(cron_token text, current_version text)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(cron_token);
  if exists (select 1 from public.version_notice where version = current_version) then
    return;
  end if;
  return query
    select p.endpoint, p.p256dh, p.auth from public.push_subscriptions p where p.notify_updates;
end;
$$;

create function public.mark_version_notified(cron_token text, current_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(cron_token);
  insert into public.version_notice (id, version, sent_at) values (true, current_version, now())
    on conflict (id) do update set version = excluded.version, sent_at = excluded.sent_at;
end;
$$;

revoke all on function public.version_push_due(text, text) from public;
revoke all on function public.mark_version_notified(text, text) from public;
grant execute on function public.version_push_due(text, text) to anon;
grant execute on function public.mark_version_notified(text, text) to anon;
