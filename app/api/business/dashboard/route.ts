import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile, BusinessIncome, BusinessExpense } from "@/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const [profileRes, allIncomeRes, allExpensesRes, monthIncomeRes, monthExpensesRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("business_income").select("amount").eq("user_id", user.id),
    supabase.from("business_expenses").select("amount").eq("user_id", user.id),
    supabase.from("business_income").select("*").eq("user_id", user.id)
      .gte("date", `${month}-01`).lte("date", `${month}-31`)
      .order("date", { ascending: false }),
    supabase.from("business_expenses").select("*").eq("user_id", user.id)
      .gte("date", `${month}-01`).lte("date", `${month}-31`)
      .order("date", { ascending: false }),
  ]);

  const startingCapital = Number((profileRes.data as Profile | null)?.initial_savings ?? 0);
  const totalInAll = (allIncomeRes.data as Pick<BusinessIncome, "amount">[] ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpAll = (allExpensesRes.data as Pick<BusinessExpense, "amount">[] ?? []).reduce((s, r) => s + Number(r.amount), 0);

  // Simple balance: starting capital + all income - all expenses
  const shop_balance = startingCapital + totalInAll - totalExpAll;

  const income = (monthIncomeRes.data as (BusinessIncome & { source: string })[] | null) ?? [];
  const expenses = (monthExpensesRes.data as BusinessExpense[] | null) ?? [];
  const total_income = income.reduce((s, r) => s + Number(r.amount), 0);
  const total_expenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const net_profit = total_income - total_expenses;
  const profit_margin = total_income > 0 ? (net_profit / total_income) * 100 : 0;

  const expenseCategoryMap: Record<string, number> = {};
  for (const e of expenses) {
    expenseCategoryMap[e.category] = (expenseCategoryMap[e.category] ?? 0) + Number(e.amount);
  }
  const incomeSourceMap: Record<string, number> = {};
  for (const r of income) {
    incomeSourceMap[r.source] = (incomeSourceMap[r.source] ?? 0) + Number(r.amount);
  }

  let risk: "low" | "medium" | "high" = "low";
  if (net_profit < 0) risk = "high";
  else if (profit_margin < 20) risk = "medium";

  return NextResponse.json({
    month,
    shop_balance,
    starting_capital: startingCapital,
    total_income,
    total_expenses,
    net_profit,
    profit_margin,
    expense_breakdown: expenseCategoryMap,
    income_breakdown: incomeSourceMap,
    recent_income: income.slice(0, 5),
    recent_expenses: expenses.slice(0, 5),
    income_count: income.length,
    expense_count: expenses.length,
    risk,
  });
}
