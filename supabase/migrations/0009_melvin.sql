-- Melvins Bereich (/melvin): Termine, ToDos, Finanzen und Verträge.
-- Like the Studium tables every row belongs to one account; row-level security keeps it private.

create table melvin_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  category text not null default 'privat' check (category in ('privat', 'arbeit', 'sport', 'familie', 'sonstiges')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  notes text,
  done boolean not null default false
);

create table melvin_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  category text,
  notes text,
  done boolean not null default false
);

-- Income and spending. Fixed entries repeat every interval from `date` on (until end_date);
-- variable ones happen once on `date`.
create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  kind text not null check (kind in ('einnahme', 'ausgabe')),
  amount numeric(10, 2) not null check (amount >= 0),
  fixed boolean not null default false,
  interval text check (interval in ('monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich')),
  date date not null default current_date,
  end_date date,
  category text not null default 'Sonstiges',
  note text
);

-- Insurances, subscriptions and other contracts, with links to share.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  kind text not null default 'vertrag' check (kind in ('versicherung', 'abo', 'vertrag', 'sonstiges')),
  provider text,
  amount numeric(10, 2) check (amount >= 0),
  interval text check (interval in ('monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich', 'einmalig')),
  contract_no text,
  start_date date,
  end_date date,
  cancel_by date,
  notice text,
  url text,
  links jsonb not null default '[]',
  notes text,
  -- Count the costs as fixed costs in Finanzen.
  in_finances boolean not null default true
);

create index on melvin_events (user_id, starts_at);
create index on melvin_todos (user_id);
create index on finance_entries (user_id, date);
create index on contracts (user_id);

do $$
declare t text;
begin
  foreach t in array array['melvin_events', 'melvin_todos', 'finance_entries', 'contracts'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;
