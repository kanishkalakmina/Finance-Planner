-- Migration 005: Loan payments log (for variable monthly payments like Sittu)

-- Store original term so months_remaining = original_months - payments_made
ALTER TABLE loans ADD COLUMN IF NOT EXISTS original_months integer;

-- Set original_months from current months_remaining for existing active loans
UPDATE loans SET original_months = months_remaining WHERE original_months IS NULL;

CREATE TABLE IF NOT EXISTS loan_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id      uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON loan_payments FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user ON loan_payments(user_id);
