create table public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text,
  amount_total bigint not null check (amount_total > 0),
  currency text not null check (currency = 'usd'),
  payment_status text not null check (payment_status = 'paid'),
  line_items jsonb not null check (jsonb_typeof(line_items) = 'array'),
  livemode boolean not null default false check (livemode = false),
  created_at timestamptz not null default now()
);

comment on table public.orders is
  'Stripe Test Mode USD orders. Inserts are handled by the signature-verified Stripe webhook.';

alter table public.orders enable row level security;

revoke all on table public.orders from public, anon, authenticated, service_role;
grant insert on table public.orders to service_role;
