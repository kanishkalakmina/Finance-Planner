import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { WalletTransfer } from "@/types/database";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("wallet_transfers")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data as WalletTransfer[] | null) ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { direction, amount, date, note, from_pool } = body;

  if (!["personal_to_shop", "shop_to_personal"].includes(direction))
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  // from_pool only matters for personal_to_shop; shop_to_personal always goes to savings
  const resolvedFromPool = direction === "personal_to_shop"
    ? (from_pool === "salary" ? "salary" : "savings")
    : "savings";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("wallet_transfers") as any)
    .insert({
      user_id: user.id,
      direction,
      amount: Number(amount),
      date,
      note: note?.trim() || null,
      from_pool: resolvedFromPool,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as WalletTransfer);
}
