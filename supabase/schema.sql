-- FontLine schema — PUBLIC-FIRST, NO RLS BY DESIGN.
-- PRD §7: any anon visitor can create/read/update fonts. Collision is prevented by
-- per-session UUID in localStorage, not by authorisation. Do not enable RLS without
-- revisiting the product decision.
--
-- All tables live in a dedicated `fontline` schema (PRD §7.1).
-- After running this file, you ALSO need to expose the schema to PostgREST:
--   Supabase Dashboard → Project Settings → API → "Exposed schemas" → add `fontline`.
-- Without that, PostgREST returns "schema must be one of the following: public, ..."

create extension if not exists "pgcrypto";

create schema if not exists fontline;

create table if not exists fontline.fonts (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'FontLine',
  units_per_em int not null default 1000,
  ascender int not null default 800,
  descender int not null default -200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table fontline.fonts is 'PUBLIC-FIRST: RLS disabled by design. See PRD §7.';

create table if not exists fontline.glyph_configs (
  font_id uuid not null references fontline.fonts(id) on delete cascade,
  char_code int not null,
  vertical_offset int not null default 0,
  scale real not null default 1.0,
  svg_path text not null,
  updated_at timestamptz not null default now(),
  primary key (font_id, char_code)
);
comment on table fontline.glyph_configs is 'PUBLIC-FIRST: RLS disabled by design. Composite PK enables upsert on (font_id,char_code).';

-- RLS off, anon has full CRUD. This is intentional.
alter table fontline.fonts disable row level security;
alter table fontline.glyph_configs disable row level security;

grant usage on schema fontline to anon, authenticated, service_role;
grant all on fontline.fonts to anon, authenticated, service_role;
grant all on fontline.glyph_configs to anon, authenticated, service_role;

-- Future tables in this schema inherit anon grants.
alter default privileges in schema fontline
  grant all on tables to anon, authenticated, service_role;

-- Public bucket for .ttf artifacts.
-- Storage bucket creation can't run as plain SQL in all Supabase environments; use the
-- dashboard or the management API:
--
--   1. Create bucket 'font-assets' with Public = true.
--   2. Allow anon upload/update/delete via the bucket's policies UI (or disable policies
--      entirely for this bucket).
--
-- For self-hosted, the equivalent SQL is:
-- insert into storage.buckets (id, name, public) values ('font-assets','font-assets', true)
--   on conflict (id) do update set public = true;
