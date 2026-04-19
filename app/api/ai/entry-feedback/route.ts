import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface FeedbackBody {
  entry_type: string;
  entry_amount: number;
  entry_label: string;
  entry_note?: string;
  entry_date?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: FeedbackBody = await request.json().catch(() => ({}));
  const { entry_type, entry_amount, entry_label, entry_note } = body;

  if (!entry_type || entry_amount == null) {
    return NextResponse.json({ error: "entry_type and entry_amount required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(fallback("Gemini API not configured"), { status: 200 });
  }

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0];

  // Fetch financial context in parallel
  const [profileRes, loanRes, personalExpRes, bizIncRes, bizExpRes, savingsRes, transfersRes] = await Promise.all([
    supabase.from("profiles").select("monthly_salary, initial_savings").eq("id", user.id).single(),
    supabase.from("loans").select("monthly_payment, months_remaining").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    supabase.from("personal_expenses").select("amount").eq("user_id", user.id).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("business_income").select("amount").eq("user_id", user.id),
    supabase.from("business_expenses").select("amount").eq("user_id", user.id),
    supabase.from("savings_transactions").select("type, amount, source").eq("user_id", user.id),
    supabase.from("wallet_transfers").select("direction, amount").eq("user_id", user.id),
  ]);

  const profile = profileRes.data;
  const loan = loanRes.data;
  const salary = Number(profile?.monthly_salary ?? 0);
  const loanPayment = Number(loan?.monthly_payment ?? 0);
  const loanMonthsLeft = Number(loan?.months_remaining ?? 0);

  const personalExpTotal = (personalExpRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // Business balance (all-time)
  const bizIncome = (bizIncRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const bizExpenses = (bizExpRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const transfers = transfersRes.data ?? [];
  const transfersIn = transfers.filter(t => t.direction === "personal_to_shop").reduce((s, t) => s + Number(t.amount), 0);
  const transfersOut = transfers.filter(t => t.direction === "shop_to_personal").reduce((s, t) => s + Number(t.amount), 0);
  const setupFunding = Number(profile?.initial_savings ?? 0);
  const bizBalance = transfersIn + setupFunding + bizIncome - bizExpenses - transfersOut;

  // Savings balance (all-time)
  const txns = savingsRes.data ?? [];
  let savingsBalance = Number(profile?.initial_savings ?? 0);
  for (const t of txns) {
    savingsBalance += t.type === "deposit" ? Number(t.amount) : -Number(t.amount);
  }
  for (const wt of transfers) {
    savingsBalance += wt.direction === "shop_to_personal" ? Number(wt.amount) : -Number(wt.amount);
  }

  const entryTypeLabel = formatEntryType(entry_type);

  const prompt = `You are a strict personal financial advisor for a Sri Lankan small business owner. Analyze this new financial entry and give honest, direct feedback.

FINANCIAL CONTEXT:
- Monthly salary: LKR ${salary.toLocaleString()}
- Loan payment: LKR ${loanPayment.toLocaleString()}/month (${loanMonthsLeft} months remaining)
- Personal expenses this month: LKR ${personalExpTotal.toLocaleString()}
- Personal disposable after loan: LKR ${(salary - loanPayment - personalExpTotal).toLocaleString()}
- Business cash balance: LKR ${bizBalance.toLocaleString()}
- Personal savings balance: LKR ${savingsBalance.toLocaleString()}

NEW ENTRY:
- Type: ${entryTypeLabel}
- Amount: LKR ${entry_amount.toLocaleString()}
- Category/Label: ${entry_label}
${entry_note ? `- Note: ${entry_note}` : ""}

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "status": "good" or "warning" or "critical",
  "message": "1-2 sentence honest assessment of this entry in context of their finances",
  "suggestion": "One specific, actionable suggestion in 1 sentence"
}

Rules for status:
- "good": entry is financially healthy and reasonable
- "warning": entry is concerning but manageable — they should be careful
- "critical": entry puts them at serious financial risk or is unsustainable

Be direct and specific. Use LKR amounts in your response when helpful.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 256 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json(fallback("AI service temporarily unavailable"), { status: 200 });
    }

    const geminiData: GeminiResponse = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(fallback("Could not parse AI response"), { status: 200 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const status = ["good", "warning", "critical"].includes(parsed.status) ? parsed.status : "warning";

    return NextResponse.json({
      status,
      message: String(parsed.message ?? "Entry recorded."),
      suggestion: String(parsed.suggestion ?? "Keep tracking your entries consistently."),
    });
  } catch {
    return NextResponse.json(fallback("AI analysis unavailable right now"), { status: 200 });
  }
}

function fallback(reason: string) {
  return {
    status: "good",
    message: `Entry saved successfully. ${reason}.`,
    suggestion: "Keep recording all transactions to get AI analysis when available.",
  };
}

function formatEntryType(type: string): string {
  const map: Record<string, string> = {
    business_income: "Business Income",
    business_expense: "Business Expense",
    personal_expense: "Personal Expense",
    setup_expense: "Shop Setup Expense",
    stock_movement: "Stock Movement (Restock)",
    transfer: "Business-to-Personal Transfer",
    savings_deposit: "Savings Deposit",
    savings_withdrawal: "Personal Withdrawal",
  };
  return map[type] ?? type;
}
