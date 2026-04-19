-- Migration 009: Wallet transfers between personal and shop

CREATE TABLE wallet_transfers (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('personal_to_shop', 'shop_to_personal')),
  amount    numeric(12,2) NOT NULL CHECK (amount > 0),
  date      date NOT NULL,
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE wallet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON wallet_transfers FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_wt_user ON wallet_transfers(user_id);
