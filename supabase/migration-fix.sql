-- ============================================================
-- SAHA — Eksik Tabloları ve Kolonları Oluştur
-- Supabase SQL Editor'a yapıştır ve RUN butonuna bas
-- ============================================================

-- ── 1. EKSİK KOLONLAR (mevcut tablolara) ────────────────────

ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_seeking_players boolean DEFAULT false;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS needed_positions text[] DEFAULT '{}';
ALTER TABLE matches ADD COLUMN IF NOT EXISTS share_token text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE match_players ADD COLUMN IF NOT EXISTS team text DEFAULT 'home';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'Amatör';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_years int DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_detail text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text DEFAULT 'Bursa';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS ground_type text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS field_size text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_camera boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_referee boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_indoor boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_lighting boolean DEFAULT true;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_scoreboard boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_shower boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_parking boolean DEFAULT false;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating float DEFAULT 4.5;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS total_reviews int DEFAULT 0;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS owner_id uuid;

ALTER TABLE match_invites ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES matches(id) ON DELETE CASCADE;

-- ── 2. EKSİK TABLOLAR ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_applications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   uuid REFERENCES matches(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE,
  position   text,
  message    text,
  status     text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_ratings (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id   uuid REFERENCES matches(id) ON DELETE CASCADE,
  from_user  uuid REFERENCES auth.users ON DELETE CASCADE,
  to_user    uuid REFERENCES auth.users ON DELETE CASCADE,
  rating     int CHECK (rating BETWEEN 1 AND 10),
  created_at timestamptz DEFAULT now(),
  UNIQUE (match_id, from_user, to_user)
);

CREATE TABLE IF NOT EXISTS venue_features (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id       uuid UNIQUE REFERENCES venues(id) ON DELETE CASCADE,
  working_hours  text DEFAULT '08:00-24:00',
  ground_type    text DEFAULT 'Suni Çim',
  field_size     text DEFAULT '5x5',
  latitude       float,
  longitude      float,
  has_camera     boolean DEFAULT false,
  has_referee    boolean DEFAULT false,
  is_indoor      boolean DEFAULT false,
  has_lighting   boolean DEFAULT true,
  has_scoreboard boolean DEFAULT false,
  has_shower     boolean DEFAULT false,
  has_parking    boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venue_products (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id     uuid REFERENCES venues(id) ON DELETE CASCADE,
  name         text NOT NULL,
  emoji        text DEFAULT '📦',
  category     text DEFAULT 'Genel',
  price        int NOT NULL,
  stock        int DEFAULT 0,
  unit         text,
  is_available boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_orders (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id   uuid REFERENCES venues(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  match_id   uuid REFERENCES matches(id) ON DELETE SET NULL,
  items      jsonb NOT NULL DEFAULT '[]',
  total      int NOT NULL,
  status     text DEFAULT 'pending' CHECK (status IN ('pending','preparing','delivered','cancelled')),
  created_at timestamptz DEFAULT now()
);

-- ── 3. RLS ──────────────────────────────────────────────────

ALTER TABLE match_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ma_select" ON match_applications;
DROP POLICY IF EXISTS "ma_insert" ON match_applications;
DROP POLICY IF EXISTS "ma_update" ON match_applications;
CREATE POLICY "ma_select" ON match_applications FOR SELECT USING (true);
CREATE POLICY "ma_insert" ON match_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ma_update" ON match_applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM matches WHERE id = match_id AND organizer_id = auth.uid()));

ALTER TABLE match_ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mr_select" ON match_ratings;
DROP POLICY IF EXISTS "mr_insert" ON match_ratings;
DROP POLICY IF EXISTS "mr_update" ON match_ratings;
CREATE POLICY "mr_select" ON match_ratings FOR SELECT USING (true);
CREATE POLICY "mr_insert" ON match_ratings FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "mr_update" ON match_ratings FOR UPDATE USING (auth.uid() = from_user);

ALTER TABLE venue_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vf_select" ON venue_features;
DROP POLICY IF EXISTS "vf_insert" ON venue_features;
DROP POLICY IF EXISTS "vf_update" ON venue_features;
CREATE POLICY "vf_select" ON venue_features FOR SELECT USING (true);
CREATE POLICY "vf_insert" ON venue_features FOR INSERT WITH CHECK (true);
CREATE POLICY "vf_update" ON venue_features FOR UPDATE USING (true);

ALTER TABLE venue_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vp_select" ON venue_products;
DROP POLICY IF EXISTS "vp_insert" ON venue_products;
DROP POLICY IF EXISTS "vp_update" ON venue_products;
DROP POLICY IF EXISTS "vp_delete" ON venue_products;
CREATE POLICY "vp_select" ON venue_products FOR SELECT USING (true);
CREATE POLICY "vp_insert" ON venue_products FOR INSERT WITH CHECK (true);
CREATE POLICY "vp_update" ON venue_products FOR UPDATE USING (true);
CREATE POLICY "vp_delete" ON venue_products FOR DELETE USING (true);

ALTER TABLE market_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mo_select" ON market_orders;
DROP POLICY IF EXISTS "mo_insert" ON market_orders;
CREATE POLICY "mo_select" ON market_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mo_insert" ON market_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 4. SEED DATA ────────────────────────────────────────────

INSERT INTO venue_features (venue_id, has_lighting, has_parking, has_shower, has_camera, ground_type, field_size, working_hours)
SELECT v.id, true, true, true, false, 'Suni Çim', '30x50', '08:00-24:00'
FROM venues v
WHERE NOT EXISTS (SELECT 1 FROM venue_features vf WHERE vf.venue_id = v.id)
ON CONFLICT (venue_id) DO NOTHING;
