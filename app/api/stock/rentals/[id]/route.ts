import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/stock/rentals/[id]/return → mark rental as returned + create income
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const returnDate = body.return_date ?? new Date().toISOString().split("T")[0];
  const note = body.note ?? null;

  // Fetch the rental
  const { data: rental } = await supabase.from("rentals").select("*, products(*)").eq("id", id).eq("user_id", user.id).single();
  if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  if (rental.is_returned) return NextResponse.json({ error: "Already returned" }, { status: 400 });

  const product = rental.products as Record<string, unknown>;

  // Increase stock
  await supabase.from("products").update({ quantity: Number(product.quantity) + rental.quantity }).eq("id", rental.product_id);

  // Create business income
  const { data: income } = await supabase.from("business_income").insert({
    user_id: user.id, source: "rental",
    amount: rental.rental_amount * rental.quantity,
    date: returnDate,
    note: rental.customer_name ? `Rental return: ${product.name} — ${rental.customer_name}` : `Rental return: ${product.name}`,
  }).select("id").single();

  // Log stock movement (rental_return)
  const { data: movement } = await supabase.from("stock_movements").insert({
    user_id: user.id, product_id: rental.product_id, movement_type: "rental_return",
    quantity: rental.quantity, unit_amount: rental.rental_amount,
    total_amount: rental.rental_amount * rental.quantity,
    date: returnDate, note: note,
    business_income_id: income?.id ?? null,
  }).select("id").single();

  // Mark rental as returned
  const { data: updated, error } = await supabase.from("rentals")
    .update({
      is_returned: true, actual_return_date: returnDate,
      business_income_id: income?.id ?? null,
      movement_return_id: movement?.id ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: rental } = await supabase.from("rentals").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!rental) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rental.is_returned) return NextResponse.json({ error: "Cannot delete a returned rental" }, { status: 400 });

  // Restore stock
  const { data: product } = await supabase.from("products").select("quantity").eq("id", rental.product_id).single();
  if (product) await supabase.from("products").update({ quantity: product.quantity + rental.quantity }).eq("id", rental.product_id);

  // Delete linked movement
  if (rental.movement_out_id) await supabase.from("stock_movements").delete().eq("id", rental.movement_out_id);

  const { error } = await supabase.from("rentals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
