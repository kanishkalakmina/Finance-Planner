import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function fallback(question: string) {
  return {
    advice: `Regarding "${question}" — keep tracking all transactions daily to build accurate data for better analysis.`,
    business_paths: ["Track sales data for 2-3 months to get product expansion suggestions."],
    key_action: "Record every sale and expense to unlock accurate AI advice.",
    mistake_to_avoid: "Don't withdraw without checking if your balance covers next month's expenses.",
    growth_priority: "Focus on consistent data recording before making major business decisions.",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { question } = body;
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;

  const now   = new Date();
  const month = now.toISOString().slice(0, 7);
  const MONEY_IN  = ["sale", "capital", "rental_return", "stock_return"];
  const MONEY_OUT = ["restock", "expense", "withdrawal"];

  // Fetch ALL business data at once
  const [profileRes, allLogsRes, productsRes, rentalsRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("stock_logs")
      .select("type, amount, date, note, qty, unit_price, product_id, products(name, category)")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase.from("products")
      .select("id, name, category, item_type, buy_price, sell_price, rental_price, quantity, low_stock_threshold, is_active")
      .eq("user_id", user.id),
    supabase.from("active_rentals")
      .select("rental_fee, fee_collected, returned, rent_date, actual_return_date, customer_name, quantity, products(name, category)")
      .eq("user_id", user.id),
  ]);

  const capital  = Number(profileRes.data?.initial_savings ?? 0);
  const allLogs  = allLogsRes.data ?? [];
  const products = productsRes.data ?? [];
  const rentals  = rentalsRes.data ?? [];

  // ── Balance ──────────────────────────────────────────────────────
  const totalIn  = allLogs.filter(l => MONEY_IN.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const totalOut = allLogs.filter(l => MONEY_OUT.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const shopBalance = capital + totalIn - totalOut;
  const stockValue  = products.filter(p => p.is_active).reduce((s, p) => s + Number(p.buy_price) * p.quantity, 0);

  // ── Last 6 months trend ──────────────────────────────────────────
  const monthlyStats: Record<string, { income: number; expenses: number; sales: number; units: number }> = {};
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyStats[key] = { income: 0, expenses: 0, sales: 0, units: 0 };
  }
  for (const l of allLogs) {
    const m = l.date?.slice(0, 7);
    if (!m || !monthlyStats[m]) continue;
    if (MONEY_IN.includes(l.type))  monthlyStats[m].income   += Number(l.amount);
    if (MONEY_OUT.includes(l.type)) monthlyStats[m].expenses += Number(l.amount);
    if (l.type === "sale") { monthlyStats[m].sales += Number(l.amount); monthlyStats[m].units += Number(l.qty ?? 0); }
  }

  // ── Product performance (all-time sales) ────────────────────────
  const productSales: Record<string, { name: string; category: string; units: number; revenue: number; profit: number }> = {};
  for (const l of allLogs.filter(l => l.type === "sale")) {
    const pid  = l.product_id as string;
    const prod = l.products as { name: string; category: string } | null;
    if (!pid) continue;
    if (!productSales[pid]) {
      const p = products.find(p => p.id === pid);
      productSales[pid] = { name: prod?.name ?? "Unknown", category: prod?.category ?? "other", units: 0, revenue: 0, profit: 0 };
      if (p) productSales[pid].profit = (Number(p.sell_price ?? 0) - Number(p.buy_price ?? 0));
    }
    productSales[pid].units   += Number(l.qty ?? 0);
    productSales[pid].revenue += Number(l.amount);
  }
  const topSellers = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const slowStock  = products.filter(p => p.is_active && p.item_type !== "rent" && !productSales[p.id] && p.quantity > 0);

  // ── Expense breakdown ────────────────────────────────────────────
  const expenseByNote: Record<string, number> = {};
  for (const l of allLogs.filter(l => l.type === "expense")) {
    const key = l.note ?? "General";
    expenseByNote[key] = (expenseByNote[key] ?? 0) + Number(l.amount);
  }

  // ── Rental stats ─────────────────────────────────────────────────
  const completedRentals = rentals.filter(r => r.returned);
  const activeRentals    = rentals.filter(r => !r.returned);
  const totalRentalIncome = completedRentals.reduce((s, r) => s + Number(r.fee_collected ?? r.rental_fee), 0);
  const avgRentalFee = completedRentals.length > 0 ? totalRentalIncome / completedRentals.length : 0;

  // ── Last 3 months avg expenses ───────────────────────────────────
  const last3Keys = Object.keys(monthlyStats).slice(1, 4);
  const avgMonthlyExpenses = last3Keys.length
    ? last3Keys.reduce((s, k) => s + monthlyStats[k].expenses, 0) / last3Keys.length
    : 0;

  // ── Low stock ────────────────────────────────────────────────────
  const lowStock = products.filter(p => p.is_active && p.item_type !== "rent" && p.quantity <= p.low_stock_threshold);

  // ── Category performance ─────────────────────────────────────────
  const categoryStats: Record<string, { revenue: number; units: number; profit: number }> = {};
  for (const [, ps] of Object.entries(productSales)) {
    const cat = ps.category;
    if (!categoryStats[cat]) categoryStats[cat] = { revenue: 0, units: 0, profit: 0 };
    categoryStats[cat].revenue += ps.revenue;
    categoryStats[cat].units   += ps.units;
    categoryStats[cat].profit  += ps.profit * ps.units;
  }

  // ── Profit margins per product ───────────────────────────────────
  const marginsData = products.filter(p => p.is_active && p.sell_price && p.buy_price).map(p => {
    const margin = ((Number(p.sell_price) - Number(p.buy_price)) / Number(p.buy_price) * 100).toFixed(0);
    return `${p.name}: buy LKR${p.buy_price} → sell LKR${p.sell_price} (${margin}% margin)`;
  });

  // ── Overdue rentals ──────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const overdueRentals = rentals.filter(r => !r.returned && r.expected_return_date < today);
  const overdueIncome  = overdueRentals.reduce((s, r) => s + Number(r.rental_fee), 0);

  // ── Total withdrawn ──────────────────────────────────────────────
  const totalWithdrawn = allLogs.filter(l => l.type === "withdrawal").reduce((s, l) => s + Number(l.amount), 0);

  if (!apiKey) return NextResponse.json(fallback(question));

  const prompt = `You are a sharp, experienced business advisor for a small retail and rental shop in Sri Lanka. You have FULL access to all business data below. Give specific, data-driven advice. Never be vague.

═══ FULL BUSINESS SNAPSHOT ═══

FINANCES:
- Starting Capital: LKR ${capital.toLocaleString()}
- Current Balance: LKR ${shopBalance.toLocaleString()}
- Stock Value: LKR ${stockValue.toLocaleString()}
- Total Assets: LKR ${(shopBalance + stockValue).toLocaleString()}
- Avg Monthly Expenses (last 3mo): LKR ${Math.round(avgMonthlyExpenses).toLocaleString()}

MONTHLY PERFORMANCE (last 6 months):
${Object.entries(monthlyStats).map(([m, s]) =>
  `  ${m}: Income LKR ${s.income.toLocaleString()} | Expenses LKR ${s.expenses.toLocaleString()} | Net LKR ${(s.income - s.expenses).toLocaleString()} | Sales LKR ${s.sales.toLocaleString()} (${s.units} units)`
).join("\n")}

TOP SELLING PRODUCTS (all-time):
${topSellers.map((p, i) => `  ${i + 1}. ${p.name} [${p.category}]: ${p.units} units sold, LKR ${p.revenue.toLocaleString()} revenue`).join("\n") || "  No sales recorded yet"}

SLOW/UNSOLD STOCK (in stock but never sold):
${slowStock.map(p => `  • ${p.name} [${p.category}]: ${p.quantity} units @ buy LKR ${p.buy_price}`).join("\n") || "  None"}

LOW STOCK ALERTS:
${lowStock.map(p => `  ⚠️ ${p.name}: only ${p.quantity} left (min ${p.low_stock_threshold})`).join("\n") || "  None"}

ALL PRODUCTS (${products.filter(p => p.is_active).length} active):
${products.filter(p => p.is_active).map(p =>
  `  • ${p.name} [${p.category}/${p.item_type}]: qty=${p.quantity}, buy=LKR${p.buy_price}, sell=LKR${p.sell_price ?? "N/A"}, rent=LKR${p.rental_price ?? "N/A"}`
).join("\n")}

CATEGORY PERFORMANCE (all-time sales):
${Object.entries(categoryStats).sort(([,a],[,b]) => b.revenue - a.revenue).map(([cat, s]) =>
  `  • ${cat}: LKR ${s.revenue.toLocaleString()} revenue, ${s.units} units sold`
).join("\n") || "  No category data yet"}

PROFIT MARGINS PER PRODUCT:
${marginsData.join("\n") || "  No margin data"}

RENTAL BUSINESS:
- Total completed rentals: ${completedRentals.length}
- Active rentals now: ${activeRentals.length}
- Overdue rentals: ${overdueRentals.length}${overdueRentals.length > 0 ? ` (LKR ${overdueIncome.toLocaleString()} uncollected)` : ""}
- Total rental income collected: LKR ${totalRentalIncome.toLocaleString()}
- Average rental fee: LKR ${Math.round(avgRentalFee).toLocaleString()}
${overdueRentals.length > 0 ? `- Overdue items: ${overdueRentals.map(r => `${(r.products as {name:string}|null)?.name ?? "item"} (due ${r.expected_return_date})`).join(", ")}` : ""}

EXPENSE BREAKDOWN (all-time by category):
${Object.entries(expenseByNote).sort(([,a],[,b]) => b-a).map(([k, v]) => `  • ${k}: LKR ${v.toLocaleString()}`).join("\n") || "  No expenses recorded"}

OWNER WITHDRAWALS (total taken out): LKR ${totalWithdrawn.toLocaleString()}

USER QUESTION: "${question}"

Respond ONLY with this JSON — no withdrawal advice (that is handled separately):
{
  "advice": "4-6 sentences of sharp, specific business analysis using exact LKR numbers and product names from the data above. Directly answer the question.",
  "business_paths": [
    "Specific opportunity 1 based on actual product mix and sales patterns",
    "Specific opportunity 2 based on rental data or slow stock",
    "Specific opportunity 3 with estimated LKR impact"
  ],
  "key_action": "One specific action with product name or LKR amount — do this week",
  "mistake_to_avoid": "One specific risk visible in the current data",
  "growth_priority": "One growth strategy tailored to this exact business"
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error("Groq error:", res.status, await res.text());
      return NextResponse.json(fallback(question));
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content ?? "";
    if (!raw) return NextResponse.json(fallback(question));

    const parsed = JSON.parse(raw);
    // Strip withdrawal field if AI accidentally includes it
    delete parsed.withdrawal;
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Advisor error:", err);
    return NextResponse.json(fallback(question));
  }
}
