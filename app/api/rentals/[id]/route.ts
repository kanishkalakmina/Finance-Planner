import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { fee_collected, return_date } = await request.json();
  const returnDate = return_date ?? new Date().toISOString().split("T")[0];

  const { data: rental } = await supabase.from("active_rentals").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!rental) return NextResponse.json({ error: "Rental not found" }, { status: 404 });
  if (rental.returned) return NextResponse.json({ error: "Already returned" }, { status: 400 });

  const amount = Number(fee_collected ?? rental.rental_fee);

  // Log rental_return (money IN — adds to balance)
  await supabase.from("stock_logs").insert({
    user_id: user.id, type: "rental_return", product_id: rental.product_id,
    qty: rental.quantity, amount, date: returnDate,
    note: rental.customer_name ? `Returned by ${rental.customer_name}` : "Rental return",
  });

  // Restore stock
  const { data: p } = await supabase.from("products").select("quantity").eq("id", rental.product_id).single();
  if (p) await supabase.from("products").update({ quantity: p.quantity + rental.quantity }).eq("id", rental.product_id);

  // Mark returned
  const { data, error } = await supabase
    .from("active_rentals")
    .update({ returned: true, actual_return_date: returnDate, fee_collected: amount })
    .eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
