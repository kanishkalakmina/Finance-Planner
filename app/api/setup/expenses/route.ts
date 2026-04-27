import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_CATEGORIES = [
  "renovation", "furniture", "stock", "rental_items",
  "signage", "equipment", "deposit", "other",
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("setup_expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { category, amount, date, note, linked_withdrawal_id } = body;

  if (!VALID_CATEGORIES.includes(category))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("setup_expenses") as any)
    .insert({
      user_id: user.id,
      category,
      amount: Number(amount),
      date,
      note: note?.trim() || null,
      linked_withdrawal_id: linked_withdrawal_id || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
