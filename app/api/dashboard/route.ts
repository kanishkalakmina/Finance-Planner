import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MONEY_IN  = ["sale", "capital", "rental_return", "stock_return"];
const MONEY_OUT = ["restock", "expense", "withdrawal"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [yr, mo] = month.split("-").map(Number);

  const lastDay  = new Date(yr, mo, 0).toISOString().split("T")[0];
  const firstDay = `${month}-01`;

  // Start of 6-month window for trend
  const trendD     = new Date(yr, mo - 6, 1);
  const trendStart = trendD.toISOString().split("T")[0];

  const [profileRes, allLogsRes, trendLogsRes, productsRes, topSalesRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("stock_logs").select("type, amount, date").eq("user_id", user.id),
    supabase.from("stock_logs").select("type, amount, date").eq("user_id", user.id).gte("date", trendStart),
    supabase.from("products").select("id, name, quantity, low_stock_threshold, item_type, buy_price").eq("user_id", user.id).eq("is_active", true),
    // All-time sales logs with product info for top sellers
    supabase.from("stock_logs").select("product_id, qty, amount, products(name, category)").eq("user_id", user.id).eq("type", "sale"),
  ]);

  const initial   = Number(profileRes.data?.initial_savings ?? 0);
  const allLogs   = allLogsRes.data ?? [];
  const trendLogs = trendLogsRes.data ?? [];
  const products  = productsRes.data ?? [];
  const salesLogs = topSalesRes.data ?? [];

  // All-time balance
  const totalIn  = allLogs.filter(l => MONEY_IN.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const totalOut = allLogs.filter(l => MONEY_OUT.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const shop_balance = initial + totalIn - totalOut;

  // Total capital added (fund top-ups after initial)
  const total_capital_added = allLogs.filter(l => l.type === "capital").reduce((s, l) => s + Number(l.amount), 0);
  const total_capital_invested = initial + total_capital_added;

  // Selected month P&L
  const monthLogs  = allLogs.filter(l => l.date >= firstDay && l.date <= lastDay);
  const month_in   = monthLogs.filter(l => MONEY_IN.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const month_out  = monthLogs.filter(l => MONEY_OUT.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
  const net_profit = month_in - month_out;

  // Breakdown by type for selected month
  const breakdown: Record<string, number> = {};
  for (const l of monthLogs) breakdown[l.type] = (breakdown[l.type] ?? 0) + Number(l.amount);

  // 6-month trend
  const trend: { month: string; income: number; expenses: number; net: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(yr, mo - 1 - i, 1);
    const m     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mLast = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
    const mLogs = trendLogs.filter(l => l.date >= `${m}-01` && l.date <= mLast);
    const inc   = mLogs.filter(l => MONEY_IN.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
    const exp   = mLogs.filter(l => MONEY_OUT.includes(l.type)).reduce((s, l) => s + Number(l.amount), 0);
    trend.push({ month: m, income: inc, expenses: exp, net: inc - exp });
  }

  // Low stock
  const low_stock = products.filter(p => p.item_type !== "rent" && p.quantity <= p.low_stock_threshold);

  // Top selling items — aggregate by product_id
  const salesMap: Record<string, { name: string; category: string; units: number; revenue: number }> = {};
  for (const s of salesLogs) {
    if (!s.product_id) continue;
    const pid = s.product_id as string;
    const prod = s.products as { name: string; category: string } | null;
    if (!salesMap[pid]) salesMap[pid] = { name: prod?.name ?? "Unknown", category: prod?.category ?? "other", units: 0, revenue: 0 };
    salesMap[pid].units   += Number(s.qty ?? 0);
    salesMap[pid].revenue += Number(s.amount ?? 0);
  }
  const top_sellers = Object.values(salesMap)
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  // Recent logs for activity feed
  const recentRes = await supabase.from("stock_logs")
    .select("*, products(name)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  // Avg monthly expenses (last 3 months) for withdrawal calc
  const last3          = trend.slice(-3);
  const avgMonthlyExp  = last3.length > 0 ? last3.reduce((s, t) => s + t.expenses, 0) / last3.length : 0;
  const safe_withdrawal = Math.max(0, shop_balance - avgMonthlyExp * 3);

  return NextResponse.json({
    month, shop_balance,
    initial_savings: initial,
    total_capital_added,
    total_capital_invested,
    month_in, month_out, net_profit,
    breakdown, trend,
    recent_logs: recentRes.data ?? [],
    low_stock,
    top_sellers,
    avg_monthly_expenses: avgMonthlyExp,
    safe_withdrawal,
    total_stock_value: products.reduce((s, p) => s + Number(p.buy_price) * p.quantity, 0),
  });
}
