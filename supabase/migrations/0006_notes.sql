-- Notizen für Melvins Bereich (/melvin). Wie die Studium-Tabellen gehört jede Notiz einem Konto.

create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null default '',
  body text not null default '',
  pinned boolean not null default false
);

create index on notes (user_id);

alter table notes enable row level security;
create policy "own rows" on notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
