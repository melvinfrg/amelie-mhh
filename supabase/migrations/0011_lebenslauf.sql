-- Lebenslauf in Melvins Bereich (/melvin/lebenslauf): persönliche Eckdaten und die Stationen (Schule, Ausbildung,
-- Jobs …), aus denen die Seite einen Zeitstrahl und Word-/PDF-Dateien macht. Every row belongs to one account.

create table cv_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null default '',
  headline text,
  birth_date date,
  birth_place text,
  email text,
  phone text,
  address text,
  website text,
  summary text,
  -- [{ "name": "Excel", "level": 4 }], level 1–5
  skills jsonb not null default '[]',
  -- [{ "name": "Englisch", "level": "fließend" }]
  languages jsonb not null default '[]',
  interests text
);

create table cv_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  section text not null default 'beruf'
    check (section in ('beruf', 'ausbildung', 'schule', 'praktikum', 'weiterbildung', 'ehrenamt', 'sonstiges')),
  title text not null,
  organization text,
  location text,
  start_date date not null,
  -- null = bis heute
  end_date date,
  description text,
  -- Leave out of the files without deleting.
  hidden boolean not null default false
);

create index on cv_entries (user_id, start_date);

do $$
declare t text;
begin
  foreach t in array array['cv_profile', 'cv_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
