-- ============================================================
-- SAHA Uygulaması — Veritabanı Şeması
-- Supabase SQL Editor'a yapıştır ve çalıştır
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
create table if not exists profiles (
  id               uuid references auth.users on delete cascade primary key,
  full_name        text,
  phone            text,
  position         text check (position in ('Kaleci','Defans','Orta Saha','Forvet')),
  avatar_url       text,
  goals            int  default 0,
  assists          int  default 0,
  matches_played   int  default 0,
  wallet_balance   int  default 0,
  is_premium       boolean default false,
  rating           float default 5.0,
  created_at       timestamptz default now()
);

-- Rating kolonu mevcut tablolara ekle (idempotent)
alter table profiles add column if not exists rating float default 5.0;

-- Futbolcu geçmişi kolonları
alter table profiles add column if not exists experience_level text default 'Amatör';
alter table profiles add column if not exists experience_years int default 0;
alter table profiles add column if not exists experience_detail text;
alter table profiles add column if not exists city text default 'Bursa';
alter table profiles add column if not exists district text;

-- Saha fotoğrafları
alter table venues add column if not exists photo_url text;
alter table venues add column if not exists description text;

-- Yeni kullanıcı kaydında otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. VENUES (Halı Sahalar) ────────────────────────────────
create table if not exists venues (
  id              uuid default gen_random_uuid() primary key,
  owner_id        uuid references auth.users on delete set null,
  name            text not null,
  district        text,
  city            text default 'Bursa',
  address         text,
  phone           text,
  description     text,
  price_per_hour  int  default 500,
  ground_type     text,
  field_size      text,
  -- Özellikler
  has_camera      boolean default false,
  has_referee     boolean default false,
  is_indoor       boolean default false,
  has_lighting    boolean default true,
  has_scoreboard  boolean default false,
  has_shower      boolean default false,
  has_parking     boolean default false,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ── 3. MATCHES (Maçlar) ─────────────────────────────────────
create table if not exists matches (
  id                  uuid default gen_random_uuid() primary key,
  venue_id            uuid references venues on delete cascade,
  organizer_id        uuid references auth.users on delete set null,
  format              text check (format in ('5v5','6v6','7v7','8v8','11v11')),
  match_date          timestamptz not null,
  max_players         int  default 10,
  current_players     int  default 0,
  price               int,
  status              text default 'open' check (status in ('open','full','cancelled','completed')),
  notes               text,
  is_seeking_players  boolean default false,
  needed_positions    text[] default '{}',
  created_at          timestamptz default now()
);

-- ── 4. MATCH_PLAYERS (Maç Katılımcıları) ────────────────────
create table if not exists match_players (
  id         uuid default gen_random_uuid() primary key,
  match_id   uuid references matches on delete cascade,
  user_id    uuid references auth.users on delete cascade,
  joined_at  timestamptz default now(),
  unique (match_id, user_id)
);

-- current_players'ı otomatik güncelle
create or replace function update_match_player_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update matches set current_players = current_players + 1
    where id = new.match_id;
    -- Dolunca status güncelle
    update matches set status = 'full'
    where id = new.match_id and current_players >= max_players;
  elsif TG_OP = 'DELETE' then
    update matches set current_players = greatest(current_players - 1, 0),
                       status = 'open'
    where id = old.match_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_match_player_count on match_players;
create trigger trg_match_player_count
  after insert or delete on match_players
  for each row execute procedure update_match_player_count();

-- ── 5. MATCH_APPLICATIONS (Oyuncu Başvuruları) ──────────────
create table if not exists match_applications (
  id         uuid default gen_random_uuid() primary key,
  match_id   uuid references matches on delete cascade,
  user_id    uuid references auth.users on delete cascade,
  position   text,
  message    text,
  status     text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique (match_id, user_id)
);

-- ── 6. MATCH_RATINGS (Maç Değerlendirmeleri) ────────────────
create table if not exists match_ratings (
  id         uuid default gen_random_uuid() primary key,
  match_id   uuid references matches on delete cascade,
  from_user  uuid references auth.users on delete cascade,
  to_user    uuid references auth.users on delete cascade,
  rating     int  check (rating between 1 and 10),
  created_at timestamptz default now(),
  unique (match_id, from_user, to_user)
);

-- ── 7. VENUE_PRODUCTS (Saha Market Ürünleri) ────────────────
create table if not exists venue_products (
  id           uuid default gen_random_uuid() primary key,
  venue_id     uuid references venues on delete cascade,
  name         text not null,
  emoji        text default '📦',
  category     text default 'Genel',
  price        int  not null,
  stock        int  default 0,
  unit         text,
  is_available boolean default true,
  created_at   timestamptz default now()
);

-- ── 8. MARKET_ORDERS (Sipariş Kayıtları) ────────────────────
create table if not exists market_orders (
  id         uuid default gen_random_uuid() primary key,
  venue_id   uuid references venues on delete set null,
  user_id    uuid references auth.users on delete set null,
  match_id   uuid references matches on delete set null,
  items      jsonb not null default '[]',
  total      int  not null,
  status     text default 'pending' check (status in ('pending','preparing','delivered','cancelled')),
  created_at timestamptz default now()
);

-- ── 9. MESSAGES (Chat) ──────────────────────────────────────
create table if not exists messages (
  id           uuid default gen_random_uuid() primary key,
  from_user    uuid references auth.users on delete set null,
  to_user      uuid references auth.users on delete set null,
  match_id     uuid references matches on delete cascade,
  content      text not null,
  read         boolean default false,
  created_at   timestamptz default now()
);

-- ── 10. VENUE_FEATURES (Saha Özellikleri Detay) ─────────────
create table if not exists venue_features (
  id             uuid default gen_random_uuid() primary key,
  venue_id       uuid unique references venues on delete cascade,
  working_hours  text default '08:00-24:00',
  ground_type    text default 'Suni Çim',
  field_size     text default '5x5',
  latitude       float,
  longitude      float,
  has_camera     boolean default false,
  has_referee    boolean default false,
  is_indoor      boolean default false,
  has_lighting   boolean default true,
  has_scoreboard boolean default false,
  has_shower     boolean default false,
  has_parking    boolean default false,
  created_at     timestamptz default now()
);

-- ── 11. MATCH_INVITES (Oyuncu Davetleri) ─────────────────────
create table if not exists match_invites (
  id         uuid default gen_random_uuid() primary key,
  from_user  uuid references auth.users on delete cascade,
  to_user    uuid references auth.users on delete cascade,
  status     text default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz default now(),
  unique (from_user, to_user)
);

-- ── 12. ROW LEVEL SECURITY ──────────────────────────────────
alter table profiles            enable row level security;
alter table venues              enable row level security;
alter table matches             enable row level security;
alter table match_players       enable row level security;
alter table match_applications  enable row level security;
alter table match_ratings       enable row level security;
alter table venue_products      enable row level security;
alter table market_orders       enable row level security;
alter table messages            enable row level security;

-- Profiles
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Venues
create policy "venues_select" on venues for select using (true);
create policy "venues_insert" on venues for insert with check (auth.uid() = owner_id);
create policy "venues_update" on venues for update using (auth.uid() = owner_id);

-- Matches
create policy "matches_select" on matches for select using (true);
create policy "matches_insert" on matches for insert with check (auth.uid() = organizer_id);
create policy "matches_update" on matches for update using (auth.uid() = organizer_id);
create policy "matches_delete" on matches for delete using (auth.uid() = organizer_id);

-- Match players
create policy "mp_select" on match_players for select using (true);
create policy "mp_insert" on match_players for insert with check (auth.uid() = user_id);
create policy "mp_delete" on match_players for delete using (auth.uid() = user_id);

-- Match applications
create policy "ma_select" on match_applications for select using (true);
create policy "ma_insert" on match_applications for insert with check (auth.uid() = user_id);
create policy "ma_update" on match_applications for update
  using (exists (select 1 from matches where id = match_id and organizer_id = auth.uid()));

-- Match ratings
create policy "mr_select" on match_ratings for select using (true);
create policy "mr_insert" on match_ratings for insert with check (auth.uid() = from_user);
create policy "mr_update" on match_ratings for update using (auth.uid() = from_user);

-- Venue products: herkes görebilir, saha sahibi yönetir
create policy "vp_select" on venue_products for select using (true);
create policy "vp_insert" on venue_products for insert
  with check (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));
create policy "vp_update" on venue_products for update
  using (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));
create policy "vp_delete" on venue_products for delete
  using (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));

-- Market orders
create policy "mo_select" on market_orders for select
  using (auth.uid() = user_id or exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));
create policy "mo_insert" on market_orders for insert with check (auth.uid() = user_id);

-- Venue features
alter table venue_features enable row level security;
create policy "vf_select" on venue_features for select using (true);
create policy "vf_insert" on venue_features for insert
  with check (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));
create policy "vf_update" on venue_features for update
  using (exists (select 1 from venues where id = venue_id and owner_id = auth.uid()));

-- Match invites
alter table match_invites enable row level security;
create policy "mi_select" on match_invites for select
  using (auth.uid() = from_user or auth.uid() = to_user);
create policy "mi_insert" on match_invites for insert with check (auth.uid() = from_user);
create policy "mi_update" on match_invites for update
  using (auth.uid() = to_user);

-- Messages
create policy "msg_select" on messages for select
  using (auth.uid() = from_user or auth.uid() = to_user
    or (match_id is not null and exists (select 1 from match_players where match_id = messages.match_id and user_id = auth.uid())));
create policy "msg_insert" on messages for insert with check (auth.uid() = from_user);
create policy "msg_update" on messages for update using (auth.uid() = to_user);

-- ── 11. ÖRNEK VERİ (Bursa Sahaları) ─────────────────────────
insert into venues (name, district, city, address, price_per_hour, has_lighting, has_shower, has_parking) values
  ('Nilüfer Park Halı Saha',   'Nilüfer',   'Bursa', 'Özlüce Mah. Atatürk Cad. No:12',   600, true, true, true),
  ('Görükle Spor Kompleksi',   'Görükle',   'Bursa', 'Görükle Mah. Spor Sok. No:5',       550, true, false, true),
  ('Yıldırım Halı Saha',       'Yıldırım',  'Bursa', 'Yavuz Selim Mah. No:34',            500, true, false, false),
  ('Osmangazi Futbol Merkezi', 'Osmangazi', 'Bursa', 'Demirtaş Organize Sanayi No:8',     650, true, true, true),
  ('Uludağ Saha',              'Nilüfer',   'Bursa', 'Beşevler Mah. Uludağ Cad. No:22',  575, true, false, true)
on conflict do nothing;
