import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { RecurringPaymentLog } from "@/types/database";

type RecurringPayment = {
  id: string; name: string; typical_amount: number; is_unlimited: boolean;
  total_months: number | null; category: string; wallet: string;
  is_active: boolean; created_at: string;
};

const VALID_CATEGORIES = ["utilities", "transport", "personal", "financial", "other"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet") ?? "personal";

  const { data: payments } = await supabase
    .from("recurring_payments")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("wallet", wallet)
    .order("created_at", { ascending: true }) as { data: RecurringPayment[] | null };

  if (!payments?.length) return NextResponse.json([]);

  const { data: logs } = await supabase
    .from("recurring_payment_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false }) as { data: (RecurringPaymentLog & { payment_id: string })[] | null };

  const logsMap: Record<string, typeof logs> = {};
  for (const log of logs ?? []) {
    if (!logsMap[log.payment_id]) logsMap[log.payment_id] = [];
    logsMap[log.payment_id]!.push(log);
  }

  const result = payments.map(p => {
    const pLogs = logsMap[p.id] ?? [];
    const payments_made = pLogs.length;
    const total_paid = pLogs.reduce((s: number, l: { amount: number }) => s + Number(l.amount), 0);
    const months_remaining = p.is_unlimited ? null : Math.max(0, (p.total_months ?? 0) - payments_made);
    const last_payment = pLogs[0] ?? null;
    return { ...p, payments_made, total_paid, months_remaining, last_payment, recent_logs: pLogs.slice(0, 6) };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, typical_amount, is_unlimited, total_months, category, wallet } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!typical_amount || Number(typical_amount) <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category ?? "other")) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!is_unlimited && (!total_months || Number(total_months) <= 0))
    return NextResponse.json({ error: "Total months required for fixed-term" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("recurring_payments") as any)
    .insert({
      user_id: user.id,
      name: name.trim(),
      typical_amount: Number(typical_amount),
      is_unlimited: !!is_unlimited,
      total_months: is_unlimited ? null : Number(total_months),
      category: category ?? "other",
      wallet: wallet === "shop" ? "shop" : "personal",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, payments_made: 0, total_paid: 0, months_remaining: is_unlimited ? null : Number(total_months), recent_logs: [] });
}
