import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [year, mo] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(year, mo, 0).toISOString().split("T")[0];

  const [incomeRes, expensesRes, transfersRes] = await Promise.all([
    supabase.from("business_income").select("*")
      .eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd)
      .order("date", { ascending: false }),
    supabase.from("business_expenses").select("*")
      .eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd)
      .order("date", { ascending: false }),
    supabase.from("wallet_transfers").select("*")
      .eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
  ]);

  const income = incomeRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const transfers = transfersRes.data ?? [];

  const total_income = income.reduce((s, r) => s + Number(r.amount), 0);
  const total_expenses = expenses.reduce((s, r) => s + Number(r.amount), 0);
  const withdrawals = transfers
    .filter(t => t.direction === "shop_to_personal")
    .reduce((s, t) => s + Number(t.amount), 0);
  const funding_in = transfers
    .filter(t => t.direction === "personal_to_shop")
    .reduce((s, t) => s + Number(t.amount), 0);
  const net_profit = total_income - total_expenses;
  const profit_margin = total_income > 0 ? (net_profit / total_income) * 100 : 0;

  const income_breakdown: Record<string, number> = {};
  for (const r of income) {
    income_breakdown[r.source] = (income_breakdown[r.source] ?? 0) + Number(r.amount);
  }
  const expense_breakdown: Record<string, number> = {};
  for (const e of expenses) {
    expense_breakdown[e.category] = (expense_breakdown[e.category] ?? 0) + Number(e.amount);
  }

  return NextResponse.json({
    month,
    total_income,
    total_expenses,
    withdrawals,
    funding_in,
    net_profit,
    profit_margin,
    income_breakdown,
    expense_breakdown,
    income_count: income.length,
    expense_count: expenses.length,
  });
}
