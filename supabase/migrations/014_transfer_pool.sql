-- Migration 014: Track which personal pool funded a business transfer
ALTER TABLE wallet_transfers
  ADD COLUMN IF NOT EXISTS from_pool text NOT NULL DEFAULT 'savings'
  CHECK (from_pool IN ('salary', 'savings'));
