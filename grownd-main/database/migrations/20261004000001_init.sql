-- GROWND schema: missions, dated sessions, registrations and site settings.
-- Runs on Supabase Postgres (or any Postgres 15+). Apply with `npm run db:migrate` from backend/,
-- or paste into the Supabase SQL editor.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- missions: reference data. Copy (steps, kit lists) lives in the site;
-- the dashboard owns price and dates.
-- ---------------------------------------------------------------------------

create table public.missions (
  slug        text primary key,
  title       text not null,
  type        text not null check (type in ('bio', 'chem', 'phys', 'eng')),
  unit        text not null check (unit in ('child', 'class')),
  price       numeric(10, 2) check (price >= 0 and price <= 100000),
  sort        smallint not null,
  updated_at  timestamptz not null default now()
);

create trigger missions_updated_at before update on public.missions
  for each row execute function public.set_updated_at();

insert into public.missions (slug, title, type, unit, sort) values
  ('slime-chemistry',         'Slime Chemistry',         'chem', 'child', 1),
  ('rocket-engineering',      'Rocket Engineering',      'eng',  'child', 2),
  ('crime-scene-biology',     'Crime Scene Biology',     'bio',  'class', 3),
  ('light-and-lasers',        'Light and Lasers',        'phys', 'child', 4),
  ('build-a-game-in-scratch', 'Build a Game in Scratch', 'eng',  'child', 5),
  ('glow-lab',                'Glow Lab',                'chem', 'child', 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- events: one dated session of a mission. A null date means "to be confirmed".
-- ---------------------------------------------------------------------------

create table public.events (
  id            bigint generated always as identity primary key,
  mission_slug  text not null references public.missions (slug) on delete cascade,
  date          date,
  time          time,
  timezone      text check (char_length(timezone) <= 40),
  venue         text check (char_length(venue) <= 120),
  city          text check (char_length(city) <= 80),
  places_left   integer not null check (places_left between 0 and 999),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index events_mission_date_idx on public.events (mission_slug, date);
create index events_date_idx on public.events (date);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- registrations: what the register form on the site sends.
-- ---------------------------------------------------------------------------

create type public.registration_status as enum ('new', 'contacted', 'confirmed', 'cancelled');

create table public.registrations (
  id              bigint generated always as identity primary key,
  mission_slug    text references public.missions (slug) on delete set null,
  name            text not null check (char_length(name) between 1 and 120),
  email           text not null check (char_length(email) between 3 and 200),
  phone           text not null default '' check (char_length(phone) <= 40),
  kids            smallint check (kids between 1 and 200),
  age_range       text not null default '' check (age_range in ('', '5-8', '7-11', '8-12', 'mixed')),
  preferred_date  date,
  city            text not null default '' check (char_length(city) <= 100),
  venue_type      text not null default '' check (char_length(venue_type) <= 40),
  notes           text not null default '' check (char_length(notes) <= 2000),
  consent_at      timestamptz not null default now(),
  status          public.registration_status not null default 'new',
  admin_notes     text not null default '' check (char_length(admin_notes) <= 5000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Dashboard list (newest first), status tabs and mission filter.
create index registrations_created_idx on public.registrations (created_at desc, id desc);
create index registrations_status_created_idx on public.registrations (status, created_at desc);
create index registrations_mission_created_idx on public.registrations (mission_slug, created_at desc);
-- Dashboard search (`ilike '%term%'`) stays fast at millions of rows.
create index registrations_search_idx on public.registrations
  using gin ((name || ' ' || email || ' ' || phone || ' ' || city || ' ' || notes) extensions.gin_trgm_ops);

create trigger registrations_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- settings: the few site-wide values the public site fills placeholders with.
-- ---------------------------------------------------------------------------

create table public.settings (
  key    text primary key check (key in ('currency', 'timezone', 'responseTime', 'insuranceNote')),
  value  text not null check (char_length(value) <= 400)
);

-- ---------------------------------------------------------------------------
-- Lock down Supabase's auto-generated REST API. Only the backend (which connects
-- as the table owner) reads or writes these tables; the browser never does.
-- ---------------------------------------------------------------------------

alter table public.missions      enable row level security;
alter table public.events        enable row level security;
alter table public.registrations enable row level security;
alter table public.settings      enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.missions, public.events, public.registrations, public.settings from anon, authenticated;
  end if;
end;
$$;
