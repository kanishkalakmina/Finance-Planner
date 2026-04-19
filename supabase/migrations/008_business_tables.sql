-- Migration 008: Business income and expense tables

CREATE TABLE business_income (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source     text NOT NULL DEFAULT 'sales'
             CHECK (source IN ('sales','service','rental','capital','other')),
  amount     numeric(12,2) NOT NULL CHECK (amount > 0),
  date       date NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON business_income FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_bi_user_date ON business_income(user_id, date);

CREATE TABLE business_expenses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category   text NOT NULL DEFAULT 'other'
             CHECK (category IN ('stock','utilities','transport','wages','rent','marketing','other')),
  amount     numeric(12,2) NOT NULL CHECK (amount > 0),
  date       date NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON business_expenses FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_be_user_date ON business_expenses(user_id, date);
