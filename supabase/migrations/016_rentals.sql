-- Rental events table
CREATE TABLE IF NOT EXISTS rentals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity              integer NOT NULL DEFAULT 1,
  customer_name         text,
  rental_amount         numeric(12,2) NOT NULL,
  rent_date             date NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date  date NOT NULL,
  actual_return_date    date,
  is_returned           boolean NOT NULL DEFAULT false,
  -- Auto-created business income on return
  business_income_id    uuid REFERENCES business_income(id) ON DELETE SET NULL,
  -- Linked stock movements
  movement_out_id       uuid REFERENCES stock_movements(id) ON DELETE SET NULL,
  movement_return_id    uuid REFERENCES stock_movements(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rentals_owner" ON rentals FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rentals_user ON rentals(user_id);
CREATE INDEX IF NOT EXISTS idx_rentals_product ON rentals(product_id);
CREATE INDEX IF NOT EXISTS idx_rentals_active ON rentals(user_id, is_returned);
