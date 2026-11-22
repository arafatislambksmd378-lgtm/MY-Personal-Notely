-- Notely cloud sync schema (Supabase / Postgres).
--
-- Run this once in your project's SQL editor. It creates one table that stores
-- document snapshots plus tombstones, and an RLS policy that only accepts
-- requests carrying the sync token you set in the app.
--
-- IMPORTANT: change  replace-with-a-long-random-token  below to the same value
-- you type into Notely → Settings → Cloud sync → Sync token. The token travels
-- in the `x-sync-token` header and is embedded in the app, so treat it as a
-- password for this workspace: rotate it if it leaks.

create table if not exists public.notely_documents (
  space_id      text not null,
  doc_id        text not null,
  notebook_id   text not null,
  notebook_name text,
  title         text not null default '',
  content_html  text not null default '',
  page_setup    text,
  card_color    text,
  is_favorite   boolean not null default false,
  is_pinned     boolean not null default false,
  is_archived   boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null,
  updated_at    timestamptz not null,
  device_id     text,
  synced_at     timestamptz not null default now(),
  primary key (space_id, doc_id)
);

create index if not exists notely_documents_space_updated
  on public.notely_documents (space_id, updated_at);

alter table public.notely_documents enable row level security;

-- Replace the literal below with your token, or store it in a secrets table.
create or replace function public.notely_authorized()
returns boolean
language sql
stable
as $$
  select coalesce(
    current_setting('request.headers', true)::json ->> 'x-sync-token',
    ''
  ) = 'replace-with-a-long-random-token'
$$;

drop policy if exists notely_token_access on public.notely_documents;

create policy notely_token_access
  on public.notely_documents
  for all
  using (public.notely_authorized())
  with check (public.notely_authorized());

-- Optional: keep only the newest 30 days of tombstones.
-- delete from public.notely_documents
--   where deleted_at is not null and deleted_at < now() - interval '30 days';
