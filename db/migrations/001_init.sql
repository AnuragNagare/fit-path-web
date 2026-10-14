-- FitPath: bookings, admin gym edits, gym images, reviews.
-- Statements are separated by a semicolon at the end of a line (see scripts/migrate.mjs).
-- Money is whole rupees (INR). Gym ids are OpenStreetMap ids such as node-123456.

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text NOT NULL,
  user_name text NOT NULL,
  user_email text NOT NULL,
  gym_id text NOT NULL,
  gym_name text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('day', 'week', 'month', 'quarter', 'half', 'year')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  people integer NOT NULL CHECK (people BETWEEN 1 AND 99),
  amount_inr integer NOT NULL CHECK (amount_inr >= 0),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'due' CHECK (payment_status IN ('due', 'paid', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_start_date_idx ON bookings (start_date);

CREATE INDEX bookings_gym_idx ON bookings (gym_id);

CREATE INDEX bookings_user_idx ON bookings (clerk_user_id);

CREATE TABLE gym_overrides (
  gym_id text PRIMARY KEY,
  name text,
  address text,
  phone text,
  website text,
  hours text,
  description text,
  features text[],
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE TABLE gym_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  data bytea NOT NULL,
  alt text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gym_images_gym_idx ON gym_images (gym_id, position);

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL,
  gym_name text NOT NULL,
  clerk_user_id text NOT NULL,
  user_name text NOT NULL,
  user_email text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text,
  hidden boolean NOT NULL DEFAULT false,
  edited_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gym_id, clerk_user_id)
);

CREATE INDEX reviews_gym_idx ON reviews (gym_id);
