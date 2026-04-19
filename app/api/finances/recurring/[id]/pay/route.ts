import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { amount, payment_date, note } = body;

  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!payment_date) return NextResponse.json({ error: "Date required" }, { status: 400 });

  // Verify ownership and get wallet type
  const { data: rp } = await supabase
    .from("recurring_payments")
    .select("id, name, wallet")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!rp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // For personal wallet recurring payments, deduct from salary balance
  let savings_tx_id: string | null = null;
  if (rp.wallet === "personal") {
    const { data: tx, error: txErr } = await supabase
      .from("savings_transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        purpose: "other",
        pool: "salary",
        amount: Number(amount),
        date: payment_date,
        note: note?.trim() || `Recurring: ${rp.name}`,
      })
      .select("id")
      .single();
    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
    savings_tx_id = tx.id;
  }

  const { data, error } = await supabase
    .from("recurring_payment_logs")
    .insert({
      payment_id: id,
      user_id: user.id,
      amount: Number(amount),
      payment_date,
      note: note?.trim() || null,
      savings_tx_id,
    })
    .select()
    .single();

  if (error) {
    // Rollback salary deduction if log insert failed
    if (savings_tx_id) {
      await supabase.from("savings_transactions").delete().eq("id", savings_tx_id);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const logId = searchParams.get("log_id");
  if (!logId) return NextResponse.json({ error: "log_id required" }, { status: 400 });

  // Get the log to find linked savings transaction
  const { data: log } = await supabase
    .from("recurring_payment_logs")
    .select("savings_tx_id")
    .eq("id", logId)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("recurring_payment_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete linked salary deduction
  if (log?.savings_tx_id) {
    await supabase.from("savings_transactions").delete().eq("id", log.savings_tx_id);
  }

  return NextResponse.json({ success: true });
}
