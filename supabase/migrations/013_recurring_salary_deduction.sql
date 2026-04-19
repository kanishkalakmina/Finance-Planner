-- Migration 013: Link recurring payment logs and loan payments to salary deductions
ALTER TABLE recurring_payment_logs
  ADD COLUMN IF NOT EXISTS savings_tx_id uuid REFERENCES savings_transactions(id) ON DELETE SET NULL;

ALTER TABLE loan_payments
  ADD COLUMN IF NOT EXISTS savings_tx_id uuid REFERENCES savings_transactions(id) ON DELETE SET NULL;
