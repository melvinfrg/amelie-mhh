-- Anatomy figures: an uploaded image with masks over its structures.
-- Each mask becomes its own question (type 'occlusion') so it is scheduled on its own.

create table figures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  topic_id uuid not null references topics on delete cascade,
  title text not null,
  image text not null,
  masks jsonb not null default '[]',
  hide_all boolean not null default true
);

create index on figures (user_id);

alter table figures enable row level security;
create policy "own rows" on figures for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table questions drop constraint questions_type_check;
alter table questions add constraint questions_type_check check (type in ('mc', 'explain', 'occlusion'));
alter table questions add column figure_id uuid references figures on delete cascade;
alter table questions add column mask_id text;
alter table questions add column level smallint;

-- Images live in a private bucket, one folder per user: <user id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('figures', 'figures', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "own figure images" on storage.objects for all to authenticated
  using (bucket_id = 'figures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'figures' and (storage.foldername(name))[1] = (select auth.uid())::text);
