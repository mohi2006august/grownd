-- 1. Business details in the dashboard's Settings (name, email, phone, address), shown on the
--    contact page and in the policies.
-- 2. Emails to the team about new registrations and payments (backend/src/services/notify.js).
--
-- notified_at records that a registration or a paid order has been in a team email, so each one is
-- sent once even with many servers running. Rows that existed before this migration count as sent.
-- notify_state holds when the last email went out, so a rush of sign-ups becomes one email a minute
-- rather than one per sign-up.

alter table public.settings drop constraint settings_key_check;
alter table public.settings add constraint settings_key_check check (key in (
  'currency', 'timezone', 'responseTime', 'insuranceNote', 'businessName', 'contactEmail', 'contactPhone', 'address'
));

alter table public.registrations add column notified_at timestamptz;
alter table public.orders add column notified_at timestamptz;
update public.registrations set notified_at = created_at;
update public.orders set notified_at = coalesce(paid_at, created_at);

create index registrations_unnotified_idx on public.registrations (id) where notified_at is null;
create index orders_unnotified_paid_idx on public.orders (paid_at) where notified_at is null and status = 'paid';

create table public.notify_state (
  id            smallint primary key default 1 check (id = 1),
  last_sent_at  timestamptz not null default 'epoch'
);
insert into public.notify_state default values;

alter table public.notify_state enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.notify_state from anon, authenticated;
  end if;
end;
$$;
