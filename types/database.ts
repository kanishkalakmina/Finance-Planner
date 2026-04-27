export type AppMode = "pre_business" | "business_live";
export type SavingsType = "withdrawal" | "deposit";
export type SavingsPurpose = "personal" | "shop_setup" | "other";
export type ItemType = "for_sale" | "for_rent" | "buy_and_rent";
export type MovementType = "restock" | "sale" | "rental_out" | "rental_return" | "damage_loss";
export type AiAdviceType = "monthly_summary" | "entry_feedback" | "business_suggestion" | "loan_analysis" | "fd_advice" | "stock_advice" | "chat";
export type RiskLevel = "low" | "medium" | "high";

export type PersonalExpenseCategory =
  | "food" | "transport" | "utilities" | "medical" | "personal" | "other";

export type SetupExpenseCategory =
  | "renovation" | "furniture" | "stock" | "rental_items"
  | "signage" | "equipment" | "deposit" | "other";

export type BusinessIncomeCategory =
  | "saree_sales" | "shoe_sales" | "bag_sales" | "rental_income" | "other";

export type BusinessExpenseCategory =
  | "supplier_sarees" | "supplier_shoes" | "supplier_bags"
  | "rent" | "utilities" | "staff" | "maintenance" | "packaging" | "other";

export type ProductCategory = "saree" | "shoe" | "bag" | "rental_item";

export interface Profile {
  id: string;
  monthly_salary: number | null;
  app_mode: AppMode;
  initial_savings: number | null;
  next_salary_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  name: string | null;
  monthly_payment: number;
  months_remaining: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavingsTransaction {
  id: string;
  user_id: string;
  type: SavingsType;
  purpose: SavingsPurpose;
  source: string | null;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface PersonalExpense {
  id: string;
  user_id: string;
  category: PersonalExpenseCategory;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface SetupExpense {
  id: string;
  user_id: string;
  category: SetupExpenseCategory;
  amount: number;
  date: string;
  note: string | null;
  linked_withdrawal_id: string | null;
  created_at: string;
}

export interface BusinessIncome {
  id: string;
  user_id: string;
  category: BusinessIncomeCategory;
  amount: number;
  date: string;
  note: string | null;
  source_movement_id: string | null;
  created_at: string;
}

export interface BusinessExpense {
  id: string;
  user_id: string;
  category: BusinessExpenseCategory;
  amount: number;
  date: string;
  note: string | null;
  source_movement_id: string | null;
  created_at: string;
}

export interface PersonalWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  date: string;
  reason: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  category: ProductCategory;
  item_type: ItemType;
  buy_price: number;
  sell_price: number | null;
  rental_price: number | null;
  quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  user_id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  amount: number;
  date: string;
  note: string | null;
  rental_customer_name: string | null;
  rental_due_date: string | null;
  rental_returned_at: string | null;
  linked_income_id: string | null;
  linked_expense_id: string | null;
  created_at: string;
}

export interface AiAdvice {
  id: string;
  user_id: string;
  advice_type: AiAdviceType;
  month: string | null;
  content: Record<string, unknown>;
  created_at: string;
}

// Computed types for UI
export interface MonthlyPersonalSummary {
  salary: number;
  loan_payment: number;
  total_expenses: number;
  net_balance: number;
  safe_to_spend: number;
  savings_balance: number;
}

export interface BusinessPnL {
  total_income: number;
  total_expenses: number;
  total_withdrawals: number;
  net_profit: number;
  income_by_category: Record<BusinessIncomeCategory, number>;
  expenses_by_category: Record<BusinessExpenseCategory, number>;
}

export interface StockRoi {
  product_id: string;
  product_name: string;
  purchase_price: number;
  rental_price: number;
  times_rented: number;
  total_earned: number;
  net_return: number;
  break_even_count: number;
  status: "in_debt" | "break_even" | "profitable";
}

export interface AiFeedback {
  status: "good" | "warning" | "critical";
  message: string;
  suggestion: string;
}

export interface RecurringPayment {
  id: string;
  user_id: string;
  name: string;
  typical_amount: number;
  is_unlimited: boolean;
  total_months: number | null;
  category: string;
  wallet: string;
  is_active: boolean;
  created_at: string;
}

export interface FixedDeposit {
  id: string;
  user_id: string;
  bank_name: string;
  amount: number;
  interest_rate: number;
  tenure_months: number;
  start_date: string;
  maturity_date: string;
  status: "active" | "matured" | "withdrawn";
  note: string | null;
  created_at: string;
}

export interface LoanPayment {
  id: string;
  user_id: string;
  loan_id: string;
  amount: number;
  date: string;
  savings_tx_id: string | null;
  created_at: string;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  frequency: string;
  next_due_date: string;
  is_active: boolean;
  created_at: string;
}

export interface RecurringPaymentLog {
  id: string;
  user_id: string;
  recurring_id: string;
  amount: number;
  paid_date: string;
  savings_tx_id: string | null;
  created_at: string;
}

export interface StockLog {
  id: string;
  user_id: string;
  product_id: string | null;
  type: string;
  amount: number;
  qty: number | null;
  unit_price: number | null;
  date: string;
  note: string | null;
  created_at: string;
}

export interface ActiveRental {
  id: string;
  user_id: string;
  product_id: string;
  rental_fee: number;
  fee_collected: number | null;
  returned: boolean;
  rent_date: string;
  actual_return_date: string | null;
  expected_return_date: string | null;
  customer_name: string | null;
  quantity: number;
  created_at: string;
}

export interface WalletTransfer {
  id: string;
  user_id: string;
  direction: string;
  amount: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Rental {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  rental_amount: number;
  is_returned: boolean;
  movement_out_id: string | null;
  created_at: string;
}

// Supabase Database type map
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      loans: { Row: Loan; Insert: Partial<Loan>; Update: Partial<Loan> };
      savings_transactions: { Row: SavingsTransaction; Insert: Partial<SavingsTransaction>; Update: Partial<SavingsTransaction> };
      personal_expenses: { Row: PersonalExpense; Insert: Partial<PersonalExpense>; Update: Partial<PersonalExpense> };
      setup_expenses: { Row: SetupExpense; Insert: Partial<SetupExpense>; Update: Partial<SetupExpense> };
      business_income: { Row: BusinessIncome; Insert: Partial<BusinessIncome>; Update: Partial<BusinessIncome> };
      business_expenses: { Row: BusinessExpense; Insert: Partial<BusinessExpense>; Update: Partial<BusinessExpense> };
      personal_withdrawals: { Row: PersonalWithdrawal; Insert: Partial<PersonalWithdrawal>; Update: Partial<PersonalWithdrawal> };
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product> };
      stock_movements: { Row: StockMovement; Insert: Partial<StockMovement>; Update: Partial<StockMovement> };
      ai_advice: { Row: AiAdvice; Insert: Partial<AiAdvice>; Update: Partial<AiAdvice> };
      stock_logs: { Row: StockLog; Insert: Partial<StockLog>; Update: Partial<StockLog> };
      active_rentals: { Row: ActiveRental; Insert: Partial<ActiveRental>; Update: Partial<ActiveRental> };
      wallet_transfers: { Row: WalletTransfer; Insert: Partial<WalletTransfer>; Update: Partial<WalletTransfer> };
      rentals: { Row: Rental; Insert: Partial<Rental>; Update: Partial<Rental> };
      fixed_deposits: { Row: FixedDeposit; Insert: Partial<FixedDeposit>; Update: Partial<FixedDeposit> };
      recurring_payments: { Row: RecurringPayment; Insert: Partial<RecurringPayment>; Update: Partial<RecurringPayment> };
      loan_payments: { Row: LoanPayment; Insert: Partial<LoanPayment>; Update: Partial<LoanPayment> };
      recurring_expenses: { Row: RecurringExpense; Insert: Partial<RecurringExpense>; Update: Partial<RecurringExpense> };
      recurring_payment_logs: { Row: RecurringPaymentLog; Insert: Partial<RecurringPaymentLog>; Update: Partial<RecurringPaymentLog> };
    };
  };
}
