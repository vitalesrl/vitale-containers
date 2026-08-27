-- Vitale Containers V5.1 - Subito assistito
-- Eseguire nel SQL Editor del progetto Supabase esistente.

alter table public.marketplace_listings
  add column if not exists marketplace_environment text not null default 'production' check (marketplace_environment in ('sandbox','production')),
  add column if not exists adapter_mode text not null default 'manual' check (adapter_mode in ('manual','api')),
  add column if not exists sku text,
  add column if not exists external_offer_id text,
  add column if not exists category_id text,
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists last_sync_at timestamptz;

alter table public.marketplace_listings
  drop constraint if exists marketplace_listings_product_id_marketplace_key;

create unique index if not exists marketplace_listings_product_market_env_uidx
  on public.marketplace_listings(product_id, marketplace, marketplace_environment);

create index if not exists marketplace_listings_channel_status_idx
  on public.marketplace_listings(marketplace, marketplace_environment, status);

update public.marketplace_listings
set adapter_mode = 'api'
where marketplace = 'ebay' and adapter_mode <> 'api';

create or replace view public.subito_listings
with (security_invoker = true)
as
select
  product_id,
  status as subito_status,
  external_url as subito_listing_url,
  external_listing_id as subito_listing_id,
  published_at as subito_published_at,
  last_sync_at as subito_last_sync
from public.marketplace_listings
where marketplace = 'subito';

-- Il backend usa marketplace_listings come sorgente unica.
-- La vista mantiene già disponibili i nomi Subito richiesti per il futuro adapter API.
