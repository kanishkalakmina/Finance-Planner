import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: loan } = await supabase
    .from("loans")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!loan) return NextResponse.json([]);

  const { data } = await supabase
    .from("loan_payments")
    .select("*")
    .eq("loan_id", loan.id)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { amount, payment_date, note } = body;

  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!payment_date)
    return NextResponse.json({ error: "Payment date required" }, { status: 400 });

  const { data: loan } = await supabase
    .from("loans")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!loan) return NextResponse.json({ error: "No active loan" }, { status: 400 });

  // Deduct from salary balance
  const { data: tx, error: txErr } = await supabase
    .from("savings_transactions")
    .insert({
      user_id: user.id,
      type: "withdrawal",
      purpose: "other",
      pool: "salary",
      amount: Number(amount),
      date: payment_date,
      note: note?.trim() || `Loan payment: ${loan.name ?? "Loan"}`,
    })
    .select("id")
    .single();

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("loan_payments")
    .insert({
      loan_id: loan.id,
      user_id: user.id,
      amount: Number(amount),
      payment_date,
      note: note?.trim() || null,
      savings_tx_id: tx.id,
    })
    .select()
    .single();

  if (error) {
    // Rollback salary deduction
    await supabase.from("savings_transactions").delete().eq("id", tx.id);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
