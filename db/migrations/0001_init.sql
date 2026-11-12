-- Schéma initial : remplace Google Calendar (réservations) et Google Sheets (prix).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Réglages par appartement. Les textes et photos restent dans config/apartments.ts.
CREATE TABLE apartment_settings (
  slug                text PRIMARY KEY,
  default_price_cents integer NOT NULL CHECK (default_price_cents >= 0),
  ical_token          text NOT NULL UNIQUE,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO apartment_settings (slug, default_price_cents, ical_token) VALUES
  ('ps1', 15000, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('ps2', 15000, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  ('t3',  12000, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

-- Séjours et blocages. check_out est exclusif : un séjour du 11 au 13 occupe les nuits du 11 et du 12.
CREATE TABLE reservations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_slug    text NOT NULL REFERENCES apartment_settings (slug),
  kind              text NOT NULL CHECK (kind IN ('guest', 'block')),
  status            text NOT NULL CHECK (status IN ('pending', 'confirmed', 'refused', 'cancelled')),
  source            text NOT NULL CHECK (source IN ('site', 'admin')),
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  guest_name        text,
  guest_email       text,
  guest_phone       text,
  guest_address     text,
  guests            integer CHECK (guests IS NULL OR guests > 0),
  total_price_cents integer CHECK (total_price_cents IS NULL OR total_price_cents >= 0),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  decided_at        timestamptz,
  CHECK (check_out > check_in),
  -- Garantie anti double réservation au niveau de la base : deux lignes confirmées
  -- (séjour ou blocage) du même appartement ne peuvent pas se chevaucher.
  CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
    apartment_slug WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE INDEX reservations_apartment_dates_idx ON reservations (apartment_slug, check_in, check_out);
CREATE INDEX reservations_status_idx ON reservations (status);

-- Prix à la nuit. Sans ligne pour un jour, le prix par défaut de l'appartement s'applique.
CREATE TABLE daily_prices (
  apartment_slug text NOT NULL REFERENCES apartment_settings (slug),
  day            date NOT NULL,
  price_cents    integer NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (apartment_slug, day)
);

-- Calendriers externes (Airbnb, Booking.com…) importés au format iCal.
CREATE TABLE ical_feeds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_slug text NOT NULL REFERENCES apartment_settings (slug),
  name           text NOT NULL,
  url            text NOT NULL,
  last_synced_at timestamptz,
  last_ok_at     timestamptz,
  last_error     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id        uuid NOT NULL REFERENCES ical_feeds (id) ON DELETE CASCADE,
  apartment_slug text NOT NULL REFERENCES apartment_settings (slug),
  uid            text NOT NULL,
  start_day      date NOT NULL,
  end_day        date NOT NULL,
  summary        text,
  UNIQUE (feed_id, uid),
  CHECK (end_day > start_day)
);

CREATE INDEX external_events_apartment_dates_idx ON external_events (apartment_slug, start_day, end_day);

-- Accès au tableau de bord.
CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Seule l'empreinte SHA-256 du jeton de session est stockée.
CREATE TABLE admin_sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE TABLE rate_limits (
  key      text PRIMARY KEY,
  count    integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  user_email text,
  action     text NOT NULL,
  detail     jsonb
);
