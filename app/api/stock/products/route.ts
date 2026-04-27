import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, category, item_type, buy_price, sell_price, rental_price, quantity, low_stock_threshold } = body;

  if (!name || !category || !item_type) {
    return NextResponse.json({ error: "name, category, and item_type are required" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("products") as any)
    .insert({
      user_id: user.id,
      name: name.trim(),
      category,
      item_type,
      buy_price: Number(buy_price ?? 0),
      sell_price: sell_price ? Number(sell_price) : null,
      rental_price: rental_price ? Number(rental_price) : null,
      quantity: Number(quantity ?? 0),
      low_stock_threshold: Number(low_stock_threshold ?? 5),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
