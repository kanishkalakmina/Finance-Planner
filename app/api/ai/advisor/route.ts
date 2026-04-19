import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function fallback(question: string) {
  return {
    advice: `Regarding "${question}" — focus on tracking your sales and expenses consistently to get clearer insights.`,
    key_action: "Record all transactions daily to build accurate business intelligence.",
    mistake_to_avoid: "Don't spend more on restock than your current shop balance allows.",
    growth_priority: "Focus on selling high-margin products and restocking fast-moving items first.",
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question } = await request.json().catch(() => ({}));
  if (!question) return NextResponse.json({ error: "question required" }, { status: 400 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json(fallback(question));

  const month = new Date().toISOString().slice(0, 7);

  const [profileRes, allLogsRes, monthLogsRes, productsRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("stock_logs").select("type, amount").eq("user_id", user.id),
    supabase.from("stock_logs").select("type, amount, note").eq("user_id", user.id)
      .gte("date", `${month}-01`).lte("date", `${month}-31`),
    supabase.from("products").select("name, category, item_type, buy_price, sell_price, rental_price, quantity, low_stock_threshold").eq("user_id", user.id).eq("is_active", true),
  ]);

  const capital   = Number(profileRes.data?.initial_savings ?? 0);
  const allLogs   = allLogsRes.data ?? [];
  const monthLogs = monthLogsRes.data ?? [];
  const products  = productsRes.data ?? [];

  const totalIn  = allLogs.filter(l => ["sale","capital","rental_return"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const totalOut = allLogs.filter(l => ["restock","expense"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const shopBalance = capital + totalIn - totalOut;

  const monthIn  = monthLogs.filter(l => ["sale","capital","rental_return"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const monthOut = monthLogs.filter(l => ["restock","expense"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const netProfit = monthIn - monthOut;
  const margin = monthIn > 0 ? ((netProfit / monthIn) * 100).toFixed(1) : "0";

  const breakdown: Record<string, number> = {};
  for (const l of monthLogs) breakdown[l.type] = (breakdown[l.type] ?? 0) + Number(l.amount);

  const lowStock = products.filter(p => p.item_type !== "rent" && p.quantity <= p.low_stock_threshold);

  const prompt = `You are a strict business financial advisor for a small retail/rental shop in Sri Lanka. Analyze the data and answer the question.

SHOP DATA (amounts in LKR):
- Starting Capital: ${capital.toFixed(2)}
- Current Shop Balance: ${shopBalance.toFixed(2)}
- This Month (${month}): In=${monthIn.toFixed(2)}, Out=${monthOut.toFixed(2)}, Net=${netProfit.toFixed(2)}, Margin=${margin}%
- Monthly breakdown: ${JSON.stringify(breakdown)}

Products (${products.length} total, ${lowStock.length} low stock):
${products.slice(0, 15).map(p => `- ${p.name}: qty=${p.quantity}, buy=LKR ${p.buy_price}, sell=LKR ${p.sell_price ?? "N/A"}${p.quantity <= p.low_stock_threshold ? " ⚠️LOW" : ""}`).join("\n")}

QUESTION: "${question}"

Respond ONLY with valid JSON (no markdown):
{
  "advice": "2-4 sentence analysis with specific numbers",
  "key_action": "One specific actionable step this week",
  "mistake_to_avoid": "One specific mistake to avoid now",
  "growth_priority": "One priority for growth and stability"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );
    const data: GeminiResponse = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return NextResponse.json(JSON.parse(cleaned));
  } catch {
    return NextResponse.json(fallback(question));
  }
}
