"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface IncomeEntry  { id: string; source: string; amount: number; date: string; note: string | null; }
interface ExpenseEntry { id: string; category: string; amount: number; date: string; note: string | null; }
interface Transfer     { id: string; direction: "personal_to_shop" | "shop_to_personal"; from_pool?: "salary" | "savings"; amount: number; date: string; note: string | null; }

type AnyEntry =
  | (IncomeEntry  & { kind: "income"   })
  | (ExpenseEntry & { kind: "expense"  })
  | (Transfer     & { kind: "transfer" });

function fmt(n: number) {
  return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INCOME_META: Record<string, { icon: string; label: string }> = {
  sales:   { icon: "🛒", label: "Sales"   },
  service: { icon: "🔧", label: "Service" },
  rental:  { icon: "🏠", label: "Rental"  },
  other:   { icon: "📎", label: "Other"   },
};

const EXPENSE_META: Record<string, { icon: string; label: string }> = {
  stock:     { icon: "📦", label: "Stock"     },
  utilities: { icon: "💡", label: "Utilities" },
  transport: { icon: "🚗", label: "Transport" },
  wages:     { icon: "👷", label: "Wages"     },
  rent:      { icon: "🏪", label: "Rent"      },
  marketing: { icon: "📢", label: "Marketing" },
  other:     { icon: "📎", label: "Other"     },
};

type FilterType = "all" | "income" | "expense" | "transfer";

export default function BusinessHistoryPage() {
  const [income, setIncome]   = useState<IncomeEntry[]>([]);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/business/income").then(r => r.json()),
      fetch("/api/business/expenses").then(r => r.json()),
      fetch("/api/wallet/transfers").then(r => r.json()),
    ]).then(([inc, exp, trn]) => {
      if (Array.isArray(inc)) setIncome(inc);
      if (Array.isArray(exp)) setExpenses(exp);
      if (Array.isArray(trn)) setTransfers(trn);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteIncome(id: string) {
    if (!confirm("Remove?")) return;
    await fetch(`/api/business/income/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteExpense(id: string) {
    if (!confirm("Remove?")) return;
    await fetch(`/api/business/expenses/${id}`, { method: "DELETE" });
    load();
  }

  async function deleteTransfer(id: string) {
    if (!confirm("Remove?")) return;
    await fetch(`/api/wallet/transfers/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;

  // Merge and sort all entries newest first
  const all: AnyEntry[] = [
    ...income.map(e   => ({ ...e, kind: "income"   as const })),
    ...expenses.map(e => ({ ...e, kind: "expense"  as const })),
    ...transfers.map(e => ({ ...e, kind: "transfer" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Month filter
  const monthFiltered = month ? all.filter(e => e.date.startsWith(month)) : all;

  // Type filter
  const filtered = monthFiltered.filter(e => filter === "all" || e.kind === filter);

  // Totals for filtered period
  const totalIncome   = filtered.filter(e => e.kind === "income").reduce((s, e)  => s + Number(e.amount), 0);
  const totalExpenses = filtered.filter(e => e.kind === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const netProfit     = totalIncome - totalExpenses;

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",      label: "All"          },
    { key: "income",   label: "✅ Income"    },
    { key: "expense",  label: "🔴 Expenses"  },
    { key: "transfer", label: "↔ Transfers"  },
  ];

  function renderEntry(entry: AnyEntry) {
    if (entry.kind === "income") {
      const meta = INCOME_META[entry.source] ?? INCOME_META.other;
      return (
        <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-base flex-shrink-0">{meta.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-green-600">+ LKR {fmt(entry.amount)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">{meta.label}</span>
            </div>
            <div className="flex gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{entry.date}</span>
              {entry.note && <span className="text-xs text-gray-500 truncate">· {entry.note}</span>}
            </div>
          </div>
          <button className="text-xs text-red-300 hover:text-red-500 flex-shrink-0" onClick={() => deleteIncome(entry.id)}>✕</button>
        </div>
      );
    }

    if (entry.kind === "expense") {
      const meta = EXPENSE_META[entry.category] ?? EXPENSE_META.other;
      return (
        <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-base flex-shrink-0">{meta.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-red-600">− LKR {fmt(entry.amount)}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">{meta.label}</span>
            </div>
            <div className="flex gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{entry.date}</span>
              {entry.note && <span className="text-xs text-gray-500 truncate">· {entry.note}</span>}
            </div>
          </div>
          <button className="text-xs text-red-300 hover:text-red-500 flex-shrink-0" onClick={() => deleteExpense(entry.id)}>✕</button>
        </div>
      );
    }

    // transfer
    const toShop = entry.direction === "personal_to_shop";
    const fromPool = entry.from_pool ?? "savings";
    return (
      <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-base flex-shrink-0">↔</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${toShop ? "text-blue-600" : "text-green-600"}`}>
              {toShop ? "−" : "+"} LKR {fmt(entry.amount)}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
              {toShop ? `${fromPool === "salary" ? "💼 Salary" : "🏦 Savings"} → Business` : "Business → 🏦 Savings"}
            </span>
          </div>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{entry.date}</span>
            {entry.note && <span className="text-xs text-gray-500 truncate">· {entry.note}</span>}
          </div>
        </div>
        <button className="text-xs text-red-300 hover:text-red-500 flex-shrink-0" onClick={() => deleteTransfer(entry.id)}>✕</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/business" className="text-gray-400 hover:text-gray-600 text-sm">← Business Wallet</Link>
        <h2 className="text-2xl font-bold text-gray-900">Business History</h2>
      </div>

      {/* Summary */}
      {(filter === "all" || filter === "income" || filter === "expense") && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl px-4 py-3 bg-green-600 text-white">
            <p className="text-xs opacity-75">Income</p>
            <p className="text-lg font-bold mt-0.5">LKR {fmt(totalIncome)}</p>
          </div>
          <div className="rounded-xl px-4 py-3 bg-red-500 text-white">
            <p className="text-xs opacity-75">Expenses</p>
            <p className="text-lg font-bold mt-0.5">LKR {fmt(totalExpenses)}</p>
          </div>
          <div className={`rounded-xl px-4 py-3 text-white ${netProfit >= 0 ? "bg-blue-600" : "bg-orange-500"}`}>
            <p className="text-xs opacity-75">Net Profit</p>
            <p className="text-lg font-bold mt-0.5">LKR {fmt(netProfit)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="month"
          className="input py-1.5 text-sm w-36"
          value={month}
          onChange={e => setMonth(e.target.value)}
        />
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f.key ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">{filtered.length} entries{month ? ` in ${month}` : " (all time)"}</p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-sm">No entries found.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50 p-0 overflow-hidden">
          {filtered.map(entry => renderEntry(entry))}
        </div>
      )}
    </div>
  );
}
