import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const QTY_UP   = ["restock", "rental_return"];
const QTY_DOWN = ["sale", "rental_out", "stock_return"];

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: log } = await supabase.from("stock_logs").select("*").eq("id", id).eq("user_id", user.id).single();
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse qty change on products
  if (log.product_id && log.qty) {
    const { data: p } = await supabase.from("products").select("quantity").eq("id", log.product_id).single();
    if (p) {
      const delta = QTY_UP.includes(log.type) ? -log.qty : QTY_DOWN.includes(log.type) ? log.qty : 0;
      if (delta !== 0) await supabase.from("products").update({ quantity: Math.max(0, p.quantity + delta) }).eq("id", log.product_id);
    }
  }

  const { error } = await supabase.from("stock_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
