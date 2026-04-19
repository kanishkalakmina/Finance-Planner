import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Map product categories to business income/expense categories
const INCOME_SOURCE_MAP: Record<string, string> = {
  saree: "sales",
  shoe: "sales",
  bag: "sales",
  rental: "rental",
  other: "sales",
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("product_id");

  let query = supabase
    .from("stock_movements")
    .select("*, products(name, category)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { product_id, movement_type, quantity, unit_amount, date, note } = body;

  if (!product_id || !movement_type || !quantity) {
    return NextResponse.json({ error: "product_id, movement_type, and quantity are required" }, { status: 400 });
  }

  if (movement_type === "restock" && (!unit_amount || Number(unit_amount) <= 0)) {
    return NextResponse.json({ error: "Cost per unit is required for restock — it deducts from shop balance" }, { status: 400 });
  }

  // Fetch product details
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", product_id)
    .eq("user_id", user.id)
    .single();

  if (pErr || !product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const qty = Number(quantity);
  const unitAmt = unit_amount ? Number(unit_amount) : null;
  const totalAmt = unitAmt != null ? unitAmt * qty : null;
  const entryDate = date ?? new Date().toISOString().split("T")[0];

  let business_income_id: string | null = null;
  let business_expense_id: string | null = null;
  let newQuantity = product.quantity;

  // Auto-create business entries and update stock
  if (movement_type === "restock") {
    newQuantity = product.quantity + qty;
    // Create business expense (stock purchase)
    const { data: expEntry } = await supabase
      .from("business_expenses")
      .insert({
        user_id: user.id,
        category: "stock",
        amount: totalAmt!,
        date: entryDate,
        note: note ?? `Restock: ${product.name} ×${qty}`,
      })
      .select("id")
      .single();
    business_expense_id = expEntry?.id ?? null;

  } else if (movement_type === "sale") {
    newQuantity = product.quantity - qty;
    if (newQuantity < 0) return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    // Full revenue stays in shop wallet — owner manually withdraws profit via transfer
    const { data: incEntry } = await supabase
      .from("business_income")
      .insert({
        user_id: user.id,
        source: INCOME_SOURCE_MAP[product.category] ?? "sales",
        amount: totalAmt ?? 0,
        date: entryDate,
        note: note ?? `Sale: ${product.name} ×${qty}`,
      })
      .select("id")
      .single();
    business_income_id = incEntry?.id ?? null;

  } else if (movement_type === "rental_out") {
    newQuantity = product.quantity - qty;
    if (newQuantity < 0) return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });

  } else if (movement_type === "rental_return") {
    newQuantity = product.quantity + qty;
    if (totalAmt) {
      const { data: incEntry } = await supabase
        .from("business_income")
        .insert({
          user_id: user.id,
          source: "rental",
          amount: totalAmt,
          date: entryDate,
          note: note ?? `Rental income: ${product.name} ×${qty}`,
        })
        .select("id")
        .single();
      business_income_id = incEntry?.id ?? null;
    }

  } else if (movement_type === "damage") {
    newQuantity = product.quantity - qty;
    if (newQuantity < 0) newQuantity = 0;

  } else if (movement_type === "adjustment") {
    newQuantity = product.quantity + qty; // qty can be negative for downward adjustment
  }

  // Update product quantity
  await supabase.from("products").update({ quantity: newQuantity }).eq("id", product_id);

  // Log movement
  const { data: movement, error: mErr } = await supabase
    .from("stock_movements")
    .insert({
      user_id: user.id,
      product_id,
      movement_type,
      quantity: qty,
      unit_amount: unitAmt,
      total_amount: totalAmt,
      date: entryDate,
      note: note ?? null,
      business_income_id,
      business_expense_id,
    })
    .select("*, products(name, category)")
    .single();

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
  return NextResponse.json(movement, { status: 201 });
}
