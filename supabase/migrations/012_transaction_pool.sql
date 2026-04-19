-- Migration 012: Separate salary pool from savings pool in savings_transactions

ALTER TABLE savings_transactions
  ADD COLUMN IF NOT EXISTS pool text NOT NULL DEFAULT 'salary'
  CHECK (pool IN ('salary', 'savings'));

-- Existing non-salary deposits → savings pool
UPDATE savings_transactions
  SET pool = 'savings'
  WHERE type = 'deposit' AND source IN ('loan_payout', 'other');

-- Existing shop_setup withdrawals → savings pool (capital investment)
UPDATE savings_transactions
  SET pool = 'savings'
  WHERE type = 'withdrawal' AND purpose = 'shop_setup';
