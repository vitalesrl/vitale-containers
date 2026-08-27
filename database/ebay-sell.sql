-- Vitale Containers V5.0 - eBay Sell
-- Eseguire una sola volta nel SQL Editor del progetto Supabase esistente.

alter table public.marketplace_listings
  add column if not exists marketplace_environment text not null default 'production' check (marketplace_environment in ('sandbox','production')),
  add column if not exists adapter_mode text not null default 'manual' check (adapter_mode in ('manual','api')),
  add column if not exists sku text,
  add column if not exists external_offer_id text,
  add column if not exists category_id text,
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists last_sync_at timestamptz;

update public.marketplace_listings
set adapter_mode = 'api'
where marketplace = 'ebay' and adapter_mode <> 'api';

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_product_id_marketplace_key;

create unique index if not exists marketplace_listings_product_market_env_uidx
  on public.marketplace_listings(product_id, marketplace, marketplace_environment);

create index if not exists marketplace_listings_channel_status_idx
  on public.marketplace_listings(marketplace, marketplace_environment, status);

create table if not exists public.ebay_connections (
  environment text primary key check (environment in ('sandbox','production')),
  refresh_token_encrypted text not null,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ebay_settings (
  environment text primary key check (environment in ('sandbox','production')),
  marketplace_id text not null default 'EBAY_IT',
  merchant_location_key text not null,
  fulfillment_policy_id text not null,
  payment_policy_id text not null,
  return_policy_id text not null,
  currency text not null default 'EUR',
  updated_at timestamptz not null default now()
);

alter table public.ebay_connections enable row level security;
alter table public.ebay_settings enable row level security;

-- Le due tabelle eBay sono intenzionalmente senza policy pubbliche:
-- sono accessibili soltanto dal backend tramite la service role Supabase.
