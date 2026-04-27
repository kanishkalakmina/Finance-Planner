import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MONEY_IN  = ["sale", "capital", "rental_return", "stock_return"];
const MONEY_OUT = ["restock", "expense", "withdrawal"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = await request.json().catch(() => ({}));
  const withdrawAmount = Number(amount);
  if (!withdrawAmount || withdrawAmount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const [profileRes, allLogsRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("stock_logs").select("type, amount, date").eq("user_id", user.id),
  ]);

  const capital = Number(profileRes.data?.initial_savings ?? 0);
  const allLogs = allLogsRes.data ?? [];

  const totalIn  = allLogs.filter(l => MONEY_IN.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const totalOut = allLogs.filter(l => MONEY_OUT.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const shopBalance = capital + totalIn - totalOut;

  // Last 3 months avg expenses
  const last3Months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const avgMonthlyExpenses = last3Months.reduce((sum, m) => {
    const mLogs = allLogs.filter(l => l.date?.startsWith(m) && MONEY_OUT.includes(l.type));
    return sum + mLogs.reduce((s, l) => s + Number(l.amount), 0);
  }, 0) / 3;

  // Server-side calculations — deterministic
  const balanceAfter   = shopBalance - withdrawAmount;
  const monthsLeft     = avgMonthlyExpenses > 0 ? balanceAfter / avgMonthlyExpenses : 99;
  const safeBuffer     = avgMonthlyExpenses * 3;
  const canAfford      = withdrawAmount <= shopBalance;

  // Verdict: purely math-based
  let verdict: "safe" | "risky" | "danger";
  if (!canAfford || balanceAfter < 0) {
    verdict = "danger";
  } else if (balanceAfter >= safeBuffer) {
    verdict = "safe";
  } else if (monthsLeft >= 1) {
    verdict = "risky";
  } else {
    verdict = "danger";
  }

  const apiKey = process.env.GROQ_API_KEY;

  // Always return structured data — AI only adds the explanation text
  const baseResponse = {
    verdict,
    withdraw_amount: withdrawAmount,
    balance_before: shopBalance,
    balance_after: balanceAfter,
    avg_monthly_expenses: Math.round(avgMonthlyExpenses),
    months_buffer_remaining: Math.max(0, parseFloat(monthsLeft.toFixed(1))),
    safe_buffer_needed: Math.round(safeBuffer),
  };

  if (!apiKey) {
    return NextResponse.json({
      ...baseResponse,
      explanation: verdictExplanation(verdict, withdrawAmount, balanceAfter, monthsLeft, avgMonthlyExpenses),
      consequences: defaultConsequences(verdict),
      return_advice: defaultReturnAdvice(verdict, avgMonthlyExpenses),
    });
  }

  const prompt = `You are a financial advisor for a small shop in Sri Lanka. The owner wants to withdraw LKR ${withdrawAmount.toLocaleString()} from their business.

FACTS (do not change these numbers):
- Current shop balance: LKR ${shopBalance.toLocaleString()}
- Balance after withdrawal: LKR ${balanceAfter.toLocaleString()}
- Average monthly expenses: LKR ${Math.round(avgMonthlyExpenses).toLocaleString()}
- Months of expenses covered after withdrawal: ${monthsLeft.toFixed(1)} months
- Minimum safe buffer (3 months): LKR ${Math.round(safeBuffer).toLocaleString()}
- Verdict: ${verdict.toUpperCase()}

Write a short, honest, direct response in JSON:
{
  "explanation": "2-3 sentences explaining whether this withdrawal is safe using the exact numbers above",
  "consequences": "1-2 sentences on what could go wrong or what benefit this gives",
  "return_advice": "Specific advice on when and why to return this money to the business. For example: if verdict is safe say when it would still be smart to return some. If risky or danger, say exactly when they must return it (e.g. if monthly income drops below LKR X, or within N months). Give a concrete trigger and timeline."
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      return NextResponse.json({ ...baseResponse, ...parsed });
    }
  } catch { /* fall through */ }

  return NextResponse.json({
    ...baseResponse,
    explanation: verdictExplanation(verdict, withdrawAmount, balanceAfter, monthsLeft, avgMonthlyExpenses),
    consequences: defaultConsequences(verdict),
    return_advice: defaultReturnAdvice(verdict, avgMonthlyExpenses),
  });
}

// also add return_advice at the first fallback (no apiKey path)

function defaultReturnAdvice(verdict: string, avg: number) {
  const fmtN = (n: number) => n.toLocaleString("en-LK", { maximumFractionDigits: 0 });
  if (verdict === "danger") return `Return this money to the business immediately. Your buffer is too low to sustain normal operations.`;
  if (verdict === "risky")  return `Return this money within 2 months, or sooner if your monthly income drops below LKR ${fmtN(avg)}. Keep monitoring your balance weekly.`;
  return `You can keep this withdrawal, but consider returning it if your balance drops below LKR ${fmtN(avg * 3)} or if you need to restock heavily.`;
}

function verdictExplanation(verdict: string, amount: number, after: number, months: number, avg: number) {
  const fmtN = (n: number) => n.toLocaleString("en-LK", { maximumFractionDigits: 0 });
  if (verdict === "danger") {
    return after < 0
      ? `You cannot withdraw LKR ${fmtN(amount)} — your balance is only LKR ${fmtN(after + amount)}.`
      : `After withdrawing LKR ${fmtN(amount)}, only LKR ${fmtN(after)} remains — less than ${months.toFixed(1)} months of expenses (LKR ${fmtN(avg)}/mo). This is too risky.`;
  }
  if (verdict === "risky") {
    return `After withdrawing LKR ${fmtN(amount)}, you'll have LKR ${fmtN(after)} left — covering only ${months.toFixed(1)} months of expenses. This is below the recommended 3-month buffer.`;
  }
  return `Withdrawing LKR ${fmtN(amount)} is safe. You'll still have LKR ${fmtN(after)} — covering ${months.toFixed(1)} months of expenses, well above the 3-month buffer.`;
}

function defaultConsequences(verdict: string) {
  if (verdict === "danger") return "This withdrawal could leave the business unable to cover upcoming expenses or restock inventory.";
  if (verdict === "risky") return "A sudden expense or slow sales month could put the business under financial pressure.";
  return "Your business remains financially healthy with sufficient buffer for expenses and restocking.";
}
