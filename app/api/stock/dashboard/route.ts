import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Rental } from "@/types/database";

type StockProduct = {
  id: string;
  name: string;
  category: string;
  item_type: string;
  buy_price: number;
  sell_price: number | null;
  rental_price: number | null;
  quantity: number;
  low_stock_threshold: number;
};

type StockMovementRow = {
  product_id: string | null;
  movement_type: string;
  quantity: number;
  total_amount: number | null;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [productsRes, rentalsRes, movementsRes] = await Promise.all([
    supabase.from("products").select("*").eq("user_id", user.id).eq("is_active", true).order("name"),
    supabase.from("rentals").select("product_id, quantity, rental_amount, is_returned").eq("user_id", user.id),
    supabase.from("stock_movements").select("product_id, movement_type, quantity, total_amount").eq("user_id", user.id),
  ]);

  const products = (productsRes.data as StockProduct[] | null) ?? [];
  const rentals = (rentalsRes.data as Pick<Rental, "product_id" | "quantity" | "rental_amount" | "is_returned">[] | null) ?? [];
  const movements = (movementsRes.data as StockMovementRow[] | null) ?? [];

  // Per-product computed stats
  const enriched = products.map(p => {
    const activeRentals = rentals.filter(r => r.product_id === p.id && !r.is_returned).reduce((s, r) => s + r.quantity, 0);
    const completedRentals = rentals.filter(r => r.product_id === p.id && r.is_returned);
    const totalRentalIncome = completedRentals.reduce((s, r) => s + r.rental_amount * r.quantity, 0);
    const totalInvested = movements
      .filter(m => m.product_id === p.id && m.movement_type === "restock")
      .reduce((s, m) => s + Number(m.total_amount ?? 0), 0) + Number(p.buy_price) * Number(p.quantity);

    const available = p.quantity;
    const isLowStock = p.item_type !== "for_rent" && available <= p.low_stock_threshold;
    const margin = p.sell_price ? ((Number(p.sell_price) - Number(p.buy_price)) / Number(p.sell_price)) * 100 : null;
    const stockValue = Number(p.buy_price) * available;
    const rentalROI = totalInvested > 0 ? (totalRentalIncome / totalInvested) * 100 : 0;

    return {
      ...p,
      active_rentals: activeRentals,
      available,
      total_rental_income: totalRentalIncome,
      total_invested: totalInvested,
      rental_roi: rentalROI,
      is_low_stock: isLowStock,
      margin,
      stock_value: stockValue,
    };
  });

  // Summary stats
  const totalStockValue = enriched.reduce((s, p) => s + p.stock_value, 0);
  const lowStockItems = enriched.filter(p => p.is_low_stock);
  const rentalItems = enriched.filter(p => p.item_type === "for_rent" || p.item_type === "buy_and_rent");
  const totalRentalInvested = rentalItems.reduce((s, p) => s + p.total_invested, 0);
  const totalRentalEarned = rentalItems.reduce((s, p) => s + p.total_rental_income, 0);
  const overallRentalROI = totalRentalInvested > 0 ? (totalRentalEarned / totalRentalInvested) * 100 : 0;

  // Category breakdown
  const categoryMap: Record<string, { count: number; value: number }> = {};
  for (const p of enriched) {
    categoryMap[p.category] = categoryMap[p.category] ?? { count: 0, value: 0 };
    categoryMap[p.category].count += 1;
    categoryMap[p.category].value += p.stock_value;
  }

  return NextResponse.json({
    products: enriched,
    summary: {
      total_products: products.length,
      total_stock_value: totalStockValue,
      low_stock_count: lowStockItems.length,
      low_stock_items: lowStockItems.map(p => ({ id: p.id, name: p.name, quantity: p.quantity, threshold: p.low_stock_threshold })),
      rental_summary: {
        total_rental_items: rentalItems.length,
        total_invested: totalRentalInvested,
        total_earned: totalRentalEarned,
        overall_roi: overallRentalROI,
        net_return: totalRentalEarned - totalRentalInvested,
      },
      category_breakdown: categoryMap,
    },
  });
}
