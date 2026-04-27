import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Rental, Product } from "@/types/database";

type RentalWithProduct = Rental & {
  products: Record<string, unknown> | null;
  customer_name?: string | null;
  rent_date?: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  business_income_id?: string | null;
  movement_out_id?: string | null;
  movement_return_id?: string | null;
  is_returned: boolean;
  rental_amount: number;
};

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
  const { data: rental } = await supabase.from("rentals").select("*, products(*)").eq("id", id).eq("user_id", user.id).single() as { data: RentalWithProduct | null };
  const rentalTyped = rental;
  if (!rentalTyped) return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  if (rentalTyped.is_returned) return NextResponse.json({ error: "Already returned" }, { status: 400 });

  const product = rentalTyped.products as Record<string, unknown>;

  // Increase stock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("products") as any).update({ quantity: Number(product.quantity) + rentalTyped.quantity }).eq("id", rentalTyped.product_id);

  // Create business income
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: income } = await (supabase.from("business_income") as any).insert({
    user_id: user.id, source: "rental",
    amount: rentalTyped.rental_amount * rentalTyped.quantity,
    date: returnDate,
    note: rentalTyped.customer_name ? `Rental return: ${product.name} — ${rentalTyped.customer_name}` : `Rental return: ${product.name}`,
  }).select("id").single();

  // Log stock movement (rental_return)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: movement } = await (supabase.from("stock_movements") as any).insert({
    user_id: user.id, product_id: rentalTyped.product_id, movement_type: "rental_return",
    quantity: rentalTyped.quantity, unit_amount: rentalTyped.rental_amount,
    total_amount: rentalTyped.rental_amount * rentalTyped.quantity,
    date: returnDate, note: note,
    business_income_id: income?.id ?? null,
  }).select("id").single();

  // Mark rental as returned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from("rentals") as any)
    .update({
      is_returned: true, actual_return_date: returnDate,
      business_income_id: income?.id ?? null,
      movement_return_id: movement?.id ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated as Rental);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: rental } = await supabase.from("rentals").select("*").eq("id", id).eq("user_id", user.id).single() as { data: RentalWithProduct | null };
  const rentalDel = rental;
  if (!rentalDel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (rentalDel.is_returned) return NextResponse.json({ error: "Cannot delete a returned rental" }, { status: 400 });

  // Restore stock
  const { data: product } = await supabase.from("products").select("quantity").eq("id", rentalDel.product_id).single() as { data: Pick<Product, "quantity"> | null };
  const productTyped = product;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (productTyped) await (supabase.from("products") as any).update({ quantity: productTyped.quantity + rentalDel.quantity }).eq("id", rentalDel.product_id);

  // Delete linked movement
  if (rentalDel.movement_out_id) await supabase.from("stock_movements").delete().eq("id", rentalDel.movement_out_id);

  const { error } = await supabase.from("rentals").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
