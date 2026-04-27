import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { LoanPayment } from "@/types/database";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Get payment to find linked savings transaction
  const { data: payment } = await supabase
    .from("loan_payments")
    .select("savings_tx_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single() as { data: Pick<LoanPayment, "savings_tx_id"> | null };

  const { error } = await supabase
    .from("loan_payments")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Delete linked salary deduction
  if (payment?.savings_tx_id) {
    await supabase.from("savings_transactions").delete().eq("id", payment.savings_tx_id);
  }

  return NextResponse.json({ success: true });
}
