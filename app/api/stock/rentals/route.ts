import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Rental, Product } from "@/types/database";

type RentalWithProduct = Rental & { products: { name: string; category: string; rental_price: number | null } | null } & {
  customer_name?: string | null;
  rent_date?: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  business_income_id?: string | null;
  movement_return_id?: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "1";

  let query = supabase
    .from("rentals")
    .select("*, products(name, category, rental_price)")
    .eq("user_id", user.id)
    .order("rent_date", { ascending: false });

  if (!all) query = query.eq("is_returned", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as RentalWithProduct[] | null);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { product_id, quantity, customer_name, rental_amount, rent_date, expected_return_date } = body;

  if (!product_id || !quantity || !rental_amount || !expected_return_date) {
    return NextResponse.json({ error: "product_id, quantity, rental_amount, expected_return_date required" }, { status: 400 });
  }

  const qty = Number(quantity);
  const entryDate = rent_date ?? new Date().toISOString().split("T")[0];

  // Check stock availability
  const { data: product } = await supabase.from("products").select("*").eq("id", product_id).eq("user_id", user.id).single() as { data: Product | null };
  const productTyped = product;
  if (!productTyped) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  if (productTyped.quantity < qty) return NextResponse.json({ error: `Only ${productTyped.quantity} units available` }, { status: 400 });

  // Decrease stock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("products") as any).update({ quantity: productTyped.quantity - qty }).eq("id", product_id);

  // Log stock movement (rental_out)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: movement } = await (supabase.from("stock_movements") as any).insert({
    user_id: user.id, product_id, movement_type: "rental_out",
    quantity: qty, unit_amount: Number(rental_amount),
    total_amount: Number(rental_amount) * qty,
    date: entryDate, note: customer_name ? `Rented to ${customer_name}` : null,
  }).select("id").single();

  // Create rental record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rental, error } = await (supabase.from("rentals") as any).insert({
    user_id: user.id, product_id, quantity: qty,
    customer_name: customer_name?.trim() || null,
    rental_amount: Number(rental_amount),
    rent_date: entryDate,
    expected_return_date,
    movement_out_id: movement?.id ?? null,
  }).select("*, products(name, category, rental_price)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rental as RentalWithProduct, { status: 201 });
}
