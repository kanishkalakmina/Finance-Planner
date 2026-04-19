-- Migration 006: Add source field to savings deposits
ALTER TABLE savings_transactions
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'other'
  CHECK (source IN ('salary', 'loan_payout', 'business', 'other'));
