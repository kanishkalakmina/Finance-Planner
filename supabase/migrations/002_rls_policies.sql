-- ============================================================
-- Migration 002: Row Level Security + Indexes
-- All data is private to the authenticated owner only.
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_expenses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_income      ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_advice            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: owner-only access on all tables
-- ============================================================

-- profiles: user can only see/edit their own profile
CREATE POLICY "owner_only" ON profiles
  FOR ALL USING (auth.uid() = id);

-- loans
CREATE POLICY "owner_only" ON loans
  FOR ALL USING (auth.uid() = user_id);

-- savings_transactions
CREATE POLICY "owner_only" ON savings_transactions
  FOR ALL USING (auth.uid() = user_id);

-- personal_expenses
CREATE POLICY "owner_only" ON personal_expenses
  FOR ALL USING (auth.uid() = user_id);

-- setup_expenses
CREATE POLICY "owner_only" ON setup_expenses
  FOR ALL USING (auth.uid() = user_id);

-- business_income
CREATE POLICY "owner_only" ON business_income
  FOR ALL USING (auth.uid() = user_id);

-- business_expenses
CREATE POLICY "owner_only" ON business_expenses
  FOR ALL USING (auth.uid() = user_id);

-- personal_withdrawals
CREATE POLICY "owner_only" ON personal_withdrawals
  FOR ALL USING (auth.uid() = user_id);

-- products
CREATE POLICY "owner_only" ON products
  FOR ALL USING (auth.uid() = user_id);

-- stock_movements
CREATE POLICY "owner_only" ON stock_movements
  FOR ALL USING (auth.uid() = user_id);

-- ai_advice
CREATE POLICY "owner_only" ON ai_advice
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Fast monthly queries (most common: filter by user + date month)
CREATE INDEX idx_personal_expenses_user_date
  ON personal_expenses(user_id, date DESC);

CREATE INDEX idx_setup_expenses_user_date
  ON setup_expenses(user_id, date DESC);

CREATE INDEX idx_business_income_user_date
  ON business_income(user_id, date DESC);

CREATE INDEX idx_business_expenses_user_date
  ON business_expenses(user_id, date DESC);

CREATE INDEX idx_personal_withdrawals_user_date
  ON personal_withdrawals(user_id, date DESC);

CREATE INDEX idx_savings_transactions_user_date
  ON savings_transactions(user_id, date DESC);

-- Stock queries
CREATE INDEX idx_stock_movements_product
  ON stock_movements(product_id, date DESC);

CREATE INDEX idx_stock_movements_user_type
  ON stock_movements(user_id, movement_type);

-- Active rentals (items currently out on rent)
CREATE INDEX idx_active_rentals
  ON stock_movements(user_id, rental_due_date)
  WHERE movement_type = 'rental_out' AND rental_returned_at IS NULL;

-- Products by user
CREATE INDEX idx_products_user_active
  ON products(user_id, is_active);

-- AI advice by type and month
CREATE INDEX idx_ai_advice_user_type_month
  ON ai_advice(user_id, advice_type, month DESC);

-- Loans active lookup
CREATE INDEX idx_loans_user_active
  ON loans(user_id, is_active);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When a new user signs up via Supabase Auth, automatically
-- create their profile row so the app can query it immediately.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
