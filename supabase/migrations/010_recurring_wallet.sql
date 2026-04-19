-- Migration 010: Add wallet column to recurring_payments (personal vs shop)
ALTER TABLE recurring_payments
  ADD COLUMN IF NOT EXISTS wallet text NOT NULL DEFAULT 'personal'
  CHECK (wallet IN ('personal', 'shop'));
