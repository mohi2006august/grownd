-- Online payments: orders (date bookings and payment requests) and processed webhook events.

-- booking: someone booked places on a dated session and pays straight away.
-- request: the team asked for a payment (a quote for a party or school visit) and sent a link.
create type public.order_kind as enum ('booking', 'request');

-- pending     waiting for payment (a booking holds its places meanwhile)
-- processing  paid with a method that takes days to clear (e.g. bank debit); places stay held
-- paid        money received
-- failed      a delayed payment did not go through
-- expired     not paid in time (booking hold ran out, or the payment link lapsed)
-- cancelled   stopped by the customer or the team before payment
-- refunded    fully refunded
create type public.order_status as enum ('pending', 'processing', 'paid', 'failed', 'expired', 'cancelled', 'refunded');

create table public.orders (
  -- Also the customer's private link to their order, so it is random rather than sequential.
  id                   uuid primary key default gen_random_uuid(),
  kind                 public.order_kind not null,
  status               public.order_status not null default 'pending',

  event_id             bigint references public.events (id) on delete set null,
  mission_slug         text references public.missions (slug) on delete set null,
  registration_id      bigint references public.registrations (id) on delete set null,

  -- What was bought, written once. Later price or date edits never change a past order.
  description          text not null check (char_length(description) between 1 and 300),
  unit_amount          integer not null check (unit_amount > 0),          -- smallest currency unit (pence, cents)
  quantity             integer not null default 1 check (quantity between 1 and 200),
  amount               integer not null check (amount > 0),
  currency             text not null check (currency ~ '^[a-z]{3}$'),
  amount_refunded      integer not null default 0 check (amount_refunded >= 0 and amount_refunded <= amount),

  -- Who it is for.
  name                 text not null check (char_length(name) between 1 and 120),
  email                text not null check (char_length(email) between 3 and 200),
  phone                text not null default '' check (char_length(phone) <= 40),
  kids                 smallint check (kids between 1 and 200),
  age_range            text not null default '' check (age_range in ('', '5-8', '7-11', '8-12', 'mixed')),
  notes                text not null default '' check (char_length(notes) <= 2000),
  consent_at           timestamptz,

  -- Places this order currently takes off its session. Set when places are held,
  -- back to 0 when they are released, so a release can only ever happen once.
  places_held          smallint not null default 0 check (places_held between 0 and 200),

  -- Payment provider bookkeeping.
  provider             text not null default 'stripe',
  checkout_session_id  text unique,
  checkout_url         text,
  payment_intent_id    text,
  last_synced_at       timestamptz,

  expires_at           timestamptz not null,   -- booking hold ends / payment link lapses
  reconcile_after      timestamptz,            -- lease used by the background reconciler
  paid_at              timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  check (kind <> 'booking' or event_id is not null or status <> 'pending')
);

create index orders_created_idx on public.orders (created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);
create index orders_event_idx on public.orders (event_id, status) where event_id is not null;
create index orders_registration_idx on public.orders (registration_id) where registration_id is not null;
create index orders_payment_intent_idx on public.orders (payment_intent_id) where payment_intent_id is not null;
create index orders_paid_at_idx on public.orders (paid_at) where paid_at is not null;
-- The reconciler only ever looks at unpaid orders past their deadline.
create index orders_overdue_idx on public.orders (expires_at) where status = 'pending';
create index orders_search_idx on public.orders
  using gin ((name || ' ' || email || ' ' || description) extensions.gin_trgm_ops);

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Webhook events already handled. Payment providers deliver at least once, so every event
-- is recorded in the same transaction as its effect and a repeat delivery becomes a no-op.
create table public.payment_events (
  id           text primary key,
  type         text not null,
  received_at  timestamptz not null default now()
);

alter table public.orders         enable row level security;
alter table public.payment_events enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.orders, public.payment_events from anon, authenticated;
  end if;
end;
$$;
