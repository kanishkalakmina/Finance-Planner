import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Profile, SavingsTransaction, WalletTransfer } from "@/types/database";

type SavingsTransactionWithPool = SavingsTransaction & { pool?: string | null };
type WalletTransferWithPool = WalletTransfer & { direction: string; from_pool?: string | null };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileRes, txRes, transferRes] = await Promise.all([
    supabase.from("profiles").select("initial_savings").eq("id", user.id).single(),
    supabase.from("savings_transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("wallet_transfers").select("*").eq("user_id", user.id).order("date", { ascending: false }),
  ]);

  const initialSavings = Number((profileRes.data as Pick<Profile, "initial_savings"> | null)?.initial_savings ?? 0);
  const transactions = (txRes.data as SavingsTransactionWithPool[] | null) ?? [];
  const transfers = (transferRes.data as WalletTransferWithPool[] | null) ?? [];

  // ── Separate pool balances ──
  // Savings pool: initial_savings + non-salary deposits (pool='savings') - savings withdrawals - business transfers
  // Salary pool: salary deposits (pool='salary') - salary spending withdrawals
  // Wallet transfers (business funding) always affect savings pool
  let savingsBalance = initialSavings;
  let salaryBalance = 0;

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const sortedTransfers = [...transfers].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    const pool = tx.pool ?? (tx.source === "salary" ? "salary" : "savings");
    const amt = Number(tx.amount);
    if (pool === "salary") {
      salaryBalance += tx.type === "deposit" ? amt : -amt;
    } else {
      savingsBalance += tx.type === "deposit" ? amt : -amt;
    }
  }
  for (const wt of sortedTransfers) {
    if (wt.direction === "personal_to_shop") {
      // Deduct from whichever pool was selected
      if ((wt.from_pool ?? "savings") === "salary") salaryBalance -= Number(wt.amount);
      else savingsBalance -= Number(wt.amount);
    } else {
      // Business → personal always goes to savings
      savingsBalance += Number(wt.amount);
    }
  }

  const totalBalance = savingsBalance + salaryBalance;

  // ── Build unified transaction history with per-pool running balances ──
  const allSorted = [
    ...sorted.map(tx => ({ ...tx, entry_type: "transaction" as const })),
    ...sortedTransfers.map(wt => ({ ...wt, entry_type: "transfer" as const })),
  ].sort((a, b) => (a.date as string).localeCompare(b.date as string));

  let runningSavings = initialSavings;
  let runningSalary = 0;

  const withBalance = allSorted.map(ev => {
    if (ev.entry_type === "transaction") {
      const tx = ev as (typeof sorted)[0] & { entry_type: "transaction" };
      const pool = tx.pool ?? (tx.source === "salary" ? "salary" : "savings");
      const amt = Number(tx.amount);
      if (pool === "salary") {
        runningSalary += tx.type === "deposit" ? amt : -amt;
      } else {
        runningSavings += tx.type === "deposit" ? amt : -amt;
      }
      return { ...ev, balance_after: runningSavings + runningSalary, savings_after: runningSavings, salary_after: runningSalary };
    } else {
      const wt = ev as (typeof sortedTransfers)[0] & { entry_type: "transfer" };
      if (wt.direction === "personal_to_shop") {
        if ((wt.from_pool ?? "savings") === "salary") runningSalary -= Number(wt.amount);
        else runningSavings -= Number(wt.amount);
      } else {
        runningSavings += Number(wt.amount);
      }
      return { ...ev, balance_after: runningSavings + runningSalary, savings_after: runningSavings, salary_after: runningSalary };
    }
  });

  withBalance.reverse();

  return NextResponse.json({
    savings_balance: savingsBalance,
    salary_balance: salaryBalance,
    current_balance: totalBalance,
    initial_savings: initialSavings,
    transactions: withBalance,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { type, purpose, source, amount, date, note, pool } = body;

  if (!["withdrawal", "deposit"].includes(type))
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (type === "withdrawal" && !["personal", "other"].includes(purpose ?? "other"))
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  if (type === "deposit" && !["salary", "loan_payout", "other"].includes(source ?? "other"))
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  if (!amount || Number(amount) <= 0)
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  if (!date)
    return NextResponse.json({ error: "Date required" }, { status: 400 });

  // Auto-assign pool: salary deposits → salary, everything else → savings
  const assignedPool = pool ?? (type === "deposit" && source === "salary" ? "salary" : "savings");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("savings_transactions") as any)
    .insert({
      user_id: user.id,
      type,
      purpose: type === "withdrawal" ? (purpose ?? "other") : "other",
      source: type === "deposit" ? (source ?? "other") : null,
      amount: Number(amount),
      date,
      note: note?.trim() || null,
      pool: assignedPool,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as SavingsTransactionWithPool);
}
