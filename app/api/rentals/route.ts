import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ActiveRental, Product } from "@/types/database";

type ActiveRentalWithProduct = ActiveRental & { products: { name: string; category: string; rental_price: number | null } | null };

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
  return NextResponse.json((data as ActiveRentalWithProduct[] | null) ?? []);
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

  const { data: product } = await supabase.from("products").select("quantity, name").eq("id", product_id).eq("user_id", user.id).single() as { data: Pick<Product, "quantity" | "name"> | null };
  const productTyped = product;
  if (!productTyped) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (productTyped.quantity < qty) return NextResponse.json({ error: `Only ${productTyped.quantity} available` }, { status: 400 });

  // Reduce stock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("products") as any).update({ quantity: productTyped.quantity - qty }).eq("id", product_id);

  // Log rental_out (no money impact — fee collected on return)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("stock_logs") as any).insert({
    user_id: user.id, type: "rental_out", product_id, qty,
    unit_price: Number(rental_fee), amount: 0, date: entryDate,
    note: customer_name ? `Rented to ${customer_name}` : `Rented out: ${productTyped.name}`,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rental, error } = await (supabase.from("active_rentals") as any)
    .insert({
      user_id: user.id, product_id, quantity: qty,
      customer_name: customer_name?.trim() || null,
      rental_fee: Number(rental_fee), rent_date: entryDate, expected_return_date,
    })
    .select("*, products(name, category, rental_price)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rental as ActiveRentalWithProduct, { status: 201 });
}
