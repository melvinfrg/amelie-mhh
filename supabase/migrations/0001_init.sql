-- Studium MHH: initial schema.
-- Every table belongs to one user; row-level security makes sure nobody sees another user's data.

create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  color text not null default '#64748b'
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  subject_id uuid not null references subjects on delete cascade,
  parent_id uuid references topics on delete cascade,
  name text not null,
  sort integer not null default 0
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  topic_id uuid not null references topics on delete cascade,
  type text not null check (type in ('mc', 'explain')),
  prompt text not null,
  options jsonb not null default '[]',
  answer text,
  explanation text,
  image_url text,
  video_url text,
  source text,
  suspended boolean not null default false,
  card jsonb,
  due timestamptz
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  question_id uuid not null references questions on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  correct boolean not null,
  reviewed_at timestamptz not null default now(),
  duration_ms integer not null default 0
);

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  kind text not null check (kind in ('pruefung', 'testat', 'frist', 'veranstaltung', 'sonstiges')),
  starts_at timestamptz not null,
  location text,
  subject_id uuid references subjects on delete set null,
  notes text,
  progress smallint not null default 0 check (progress between 0 and 100),
  done boolean not null default false
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  subject_id uuid references subjects on delete set null,
  notes text,
  done boolean not null default false
);

create table links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  url text not null,
  category text not null default 'Allgemein',
  description text
);

create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  daily_new_limit integer not null default 20,
  desired_retention real not null default 0.9,
  gating_enabled boolean not null default true,
  unlock_threshold real not null default 0.7
);

create index on topics (user_id);
create index on questions (user_id, due);
create index on reviews (user_id, reviewed_at);
create index on events (user_id, starts_at);
create index on todos (user_id);
create index on links (user_id);

do $$
declare t text;
begin
  foreach t in array array['subjects', 'topics', 'questions', 'reviews', 'events', 'todos', 'links', 'settings'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
