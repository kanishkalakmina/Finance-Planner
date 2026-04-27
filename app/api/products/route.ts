import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Product } from "@/types/database";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("products").select("*").eq("user_id", user.id).eq("is_active", true).order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data as Product[] | null) ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, category, item_type, buy_price, sell_price, rental_price, quantity, low_stock_threshold } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("products") as any)
    .insert({
      user_id: user.id,
      name: name.trim(), category, item_type,
      buy_price: Number(buy_price ?? 0),
      sell_price: sell_price ? Number(sell_price) : null,
      rental_price: rental_price ? Number(rental_price) : null,
      quantity: Number(quantity ?? 0),
      low_stock_threshold: Number(low_stock_threshold ?? 5),
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dataTyped = data as Product;

  // Auto-deduct initial stock cost from shop balance
  const qty = Number(quantity ?? 0);
  const cost = Number(buy_price ?? 0);
  if (qty > 0 && cost > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("stock_logs") as any).insert({
      user_id: user.id,
      type: "restock",
      product_id: dataTyped.id,
      qty,
      unit_price: cost,
      amount: qty * cost,
      date: new Date().toISOString().split("T")[0],
      note: `Initial stock: ${dataTyped.name} ×${qty}`,
    });
  }

  return NextResponse.json(dataTyped, { status: 201 });
}
