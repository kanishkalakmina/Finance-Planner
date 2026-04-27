import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Rental } from "@/types/database";

type StockMovementRow = {
  movement_type: string;
  quantity: number;
  total_amount: number | null;
};

type RentalRow = Rental & { rental_amount: number; is_returned: boolean };

type ProductRow = {
  id: string;
  name: string;
  quantity: number;
  buy_price: number;
  sell_price: number | null;
  rental_price: number | null;
  category: string;
  item_type: string;
  low_stock_threshold: number;
  is_active: boolean;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [productRes, rentalsRes, movementsRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).eq("user_id", user.id).single(),
    supabase.from("rentals").select("*").eq("product_id", id).eq("user_id", user.id),
    supabase.from("stock_movements").select("*").eq("product_id", id).eq("user_id", user.id),
  ]);

  const product = productRes.data as ProductRow | null;
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rentals = (rentalsRes.data as RentalRow[] | null) ?? [];
  const movements = (movementsRes.data as StockMovementRow[] | null) ?? [];

  // Total units purchased (restock movements)
  const totalPurchased = movements.filter(m => m.movement_type === "restock").reduce((s, m) => s + m.quantity, 0) + Number(product.quantity);
  const totalCostFromRestocks = movements.filter(m => m.movement_type === "restock").reduce((s, m) => s + Number(m.total_amount ?? 0), 0);
  const initialCost = Number(product.buy_price) * Number(product.quantity);
  const totalInvested = totalCostFromRestocks + initialCost;

  // Total income from rentals
  const completedRentals = rentals.filter(r => r.is_returned);
  const totalRentalIncome = completedRentals.reduce((s, r) => s + (r.rental_amount * r.quantity), 0);
  const totalRentalCount = completedRentals.reduce((s, r) => s + r.quantity, 0);

  // Net return
  const netReturn = totalRentalIncome - totalInvested;
  const breakEvenRentals = product.rental_price && product.rental_price > 0
    ? Math.ceil(totalInvested / Number(product.rental_price))
    : null;

  let status: "in_debt" | "break_even" | "profitable";
  if (netReturn < 0) status = "in_debt";
  else if (netReturn === 0) status = "break_even";
  else status = "profitable";

  const activeRentals = rentals.filter(r => !r.is_returned);

  return NextResponse.json({
    product,
    total_invested: totalInvested,
    total_rental_income: totalRentalIncome,
    total_rental_count: totalRentalCount,
    net_return: netReturn,
    break_even_rentals: breakEvenRentals,
    completed_rentals: completedRentals.length,
    active_rentals: activeRentals.length,
    status,
  });
}
