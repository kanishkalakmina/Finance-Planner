import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = new URL(request.url).searchParams.get("all") === "1";

  let query = supabase
    .from("active_rentals")
    .select("*, products(name, category, rental_price)")
    .eq("user_id", user.id)
    .order("rent_date", { ascending: false });

  if (!all) query = query.eq("returned", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { product_id, quantity, customer_name, rental_fee, rent_date, expected_return_date } = await request.json();
  if (!product_id || !quantity || !rental_fee || !expected_return_date)
    return NextResponse.json({ error: "product_id, quantity, rental_fee, expected_return_date required" }, { status: 400 });

  const qty = Number(quantity);
  const entryDate = rent_date ?? new Date().toISOString().split("T")[0];

  const { data: product } = await supabase.from("products").select("quantity, name").eq("id", product_id).eq("user_id", user.id).single();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (product.quantity < qty) return NextResponse.json({ error: `Only ${product.quantity} available` }, { status: 400 });

  // Reduce stock
  await supabase.from("products").update({ quantity: product.quantity - qty }).eq("id", product_id);

  // Log rental_out (no money impact — fee collected on return)
  await supabase.from("stock_logs").insert({
    user_id: user.id, type: "rental_out", product_id, qty,
    unit_price: Number(rental_fee), amount: 0, date: entryDate,
    note: customer_name ? `Rented to ${customer_name}` : `Rented out: ${product.name}`,
  });

  const { data: rental, error } = await supabase
    .from("active_rentals")
    .insert({
      user_id: user.id, product_id, quantity: qty,
      customer_name: customer_name?.trim() || null,
      rental_fee: Number(rental_fee), rent_date: entryDate, expected_return_date,
    })
    .select("*, products(name, category, rental_price)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rental, { status: 201 });
}
