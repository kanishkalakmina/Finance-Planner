-- ============================================================
-- Migration 001: Initial Schema
-- My Financial Planner
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: profiles
-- One row per user. Stores salary, app mode, initial savings.
-- ============================================================
CREATE TABLE profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_salary   numeric(12,2),
  app_mode         text NOT NULL DEFAULT 'pre_business'
                   CHECK (app_mode IN ('pre_business', 'business_live')),
  initial_savings  numeric(12,2) DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: loans
-- Active loan details. User updates when terms change.
-- ============================================================
CREATE TABLE loans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_payment  numeric(12,2) NOT NULL CHECK (monthly_payment > 0),
  months_remaining integer NOT NULL CHECK (months_remaining >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: savings_transactions
-- Every savings withdrawal or deposit.
-- ============================================================
CREATE TABLE savings_transactions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type      text NOT NULL CHECK (type IN ('withdrawal', 'deposit')),
  purpose   text NOT NULL DEFAULT 'other'
            CHECK (purpose IN ('personal', 'shop_setup', 'other')),
  amount    numeric(12,2) NOT NULL CHECK (amount > 0),
  date      date NOT NULL,
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: personal_expenses
-- Monthly personal expense tracking.
-- ============================================================
CREATE TABLE personal_expenses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category  text NOT NULL
            CHECK (category IN ('food', 'transport', 'utilities', 'medical', 'personal', 'other')),
  amount    numeric(12,2) NOT NULL CHECK (amount > 0),
  date      date NOT NULL,
  note      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: setup_expenses
-- Shop setup investment costs.
-- ============================================================
CREATE TABLE setup_expenses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category             text NOT NULL
                       CHECK (category IN (
                         'renovation', 'furniture', 'stock', 'rental_items',
                         'signage', 'equipment', 'deposit', 'other'
                       )),
  amount               numeric(12,2) NOT NULL CHECK (amount > 0),
  date                 date NOT NULL,
  note                 text,
  linked_withdrawal_id uuid REFERENCES savings_transactions(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: business_income
-- All shop revenue entries.
-- ============================================================
CREATE TABLE business_income (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category           text NOT NULL
                     CHECK (category IN (
                       'saree_sales', 'shoe_sales', 'bag_sales', 'rental_income', 'other'
                     )),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0),
  date               date NOT NULL,
  note               text,
  source_movement_id uuid,  -- linked to stock_movements (set after that table is created)
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: business_expenses
-- All shop operating costs.
-- ============================================================
CREATE TABLE business_expenses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category           text NOT NULL
                     CHECK (category IN (
                       'supplier_sarees', 'supplier_shoes', 'supplier_bags',
                       'rent', 'utilities', 'staff', 'maintenance', 'packaging', 'other'
                     )),
  amount             numeric(12,2) NOT NULL CHECK (amount > 0),
  date               date NOT NULL,
  note               text,
  source_movement_id uuid,  -- linked to stock_movements
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: personal_withdrawals
-- Money taken from business for personal use.
-- ============================================================
CREATE TABLE personal_withdrawals (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount    numeric(12,2) NOT NULL CHECK (amount > 0),
  date      date NOT NULL,
  reason    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: products
-- Product catalog with type and pricing.
-- ============================================================
CREATE TABLE products (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  category             text NOT NULL
                       CHECK (category IN ('saree', 'shoe', 'bag', 'rental_item')),
  item_type            text NOT NULL
                       CHECK (item_type IN ('for_sale', 'for_rent', 'buy_and_rent')),
  purchase_price       numeric(12,2) NOT NULL CHECK (purchase_price > 0),
  selling_price        numeric(12,2) CHECK (selling_price > 0),
  rental_price         numeric(12,2) CHECK (rental_price > 0),
  quantity             integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold  integer NOT NULL DEFAULT 3 CHECK (low_stock_threshold >= 0),
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE: stock_movements
-- Every stock event (restock, sale, rental, return, loss).
-- ============================================================
CREATE TABLE stock_movements (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id           uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type        text NOT NULL
                       CHECK (movement_type IN (
                         'restock', 'sale', 'rental_out', 'rental_return', 'damage_loss'
                       )),
  quantity             integer NOT NULL CHECK (quantity > 0),
  amount               numeric(12,2) NOT NULL CHECK (amount >= 0),
  date                 date NOT NULL,
  note                 text,
  -- Rental-specific fields
  rental_customer_name text,
  rental_due_date      date,
  rental_returned_at   timestamptz,
  -- Auto-linked financial entries
  linked_income_id     uuid REFERENCES business_income(id) ON DELETE SET NULL,
  linked_expense_id    uuid REFERENCES business_expenses(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Add FK constraints for source_movement_id now that stock_movements exists
ALTER TABLE business_income
  ADD CONSTRAINT fk_income_movement
  FOREIGN KEY (source_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL;

ALTER TABLE business_expenses
  ADD CONSTRAINT fk_expense_movement
  FOREIGN KEY (source_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: ai_advice
-- Stores AI advice history per type and month.
-- ============================================================
CREATE TABLE ai_advice (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  advice_type text NOT NULL
              CHECK (advice_type IN (
                'monthly_summary', 'entry_feedback', 'business_suggestion',
                'loan_analysis', 'fd_advice', 'stock_advice', 'chat'
              )),
  month       text,   -- 'YYYY-MM' for monthly advice, NULL for on-demand
  content     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGER: auto-update updated_at on profiles and products
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
