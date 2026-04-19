import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const [profileRes, allLogsRes, monthLogsRes, productsRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("stock_logs").select("type, amount").eq("user_id", user.id),
    supabase.from("stock_logs").select("*, products(name)").eq("user_id", user.id)
      .gte("date", `${month}-01`).lte("date", `${month}-31`)
      .order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("products").select("id, name, quantity, low_stock_threshold, item_type").eq("user_id", user.id).eq("is_active", true),
  ]);

  const initial = Number(profileRes.data?.initial_savings ?? 0);
  const allLogs = allLogsRes.data ?? [];
  const monthLogs = monthLogsRes.data ?? [];
  const products = productsRes.data ?? [];

  const totalIn  = allLogs.filter(l => ["sale","capital","rental_return","stock_return"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const totalOut = allLogs.filter(l => ["restock","expense"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const shop_balance = initial + totalIn - totalOut;

  const monthIn  = monthLogs.filter(l => ["sale","capital","rental_return","stock_return"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const monthOut = monthLogs.filter(l => ["restock","expense"].includes(l.type)).reduce((s,l) => s + Number(l.amount), 0);
  const net_profit = monthIn - monthOut;

  const breakdown: Record<string, number> = {};
  for (const l of monthLogs) breakdown[l.type] = (breakdown[l.type] ?? 0) + Number(l.amount);

  const low_stock = products.filter(p => p.item_type !== "rent" && p.quantity <= p.low_stock_threshold);

  return NextResponse.json({
    month, shop_balance, initial_savings: initial,
    month_in: monthIn, month_out: monthOut, net_profit,
    breakdown, recent_logs: monthLogs.slice(0, 10), low_stock,
  });
}
