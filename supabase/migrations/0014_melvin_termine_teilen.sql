-- Melvins Termine live bei Amelie: jeder Termin aus Melvins Kalender (melvin_events) kann für die anderen Mitglieder
-- der Batzi's sichtbar sein. Sie sehen ihn nur (nicht bearbeiten); jede Änderung kommt sofort bei ihnen an.
-- Pro Termin lässt sich das mit `shared` ein- und ausschalten. Neue und bestehende Termine sind geteilt.

alter table melvin_events add column shared boolean not null default true;

-- Lesen dürfen die anderen Mitglieder nur geteilte Termine; schreiben bleibt beim Besitzer ("own rows").
create policy "geteilt: mitglieder lesen" on melvin_events for select to authenticated
  using (shared and user_id <> (select auth.uid()) and (select public.batzi_is_member()));

-- Live-Updates für Melvins Termine und Amelies Studium-Termine (übertragene Kopien ändern sich dann sofort mit).
do $$
declare t text;
begin
  foreach t in array array['melvin_events', 'events'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
