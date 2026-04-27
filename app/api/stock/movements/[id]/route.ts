import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch movement to reverse stock change
  const { data: movement } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single() as { data: { product_id: string; movement_type: string; quantity: number; business_income_id: string | null; business_expense_id: string | null } | null };

  if (!movement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse the quantity change
  const { data: product } = await supabase
    .from("products")
    .select("quantity")
    .eq("id", movement.product_id)
    .single() as { data: { quantity: number } | null };

  if (product) {
    const reversedQty = ["restock", "rental_return"].includes(movement.movement_type)
      ? product.quantity - movement.quantity
      : product.quantity + movement.quantity;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("products") as any).update({ quantity: Math.max(0, reversedQty) }).eq("id", movement.product_id);
  }

  // Remove linked business entries
  if (movement.business_income_id) {
    await supabase.from("business_income").delete().eq("id", movement.business_income_id);
  }
  if (movement.business_expense_id) {
    await supabase.from("business_expenses").delete().eq("id", movement.business_expense_id);
  }

  const { error } = await supabase.from("stock_movements").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
