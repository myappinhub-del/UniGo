-- UniGo Super App — Supabase PostgreSQL Schema
-- Run this script in your Supabase Dashboard -> SQL Editor.
-- Pair with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in AI Studio Secrets.

CREATE OR REPLACE FUNCTION public.unigo_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'partner', 'franchise_admin', 'super_admin')),
  franchise_zone TEXT NOT NULL DEFAULT 'Indiranagar, Bengaluru',
  wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 1500,
  saved_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  wishlist_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.franchise_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  manager_uid TEXT,
  ops_admin_uid TEXT,
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 15,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  boundary_mode TEXT NOT NULL DEFAULT 'radius' CHECK (boundary_mode IN ('radius', 'polygon')),
  boundary_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.staff_directory (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('partner', 'franchise_admin', 'super_admin')),
  franchise_zone TEXT NOT NULL,
  vehicle_type TEXT CHECK (vehicle_type IN ('bike', 'auto', 'car', 'van', 'technician')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partners (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike', 'auto', 'car', 'van', 'technician')),
  phone TEXT NOT NULL DEFAULT '',
  franchise_zone TEXT NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  rating NUMERIC(3, 2) NOT NULL DEFAULT 4.9,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id TEXT PRIMARY KEY,
  vertical TEXT NOT NULL CHECK (vertical IN ('restaurant', 'dish', 'grocery', 'shopping', 'service', 'rental')),
  title TEXT NOT NULL,
  subtitle TEXT,
  category TEXT NOT NULL,
  parent_id TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(12, 2),
  rating NUMERIC(3, 2) NOT NULL DEFAULT 4.5,
  eta_minutes INTEGER,
  is_veg BOOLEAN,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  unit_label TEXT,
  specs JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url TEXT,
  franchise_zone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  cta_label TEXT NOT NULL,
  target_vertical TEXT NOT NULL CHECK (target_vertical IN ('food', 'grocery', 'shopping', 'rides', 'services', 'rentals', 'parcel')),
  promo_code TEXT,
  image_url TEXT,
  badge_text TEXT,
  franchise_zone TEXT NOT NULL DEFAULT 'All Zones',
  priority INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  vertical TEXT NOT NULL CHECK (vertical IN ('food', 'grocery', 'shopping', 'ride', 'service', 'parcel', 'rental')),
  status TEXT NOT NULL CHECK (status IN ('placed', 'confirmed', 'preparing', 'en_route', 'delivered', 'completed', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2),
  delivery_fee NUMERIC(12, 2),
  platform_fee NUMERIC(12, 2),
  tax NUMERIC(12, 2),
  discount NUMERIC(12, 2),
  total NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('pending', 'paid', 'cod', 'refunded')),
  pickup_address TEXT,
  delivery_address TEXT,
  pickup_coords JSONB,
  delivery_coords JSONB,
  distance_km NUMERIC(8, 2),
  partner_id TEXT,
  partner_name TEXT,
  scheduled_slot TEXT,
  notes TEXT,
  franchise_zone TEXT NOT NULL,
  franchise_manager_uid TEXT,
  ops_admin_uid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dispatch_jobs (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  vertical TEXT NOT NULL CHECK (vertical IN ('food', 'grocery', 'shopping', 'ride', 'service', 'parcel', 'rental')),
  pickup_area TEXT NOT NULL,
  drop_area TEXT NOT NULL,
  pickup_coords JSONB,
  delivery_coords JSONB,
  distance_km NUMERIC(8, 2),
  payout_amount NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'en_route', 'completed', 'cancelled')),
  partner_id TEXT,
  franchise_zone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order', 'ride', 'promo', 'system')),
  order_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON public.orders (partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_zone ON public.orders (franchise_zone);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON public.dispatch_jobs (status);
CREATE INDEX IF NOT EXISTS idx_dispatch_partner_id ON public.dispatch_jobs (partner_id);
CREATE INDEX IF NOT EXISTS idx_catalog_vertical ON public.catalog_items (vertical);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);

-- Updated-at triggers
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_zones_updated_at ON public.franchise_zones;
CREATE TRIGGER trg_zones_updated_at BEFORE UPDATE ON public.franchise_zones FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated_at ON public.staff_directory;
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON public.staff_directory FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_partners_updated_at ON public.partners;
CREATE TRIGGER trg_partners_updated_at BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalog_updated_at ON public.catalog_items;
CREATE TRIGGER trg_catalog_updated_at BEFORE UPDATE ON public.catalog_items FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_ads_updated_at ON public.ads;
CREATE TRIGGER trg_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

DROP TRIGGER IF EXISTS trg_dispatch_updated_at ON public.dispatch_jobs;
CREATE TRIGGER trg_dispatch_updated_at BEFORE UPDATE ON public.dispatch_jobs FOR EACH ROW EXECUTE FUNCTION public.unigo_set_updated_at();

-- Row Level Security (strict server-side access via service_role; public catalog/ads/zones readable)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.franchise_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read catalog_items" ON public.catalog_items;
CREATE POLICY "Public read catalog_items" ON public.catalog_items FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read ads" ON public.ads;
CREATE POLICY "Public read ads" ON public.ads FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read franchise_zones" ON public.franchise_zones;
CREATE POLICY "Public read franchise_zones" ON public.franchise_zones FOR SELECT USING (TRUE);
