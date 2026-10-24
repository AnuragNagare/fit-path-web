-- FitPath: Gym onboarding tiers (free self-serve vs. paid 15,000 INR on-site setup)
ALTER TABLE vendor_gyms ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid'));
ALTER TABLE vendor_gyms ADD COLUMN IF NOT EXISTS tier_requested_at timestamptz;
