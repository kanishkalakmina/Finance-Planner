-- Products table
CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  category      text NOT NULL CHECK (category IN ('saree', 'shoe', 'bag', 'rental', 'other')),
  item_type     text NOT NULL CHECK (item_type IN ('sale', 'rent', 'sale_and_rent')),
  purchase_price numeric(12,2) NOT NULL DEFAULT 0,
  selling_price  numeric(12,2),
  rental_price   numeric(12,2),
  quantity       integer NOT NULL DEFAULT 0,
  low_stock_threshold integer NOT NULL DEFAULT 5,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_owner" ON products FOR ALL USING (auth.uid() = user_id);

-- Stock movements table
CREATE TABLE IF NOT EXISTS stock_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('restock', 'sale', 'rental_out', 'rental_return', 'damage', 'adjustment')),
  quantity     integer NOT NULL,
  unit_amount  numeric(12,2),
  total_amount numeric(12,2),
  date         date NOT NULL DEFAULT CURRENT_DATE,
  note         text,
  -- Links to auto-created business entries
  business_income_id  uuid REFERENCES business_income(id) ON DELETE SET NULL,
  business_expense_id uuid REFERENCES business_expenses(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_owner" ON stock_movements FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user ON stock_movements(user_id);
