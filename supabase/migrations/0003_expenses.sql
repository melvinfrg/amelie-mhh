-- Costs for the tax return, each with an optional receipt (photo or PDF) in a private bucket.

create table expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  date date not null,
  title text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  category text not null,
  note text,
  receipt text,
  receipt_name text
);

create index on expenses (user_id);

alter table expenses enable row level security;
create policy "own rows" on expenses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Receipts live in a private bucket, one folder per user: <user id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "own receipts" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
