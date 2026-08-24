create extension if not exists pgcrypto;

create table if not exists public.depots (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  size text not null,
  type text not null,
  condition text not null,
  location text,
  depot_id uuid references public.depots(id) on delete set null,
  description text not null default '',
  price numeric(12,2),
  vat_included boolean not null default false,
  availability integer check (availability is null or availability >= 0),
  image_url text,
  length_m numeric(6,2),
  width_m numeric(6,2),
  height_m numeric(6,2),
  volume_m3 numeric(8,2),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  container_number text unique,
  depot_id uuid references public.depots(id) on delete set null,
  status text not null default 'available' check (status in ('available','reserved','sold','incoming','unavailable')),
  year integer,
  manufacturer text,
  color text,
  tare_kg numeric(10,2),
  csc_expiry date,
  purchase_price numeric(12,2),
  sale_price numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  company text,
  vat_number text,
  email text not null,
  phone text not null,
  destination text,
  quantity integer not null default 1,
  transport_required boolean not null default false,
  message text,
  status text not null default 'new' check (status in ('new','contacted','quoted','won','lost')),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  marketplace text not null,
  external_listing_id text,
  external_url text,
  title text,
  description text,
  price numeric(12,2),
  status text not null default 'draft' check (status in ('draft','active','paused','sold','error')),
  sync_status text not null default 'pending',
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(product_id, marketplace)
);


create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  container_id uuid references public.containers(id) on delete cascade,
  storage_provider text not null default 'supabase' check (storage_provider in ('local','supabase')),
  storage_path text not null,
  public_url text not null,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_assets_one_parent check (
    (product_id is not null and container_id is null) or
    (product_id is null and container_id is not null)
  )
);

create index if not exists media_assets_product_idx on public.media_assets(product_id, position);
create index if not exists media_assets_container_idx on public.media_assets(container_id, position);
create unique index if not exists media_assets_one_primary_product on public.media_assets(product_id) where product_id is not null and is_primary = true;
create unique index if not exists media_assets_one_primary_container on public.media_assets(container_id) where container_id is not null and is_primary = true;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'operator' check (role in ('admin','commercial','operator','read_only')),
  created_at timestamptz not null default now()
);

alter table public.depots enable row level security;
alter table public.products enable row level security;
alter table public.containers enable row level security;
alter table public.leads enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.media_assets enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "public_read_published_products" on public.products;
create policy "public_read_published_products" on public.products for select to anon using (is_published = true);

drop policy if exists "users_read_own_profile" on public.profiles;
create policy "users_read_own_profile" on public.profiles for select to authenticated using (auth.uid() = id);


drop policy if exists "public_read_product_media" on public.media_assets;
create policy "public_read_product_media" on public.media_assets
for select to anon using (
  product_id is not null and exists (
    select 1 from public.products p where p.id = media_assets.product_id and p.is_published = true
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'container-images',
  'container-images',
  true,
  12582912,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_read_container_images" on storage.objects;
create policy "public_read_container_images" on storage.objects
for select to public using (bucket_id = 'container-images');
