import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: loan } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!loan) return NextResponse.json(null);

  // Count payments made against this loan
  const { count: paymentCount } = await supabase
    .from("loan_payments")
    .select("id", { count: "exact", head: true })
    .eq("loan_id", loan.id);

  const originalMonths = loan.original_months ?? loan.months_remaining;
  const monthsRemaining = Math.max(0, originalMonths - (paymentCount ?? 0));

  return NextResponse.json({
    ...loan,
    original_months: originalMonths,
    months_remaining: monthsRemaining,
    payments_made: paymentCount ?? 0,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = body.name?.trim() || null;
  const original_months = Number(body.original_months ?? body.months_remaining);
  const monthly_payment = Number(body.monthly_payment);

  if (isNaN(original_months) || original_months <= 0)
    return NextResponse.json({ error: "Invalid months" }, { status: 400 });
  if (isNaN(monthly_payment) || monthly_payment <= 0)
    return NextResponse.json({ error: "Invalid monthly payment" }, { status: 400 });

  // Deactivate existing loans
  await supabase.from("loans").update({ is_active: false }).eq("user_id", user.id);

  const { data, error } = await supabase
    .from("loans")
    .insert({
      user_id: user.id,
      name,
      monthly_payment,
      months_remaining: original_months,
      original_months,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, months_remaining: original_months, payments_made: 0 });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("loans").update({ is_active: false }).eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
