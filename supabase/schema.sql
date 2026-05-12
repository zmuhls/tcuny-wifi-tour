create extension if not exists "pgcrypto";

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  access_codes text[] not null default '{}',
  max_gps_accuracy_meters integer not null default 80,
  default_radius_meters integer not null default 85,
  starts_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.contributors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  team_name text not null default 'Solo walkers',
  access_code_hash text not null,
  joined_at timestamptz not null default now()
);

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slug text not null,
  name text not null,
  short_name text not null,
  category text not null,
  stage text not null,
  role text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters integer not null,
  address text not null,
  description text not null,
  provider text not null,
  ssids text[] not null default '{}',
  access_type text not null,
  location_type text not null,
  status_label text not null,
  status_date timestamptz,
  remarks text,
  live_status text,
  maps_query text not null,
  unique (event_id, slug)
);

create table public.pin_sources (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  label text not null,
  url text not null,
  source_identifier text,
  refreshed_at timestamptz
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  stop_slugs text[] not null,
  created_at timestamptz not null default now()
);

create type public.ping_status as enum ('verified', 'needs_review', 'rejected');

create table public.pings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  pin_id uuid not null references public.pins(id) on delete cascade,
  contributor_id uuid not null references public.contributors(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  gps_accuracy_meters double precision,
  ssid_claim text not null,
  server_round_trip_ms integer,
  distance_meters double precision not null,
  status public.ping_status not null,
  reasons text[] not null default '{}',
  network_info jsonb not null default '{}'::jsonb,
  request_ip inet,
  request_asn text,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  ping_id uuid not null references public.pings(id) on delete cascade,
  reviewer_name text not null,
  outcome text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
alter table public.contributors enable row level security;
alter table public.pins enable row level security;
alter table public.pin_sources enable row level security;
alter table public.routes enable row level security;
alter table public.pings enable row level security;
alter table public.reviews enable row level security;

create policy "read tour events" on public.events for select using (true);
create policy "read tour pins" on public.pins for select using (true);
create policy "read pin sources" on public.pin_sources for select using (true);
create policy "read routes" on public.routes for select using (true);
create policy "read pings" on public.pings for select using (true);
create policy "insert contributors" on public.contributors for insert with check (true);
create policy "insert pings" on public.pings for insert with check (true);
