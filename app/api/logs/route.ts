import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const QTY_UP   = ["restock", "rental_return"];
const QTY_DOWN = ["sale", "rental_out", "stock_return"];
// stock_return: qty DOWN + balance UP (returning stock to supplier = refund)

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const type  = searchParams.get("type");

  let query = supabase
    .from("stock_logs")
    .select("*, products(name, category)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month) {
    const [yr, mo] = month.split("-").map(Number);
    const lastDay = new Date(yr, mo, 0).toISOString().split("T")[0];
    query = query.gte("date", `${month}-01`).lte("date", lastDay);
  }
  if (type)  query = query.eq("type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, product_id, qty, unit_price, amount, date, note } = body;

  const VALID = ["restock","sale","expense","capital","rental_out","rental_return","stock_return","withdrawal"];
  if (!VALID.includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (amount == null) return NextResponse.json({ error: "Amount required" }, { status: 400 });
  if (!date)          return NextResponse.json({ error: "Date required" }, { status: 400 });

  // Stock check for qty-reducing operations
  if (product_id && qty && QTY_DOWN.includes(type)) {
    const { data: p } = await supabase.from("products").select("quantity").eq("id", product_id).eq("user_id", user.id).single();
    if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    if (p.quantity < Number(qty)) return NextResponse.json({ error: `Only ${p.quantity} in stock` }, { status: 400 });
  }

  const { data: log, error } = await supabase
    .from("stock_logs")
    .insert({
      user_id: user.id, type,
      product_id: product_id ?? null,
      qty: qty ? Number(qty) : null,
      unit_price: unit_price ? Number(unit_price) : null,
      amount: Number(amount), date,
      note: note?.trim() || null,
    })
    .select("*, products(name, category)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-update product quantity
  if (product_id && qty) {
    const { data: p } = await supabase.from("products").select("quantity").eq("id", product_id).single();
    if (p) {
      const delta = QTY_UP.includes(type) ? Number(qty) : QTY_DOWN.includes(type) ? -Number(qty) : 0;
      if (delta !== 0) {
        await supabase.from("products").update({ quantity: Math.max(0, p.quantity + delta) }).eq("id", product_id);
      }
    }
  }

  return NextResponse.json(log, { status: 201 });
}
