-- Migration 003: Fixed Deposits table

CREATE TABLE fixed_deposits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name     text NOT NULL,
  amount        numeric(12,2) NOT NULL CHECK (amount > 0),
  interest_rate numeric(5,2) NOT NULL CHECK (interest_rate > 0),
  tenure_months integer NOT NULL CHECK (tenure_months > 0),
  start_date    date NOT NULL,
  maturity_date date NOT NULL,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'matured', 'withdrawn')),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fixed_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_only" ON fixed_deposits
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_fd_user_status ON fixed_deposits(user_id, status);
