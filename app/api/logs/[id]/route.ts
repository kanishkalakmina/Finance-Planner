import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { StockLog, Product } from "@/types/database";

const QTY_UP   = ["restock", "rental_return"];
const QTY_DOWN = ["sale", "rental_out", "stock_return"];

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data: log } = await supabase.from("stock_logs").select("*").eq("id", id).eq("user_id", user.id).single() as { data: StockLog | null };
  const logTyped = log;
  if (!logTyped) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reverse qty change on products
  if (logTyped.product_id && logTyped.qty) {
    const { data: p } = await supabase.from("products").select("quantity").eq("id", logTyped.product_id).single() as { data: Pick<Product, "quantity"> | null };
    const pTyped = p;
    if (pTyped) {
      const delta = QTY_UP.includes(logTyped.type) ? -(logTyped.qty as number) : QTY_DOWN.includes(logTyped.type) ? (logTyped.qty as number) : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (delta !== 0) await (supabase.from("products") as any).update({ quantity: Math.max(0, pTyped.quantity + delta) }).eq("id", logTyped.product_id);
    }
  }

  const { error } = await supabase.from("stock_logs").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
