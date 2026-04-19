-- Migration 007: Recurring payments (router, gym, sittu, etc.)

CREATE TABLE recurring_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            text NOT NULL,
  typical_amount  numeric(12,2) NOT NULL CHECK (typical_amount > 0),
  is_unlimited    boolean NOT NULL DEFAULT true,
  total_months    integer CHECK (total_months > 0),
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('utilities','transport','personal','financial','other')),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON recurring_payments FOR ALL USING (auth.uid() = user_id);

CREATE TABLE recurring_payment_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   uuid NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recurring_payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON recurring_payment_logs FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_rpl_payment ON recurring_payment_logs(payment_id);
CREATE INDEX idx_rpl_user ON recurring_payment_logs(user_id);
