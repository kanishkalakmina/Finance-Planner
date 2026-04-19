import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("fixed_deposits")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { bank_name, amount, interest_rate, tenure_months, start_date, note } = body;

  if (!bank_name?.trim()) return NextResponse.json({ error: "Bank name required" }, { status: 400 });
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!interest_rate || Number(interest_rate) <= 0) return NextResponse.json({ error: "Invalid rate" }, { status: 400 });
  if (!tenure_months || Number(tenure_months) <= 0) return NextResponse.json({ error: "Invalid tenure" }, { status: 400 });
  if (!start_date) return NextResponse.json({ error: "Start date required" }, { status: 400 });

  // Calculate maturity date
  const start = new Date(start_date);
  start.setMonth(start.getMonth() + Number(tenure_months));
  const maturity_date = start.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("fixed_deposits")
    .insert({
      user_id: user.id,
      bank_name: bank_name.trim(),
      amount: Number(amount),
      interest_rate: Number(interest_rate),
      tenure_months: Number(tenure_months),
      start_date,
      maturity_date,
      note: note?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
