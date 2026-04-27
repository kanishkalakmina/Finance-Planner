import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { BusinessIncome, BusinessExpense, WalletTransfer, SavingsTransaction } from "@/types/database";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [incomeRes, expensesRes, transfersRes, setupRes] = await Promise.all([
    supabase.from("business_income").select("amount, date").eq("user_id", user.id).order("date"),
    supabase.from("business_expenses").select("amount, date").eq("user_id", user.id).order("date"),
    supabase.from("wallet_transfers").select("amount, date, direction").eq("user_id", user.id).order("date"),
    supabase.from("savings_transactions").select("amount, date").eq("user_id", user.id).eq("purpose", "shop_setup").order("date"),
  ]);

  const income    = (incomeRes.data    ?? []) as Pick<BusinessIncome, "amount" | "date">[];
  const expenses  = (expensesRes.data  ?? []) as Pick<BusinessExpense, "amount" | "date">[];
  const transfers = (transfersRes.data ?? []) as Pick<WalletTransfer, "amount" | "date" | "direction">[];
  const setup     = (setupRes.data     ?? []) as Pick<SavingsTransaction, "amount" | "date">[];

  // Build per-month buckets for last 12 months
  const now = new Date();
  const months: { month: string; income: number; expenses: number; net: number; balance: number }[] = [];

  // All-time cumulative balance (needed to build running total)
  let cumulative = 0;

  // Collect all unique months from data
  const allMonths = new Set<string>();
  for (const r of [...income, ...expenses, ...transfers, ...setup]) {
    allMonths.add((r.date as string).slice(0, 7));
  }
  // Also add last 6 current months
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    allMonths.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const sorted = Array.from(allMonths).sort();

  for (const m of sorted) {
    const mStart = `${m}-01`;
    const [y, mo] = m.split("-").map(Number);
    const mEnd = new Date(y, mo, 0).toISOString().split("T")[0];

    const mIncome = income.filter(r => r.date >= mStart && r.date <= mEnd).reduce((s, r) => s + Number(r.amount), 0);
    const mExpenses = expenses.filter(r => r.date >= mStart && r.date <= mEnd).reduce((s, r) => s + Number(r.amount), 0);
    const mSetup = setup.filter(r => r.date >= mStart && r.date <= mEnd).reduce((s, r) => s + Number(r.amount), 0);
    const mIn = transfers.filter(t => t.date >= mStart && t.date <= mEnd && t.direction === "personal_to_shop").reduce((s, t) => s + Number(t.amount), 0);
    const mOut = transfers.filter(t => t.date >= mStart && t.date <= mEnd && t.direction === "shop_to_personal").reduce((s, t) => s + Number(t.amount), 0);

    const net = mSetup + mIn + mIncome - mExpenses - mOut;
    cumulative += net;

    months.push({ month: m, income: mIncome + mSetup + mIn, expenses: mExpenses + mOut, net, balance: cumulative });
  }

  // Return last 12 months for the chart
  const last12 = months.slice(-12);

  return NextResponse.json({
    current_balance: cumulative,
    history: last12,
  });
}
