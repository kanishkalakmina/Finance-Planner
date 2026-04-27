import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { BusinessExpense } from "@/types/database";

const VALID_CATEGORIES = ["stock", "utilities", "transport", "wages", "rent", "marketing", "other"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let query = supabase
    .from("business_expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (month) {
    query = query
      .gte("date", `${month}-01`)
      .lte("date", `${month}-31`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data as BusinessExpense[] | null) ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { category, amount, date, note } = body;

  if (!VALID_CATEGORIES.includes(category ?? "other"))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("business_expenses") as any)
    .insert({ user_id: user.id, category: category ?? "other", amount: Number(amount), date, note: note?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as BusinessExpense);
}
