import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile, Loan, PersonalExpense, SavingsTransaction, WalletTransfer } from "@/types/database";

type SavingsTransactionWithPool = SavingsTransaction & { pool?: string | null };
type WalletTransferWithPool = WalletTransfer & { direction: string; from_pool?: string | null };

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  const now = new Date();
  const month = monthParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, mo] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(year, mo, 0).toISOString().split("T")[0];

  const [profileRes, loanRes, expensesRes, txnsRes, transfersRes] = await Promise.all([
    supabase.from("profiles").select("monthly_salary, initial_savings, next_salary_date").eq("id", user.id).single(),
    supabase.from("loans").select("monthly_payment, months_remaining, name").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    supabase.from("personal_expenses").select("category, amount, date, note").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false }),
    supabase.from("savings_transactions").select("type, amount, date, source, purpose, note").eq("user_id", user.id).order("date", { ascending: true }),
    supabase.from("wallet_transfers").select("direction, amount, date").eq("user_id", user.id),
  ]);

  const profile = profileRes.data as Pick<Profile, "monthly_salary" | "initial_savings" | "next_salary_date"> | null;
  const loan = loanRes.data as Pick<Loan, "name" | "monthly_payment" | "months_remaining"> | null;
  const expenses = (expensesRes.data as Pick<PersonalExpense, "category" | "amount" | "date" | "note">[] | null) ?? [];
  const txns = (txnsRes.data as SavingsTransactionWithPool[] | null) ?? [];
  const transfers = (transfersRes.data as WalletTransferWithPool[] | null) ?? [];

  // Separate pool balances
  let savingsPoolBalance = Number(profile?.initial_savings ?? 0);
  let salaryPoolBalance = 0;
  for (const t of txns) {
    const pool = t.pool ?? (t.source === "salary" ? "salary" : "savings");
    const amt = Number(t.amount);
    if (pool === "salary") salaryPoolBalance += t.type === "deposit" ? amt : -amt;
    else savingsPoolBalance += t.type === "deposit" ? amt : -amt;
  }
  for (const wt of transfers) {
    if (wt.direction === "shop_to_personal") {
      savingsPoolBalance += Number(wt.amount);
    } else {
      if ((wt.from_pool ?? "savings") === "salary") salaryPoolBalance -= Number(wt.amount);
      else savingsPoolBalance -= Number(wt.amount);
    }
  }
  const savingsBalance = savingsPoolBalance + salaryPoolBalance;

  // Salary = last salary deposit this month (or profile monthly_salary if no tx)
  const salaryTxThisMonth = txns.filter(t => t.type === "deposit" && t.source === "salary" && t.date >= monthStart && t.date <= monthEnd);
  const salaryThisMonth = salaryTxThisMonth.reduce((s, t) => s + Number(t.amount), 0);
  const salary = salaryThisMonth || Number(profile?.monthly_salary ?? 0);

  const loanPayment = Number(loan?.monthly_payment ?? 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netBalance = salary - loanPayment - totalExpenses;
  const safeToSpend = Math.max(0, netBalance);

  // Expenses by category
  const categoryMap: Record<string, number> = {};
  for (const e of expenses) {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + Number(e.amount);
  }
  const categoryBreakdown = Object.entries(categoryMap).map(([category, amount]) => ({ category, amount }));

  // Risk level
  const monthlyObligation = loanPayment + (totalExpenses > 0 ? totalExpenses : salary * 0.3);
  const savingsMonths = monthlyObligation > 0 ? savingsBalance / monthlyObligation : 99;
  let risk: "low" | "medium" | "high";
  if (netBalance < 0 || savingsBalance <= 0) risk = "high";
  else if (savingsMonths <= 3 || netBalance < loanPayment) risk = "medium";
  else risk = "low";

  return NextResponse.json({
    month,
    salary,
    next_salary_date: profile?.next_salary_date ?? null,
    loan: loan ? { name: loan.name, monthly_payment: loanPayment, months_remaining: loan.months_remaining } : null,
    total_expenses: totalExpenses,
    net_balance: netBalance,
    safe_to_spend: safeToSpend,
    savings_balance: savingsBalance,
    salary_pool_balance: salaryPoolBalance,
    savings_pool_balance: savingsPoolBalance,
    category_breakdown: categoryBreakdown,
    recent_expenses: expenses.slice(0, 8),
    risk,
    is_setup: !!(profile?.initial_savings != null),
  });
}
