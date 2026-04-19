import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // optional YYYY-MM filter

  const incQ = supabase
    .from("business_income")
    .select("id, source, amount, date, note, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const expQ = supabase
    .from("business_expenses")
    .select("id, category, amount, date, note, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  const movQ = supabase
    .from("stock_movements")
    .select("id, movement_type, quantity, unit_amount, total_amount, date, note, created_at, business_income_id, business_expense_id, products(name, category)")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  let incomeQuery = incQ;
  let expenseQuery = expQ;
  let movementQuery = movQ;

  if (month) {
    incomeQuery = incomeQuery.gte("date", `${month}-01`).lte("date", `${month}-31`) as typeof incomeQuery;
    expenseQuery = expenseQuery.gte("date", `${month}-01`).lte("date", `${month}-31`) as typeof expenseQuery;
    movementQuery = movementQuery.gte("date", `${month}-01`).lte("date", `${month}-31`) as typeof movementQuery;
  }

  const [incRes, expRes, movRes] = await Promise.all([incomeQuery, expenseQuery, movementQuery]);

  const incomeIds = new Set((incRes.data ?? []).map(r => r.id));
  const expenseIds = new Set((expRes.data ?? []).map(r => r.id));

  const income = (incRes.data ?? []).map(r => ({
    id: r.id,
    tx_type: "income" as const,
    label: r.source,
    amount: Number(r.amount),
    date: r.date,
    note: r.note,
    created_at: r.created_at,
  }));

  const expenses = (expRes.data ?? []).map(r => ({
    id: r.id,
    tx_type: "expense" as const,
    label: r.category,
    amount: Number(r.amount),
    date: r.date,
    note: r.note,
    created_at: r.created_at,
  }));

  // Only include movements that are NOT already represented in business_income/expenses
  // (i.e., damage, adjustment, rental_out — the ones without linked business entries)
  const unlinkedMovements = (movRes.data ?? [])
    .filter(m => {
      if (m.business_income_id && incomeIds.has(m.business_income_id)) return false;
      if (m.business_expense_id && expenseIds.has(m.business_expense_id)) return false;
      return true;
    })
    .map(m => ({
      id: m.id,
      tx_type: "movement" as const,
      label: m.movement_type,
      product_name: (m.products as { name: string } | null)?.name ?? null,
      quantity: m.quantity,
      unit_amount: m.unit_amount ? Number(m.unit_amount) : null,
      amount: m.total_amount ? Number(m.total_amount) : 0,
      date: m.date,
      note: m.note,
      created_at: m.created_at,
    }));

  // Merge and sort by date desc, then created_at desc
  const all = [...income, ...expenses, ...unlinkedMovements].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });

  const totalIn = income.reduce((s, r) => s + r.amount, 0);
  const totalOut = expenses.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({
    transactions: all,
    summary: {
      total_in: totalIn,
      total_out: totalOut,
      net: totalIn - totalOut,
      count: all.length,
    },
  });
}
