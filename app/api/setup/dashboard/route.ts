import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileRes, setupExpensesRes, savingsTxnsRes, expensesRes, loanRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings, monthly_salary").eq("id", user.id).single(),
    supabase.from("setup_expenses").select("*").eq("user_id", user.id).order("date", { ascending: true }),
    supabase.from("savings_transactions").select("type, amount, purpose").eq("user_id", user.id),
    supabase.from("personal_expenses").select("amount").eq("user_id", user.id),
    supabase.from("loans").select("monthly_payment").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);

  const setupExpenses = setupExpensesRes.data ?? [];
  const savingsTxns = savingsTxnsRes.data ?? [];
  const personalExpenses = expensesRes.data ?? [];

  // Total withdrawn from savings for shop setup purpose
  const totalSetupWithdrawals = savingsTxns
    .filter(t => t.type === "withdrawal" && t.purpose === "shop_setup")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Current savings balance
  let savingsBalance = Number(profileRes.data?.initial_savings ?? 0);
  for (const t of savingsTxns) {
    savingsBalance += t.type === "deposit" ? Number(t.amount) : -Number(t.amount);
  }

  // Total spent on setup
  const totalSetupSpent = setupExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // Buffer = setup withdrawals - setup spent
  const setupBuffer = totalSetupWithdrawals - totalSetupSpent;

  // Monthly obligation for risk calculation
  const monthlyExpenses = personalExpenses.length > 0
    ? personalExpenses.reduce((s, e) => s + Number(e.amount), 0) / 3
    : Number(profileRes.data?.monthly_salary ?? 0) * 0.3;
  const loanPayment = Number(loanRes.data?.monthly_payment ?? 0);
  const monthlyObligation = monthlyExpenses + loanPayment;

  // Risk level
  const personalSavingsMonths = monthlyObligation > 0 ? savingsBalance / monthlyObligation : 99;
  let risk: "low" | "medium" | "high";
  let riskExplanation: string;

  if (savingsBalance <= 0 || (totalSetupWithdrawals > 0 && totalSetupSpent >= totalSetupWithdrawals)) {
    risk = "high";
    riskExplanation = "Setup spending has reached or exceeded your withdrawals. Be very careful.";
  } else if (personalSavingsMonths <= 3) {
    risk = "high";
    riskExplanation = `Your savings cover only ${personalSavingsMonths.toFixed(1)} months of expenses.`;
  } else if (personalSavingsMonths <= 6 || (totalSetupWithdrawals > 0 && totalSetupSpent / totalSetupWithdrawals >= 0.9)) {
    risk = "medium";
    riskExplanation = `You have ${personalSavingsMonths.toFixed(1)} months of expenses in reserve. Monitor spending.`;
  } else {
    risk = "low";
    riskExplanation = `You have ${personalSavingsMonths.toFixed(1)} months of expenses in reserve. You're on track.`;
  }

  // Cumulative spending by date for chart
  let cumulative = 0;
  const cumulativeChart = setupExpenses.map(e => {
    cumulative += Number(e.amount);
    return { date: e.date, cumulative, amount: Number(e.amount), category: e.category };
  });

  // By category
  const categoryMap: Record<string, number> = {};
  for (const e of setupExpenses) {
    categoryMap[e.category] = (categoryMap[e.category] ?? 0) + Number(e.amount);
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const spendPercent = totalSetupWithdrawals > 0
    ? (totalSetupSpent / totalSetupWithdrawals) * 100
    : 0;

  return NextResponse.json({
    total_setup_withdrawals: totalSetupWithdrawals,
    total_setup_spent: totalSetupSpent,
    setup_buffer: setupBuffer,
    spend_percent: spendPercent,
    savings_balance: savingsBalance,
    risk,
    risk_explanation: riskExplanation,
    category_breakdown: categoryBreakdown,
    cumulative_chart: cumulativeChart,
    expense_count: setupExpenses.length,
  });
}
