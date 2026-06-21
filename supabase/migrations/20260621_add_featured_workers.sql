-- Phase 6: Worker Monetization Foundation
-- Run this in Supabase SQL Editor BEFORE deploying Phase 6 code.
-- Safe to re-run (all statements use IF NOT EXISTS).

-- Add monetization columns to workers table
ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_pro      BOOLEAN NOT NULL DEFAULT FALSE;

-- Index: featured workers first, then by recency — used in homepage/category queries
CREATE INDEX IF NOT EXISTS idx_workers_featured_created
  ON workers (is_featured DESC, created_at DESC)
  WHERE is_verified = TRUE;

-- Document the columns
COMMENT ON COLUMN workers.is_featured IS 'Featured Worker plan — RD$199/month via Stripe';
COMMENT ON COLUMN workers.is_pro      IS 'Pro Profile plan — RD$299/month via Stripe';
