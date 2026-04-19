import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const VALID_SOURCES = ["sales", "service", "rental", "capital", "other"];

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");   // YYYY-MM
  const source = searchParams.get("source"); // optional filter

  let query = supabase
    .from("business_income")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month) {
    query = query.gte("date", `${month}-01`).lte("date", `${month}-31`);
  }
  if (source) {
    query = query.eq("source", source);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { source, amount, date, note } = body;

  if (!VALID_SOURCES.includes(source ?? ""))
    return NextResponse.json({ error: `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}` }, { status: 400 });
  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  const { data, error } = await supabase
    .from("business_income")
    .insert({ user_id: user.id, source, amount: Number(amount), date, note: note?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
