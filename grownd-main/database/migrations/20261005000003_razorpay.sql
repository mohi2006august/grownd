-- Payments move from Stripe to Razorpay (Payment Links). The order columns are provider-neutral:
--   checkout_session_id  the Razorpay Payment Link id (plink_...)
--   checkout_url         its short_url, where the customer pays
--   payment_intent_id    the Razorpay payment id (pay_...)
alter table public.orders alter column provider set default 'razorpay';

comment on column public.orders.checkout_session_id is 'Payment provider checkout id (Razorpay Payment Link plink_...)';
comment on column public.orders.checkout_url is 'Where the customer pays (Razorpay short_url)';
comment on column public.orders.payment_intent_id is 'Payment provider payment id (Razorpay pay_...)';
comment on column public.orders.unit_amount is 'Smallest currency unit (paise for INR)';
