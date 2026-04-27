import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ActiveRental, Product } from "@/types/database";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { fee_collected, return_date } = await request.json();
  const returnDate = return_date ?? new Date().toISOString().split("T")[0];

  const { data: rental } = await supabase.from("active_rentals").select("*").eq("id", id).eq("user_id", user.id).single() as { data: ActiveRental | null };
  const rentalTyped = rental;
  if (!rentalTyped) return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  if (rentalTyped.returned) return NextResponse.json({ error: "Already returned" }, { status: 400 });

  const amount = Number(fee_collected ?? rentalTyped.rental_fee);

  // Log rental_return (money IN — adds to balance)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("stock_logs") as any).insert({
    user_id: user.id, type: "rental_return", product_id: rentalTyped.product_id,
    qty: rentalTyped.quantity, amount, date: returnDate,
    note: rentalTyped.customer_name ? `Returned by ${rentalTyped.customer_name}` : "Rental return",
  });

  // Restore stock
  const { data: p } = await supabase.from("products").select("quantity").eq("id", rentalTyped.product_id).single() as { data: Pick<Product, "quantity"> | null };
  const pTyped = p;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pTyped) await (supabase.from("products") as any).update({ quantity: pTyped.quantity + rentalTyped.quantity }).eq("id", rentalTyped.product_id);

  // Mark returned
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("active_rentals") as any)
    .update({ returned: true, actual_return_date: returnDate, fee_collected: amount })
    .eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as ActiveRental);
}
