import { db } from '../config/database';

async function migrate() {
  console.log('🔄 Running database migrations...');
  await db.query(`
    CREATE TABLE IF NOT EXISTS regions (
      id SERIAL PRIMARY KEY, name_en VARCHAR(100), name_am VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS zones (
      id SERIAL PRIMARY KEY, region_id INT REFERENCES regions(id), name_en VARCHAR(100), name_am VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS woredas (
      id SERIAL PRIMARY KEY, zone_id INT REFERENCES zones(id), name_en VARCHAR(100), name_am VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS cities (
      id SERIAL PRIMARY KEY, woreda_id INT REFERENCES woredas(id), name_en VARCHAR(100), name_am VARCHAR(100)
    );
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('client','provider','admin')),
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      phone_raw VARCHAR(20),
      phone_masked VARCHAR(20),
      avatar_url TEXT,
      is_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      preferred_lang VARCHAR(5) DEFAULT 'am',
      fcm_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS provider_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      business_name VARCHAR(255),
      bio TEXT,
      trade_license_url TEXT,
      rig_types TEXT[],
      max_depth_meters INT,
      region_id INT REFERENCES regions(id),
      zone_id INT REFERENCES zones(id),
      woreda_id INT REFERENCES woredas(id),
      city_id INT REFERENCES cities(id),
      custom_location VARCHAR(255),
      lat DECIMAL(10,7), lng DECIMAL(10,7),
      star_rating DECIMAL(2,1) DEFAULT 0.0,
      total_reviews INT DEFAULT 0,
      wallet_balance DECIMAL(15,2) DEFAULT 0.00,
      is_available BOOLEAN DEFAULT TRUE,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES users(id),
      title VARCHAR(255), description TEXT,
      estimated_depth INT, budget_min DECIMAL(15,2), budget_max DECIMAL(15,2),
      region_id INT REFERENCES regions(id), zone_id INT REFERENCES zones(id),
      woreda_id INT REFERENCES woredas(id), city_id INT REFERENCES cities(id),
      custom_location VARCHAR(255), lat DECIMAL(10,7), lng DECIMAL(10,7),
      survey_report_url TEXT, ai_report_summary TEXT,
      status VARCHAR(30) DEFAULT 'open',
      hired_provider_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID REFERENCES service_requests(id) ON DELETE CASCADE,
      provider_id UUID REFERENCES users(id),
      bid_amount DECIMAL(15,2) NOT NULL, mobilization_fee DECIMAL(15,2), message TEXT,
      status VARCHAR(20) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID REFERENCES service_requests(id),
      bid_id UUID REFERENCES bids(id),
      client_id UUID REFERENCES users(id), provider_id UUID REFERENCES users(id),
      total_amount DECIMAL(15,2), platform_commission DECIMAL(15,2), provider_earnings DECIMAL(15,2),
      advance_paid DECIMAL(15,2) DEFAULT 0,
      payment_status VARCHAR(20) DEFAULT 'pending',
      job_status VARCHAR(20) DEFAULT 'pending',
      telebirr_tx_id VARCHAR(255), chapa_tx_id VARCHAR(255),
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID REFERENCES users(id),
      title VARCHAR(255) NOT NULL, description TEXT,
      category VARCHAR(50), price DECIMAL(15,2) NOT NULL, currency VARCHAR(5) DEFAULT 'ETB',
      condition VARCHAR(20), images TEXT[],
      is_available BOOLEAN DEFAULT TRUE, is_approved BOOLEAN DEFAULT FALSE,
      region_id INT REFERENCES regions(id), views INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID REFERENCES users(id),
      caption TEXT, media_urls TEXT[], media_type VARCHAR(10),
      ai_moderation VARCHAR(20) DEFAULT 'pending', ai_rejection_reason TEXT,
      likes_count INT DEFAULT 0, comments_count INT DEFAULT 0,
      is_visible BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS post_likes (
      user_id UUID REFERENCES users(id), post_id UUID REFERENCES posts(id), PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE IF NOT EXISTS post_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      author_id UUID REFERENCES users(id), content TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id),
      participant1 UUID REFERENCES users(id), participant2 UUID REFERENCES users(id),
      firebase_room_id VARCHAR(255) UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS chat_violations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id UUID REFERENCES chat_rooms(id),
      user_id UUID REFERENCES users(id),
      message_ref VARCHAR(255), violation_type VARCHAR(50), original_content TEXT,
      detected_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID UNIQUE REFERENCES orders(id),
      reviewer_id UUID REFERENCES users(id), reviewee_id UUID REFERENCES users(id),
      rating SMALLINT CHECK (rating BETWEEN 1 AND 5), comment TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      type VARCHAR(50), title_en TEXT, title_am TEXT, body_en TEXT, body_am TEXT,
      data JSONB, is_read BOOLEAN DEFAULT FALSE, sent_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID REFERENCES users(id),
      action VARCHAR(100), target_type VARCHAR(50), target_id UUID,
      details JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
    CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category, is_available);
    CREATE INDEX IF NOT EXISTS idx_posts_moderation ON posts(ai_moderation, is_visible);
    CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
  `);
  console.log('✅ Migrations complete!');
  process.exit(0);
}

migrate().catch((err) => { console.error('Migration failed:', err); process.exit(1); });
