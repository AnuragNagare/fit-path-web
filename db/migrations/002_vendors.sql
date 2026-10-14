-- FitPath: gym owners (vendors). A gym registers through a single-use invite link, then keeps one
-- live profile plus at most one pending draft that the admin approves.
-- Statements are separated by a semicolon at the end of a line (see scripts/migrate.mjs).

CREATE TABLE vendor_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  label text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_clerk_id text,
  revoked_at timestamptz
);

CREATE TABLE vendor_gyms (
  id text PRIMARY KEY,
  owner_clerk_id text NOT NULL UNIQUE,
  owner_name text NOT NULL,
  owner_email text NOT NULL,
  invite_id uuid REFERENCES vendor_invites (id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'pending', 'live', 'suspended')),
  live jsonb,
  live_lat double precision,
  live_lon double precision,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_submitted_at timestamptz,
  review_note text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendor_gyms_search_idx ON vendor_gyms (status, live_lat, live_lon);

CREATE INDEX vendor_gyms_submitted_idx ON vendor_gyms (draft_submitted_at);

CREATE TABLE vendor_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id text NOT NULL REFERENCES vendor_gyms (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo', 'video')),
  url text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  alt text,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_add' CHECK (status IN ('approved', 'pending_add', 'pending_remove')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendor_media_gym_idx ON vendor_media (gym_id, status);
