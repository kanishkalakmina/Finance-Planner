"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface TxEntry {
  id: string;
  entry_type: "transaction" | "transfer";
  type?: "withdrawal" | "deposit";
  source?: string | null;
  pool?: "salary" | "savings";
  direction?: "personal_to_shop" | "shop_to_personal";
  from_pool?: "salary" | "savings";
  amount: number;
  date: string;
  note: string | null;
  savings_after: number;
  salary_after: number;
}

interface SavingsData {
  salary_balance: number;
  savings_balance: number;
  transactions: TxEntry[];
}

function fmt(n: number) {
  return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

type FilterType = "all" | "salary_in" | "savings_in" | "withdrawal" | "transfer";

export default function PersonalHistoryPage() {
  const [data, setData] = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/finances/savings")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteEntry(entry: TxEntry) {
    if (!confirm("Remove this entry?")) return;
    if (entry.entry_type === "transfer") {
      await fetch(`/api/wallet/transfers/${entry.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/finances/savings/${entry.id}`, { method: "DELETE" });
    }
    load();
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;

  const all = data?.transactions ?? [];

  // Month filter
  const monthFiltered = month
    ? all.filter(e => e.date.startsWith(month))
    : all;

  // Type filter
  const filtered = monthFiltered.filter(e => {
    if (filter === "all") return true;
    if (filter === "salary_in") return e.entry_type === "transaction" && e.type === "deposit" && e.source === "salary";
    if (filter === "savings_in") return e.entry_type === "transaction" && e.type === "deposit" && e.source !== "salary";
    if (filter === "withdrawal") return e.entry_type === "transaction" && e.type === "withdrawal";
    if (filter === "transfer") return e.entry_type === "transfer";
    return true;
  });

  function entryLabel(e: TxEntry) {
    if (e.entry_type === "transfer") {
      if (e.direction === "personal_to_shop") {
        const pool = e.from_pool ?? "savings";
        return { icon: "🏪", label: `${pool === "salary" ? "💼 Salary" : "🏦 Savings"} → Business`, color: "text-blue-700 bg-blue-50", sign: "−" };
      }
      return { icon: "🏪", label: "Business → 🏦 Savings", color: "text-green-700 bg-green-50", sign: "+" };
    }
    if (e.type === "deposit") {
      if (e.source === "salary") return { icon: "💼", label: "Salary", color: "text-green-700 bg-green-50", sign: "+" };
      if (e.source === "loan_payout") return { icon: "🤝", label: "Loan / Sittu", color: "text-purple-700 bg-purple-50", sign: "+" };
      return { icon: "📎", label: "Other deposit", color: "text-gray-700 bg-gray-50", sign: "+" };
    }
    const pool = e.pool ?? "salary";
    return {
      icon: pool === "savings" ? "🏦" : "👤",
      label: pool === "savings" ? "Savings withdrawal" : "Personal spending",
      color: "text-red-700 bg-red-50",
      sign: "−",
    };
  }

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all",        label: "All"           },
    { key: "salary_in",  label: "💼 Salary In"  },
    { key: "savings_in", label: "🏦 Deposits"   },
    { key: "withdrawal", label: "↓ Withdrawals" },
    { key: "transfer",   label: "↔ Transfers"   },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/savings" className="text-gray-400 hover:text-gray-600 text-sm">← Personal Wallet</Link>
        <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3 bg-green-600 text-white">
          <p className="text-xs opacity-75">💰 Personal Balance</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(data?.salary_balance ?? 0)}</p>
        </div>
        <div className="rounded-xl px-4 py-3 bg-indigo-600 text-white">
          <p className="text-xs opacity-75">🏦 Savings Balance</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(data?.savings_balance ?? 0)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="month"
          className="input py-1.5 text-sm w-36"
          value={month}
          onChange={e => setMonth(e.target.value)}
          placeholder="All months"
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

      {/* Count */}
      <p className="text-xs text-gray-400">{filtered.length} entries{month ? ` in ${month}` : ""}</p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-sm">No transactions found.</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50 p-0 overflow-hidden">
          {filtered.map(entry => {
            const lbl = entryLabel(entry);
            const isDeposit = lbl.sign === "+";
            return (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* Icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${isDeposit ? "bg-green-100" : "bg-red-100"}`}>
                  {lbl.icon}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isDeposit ? "text-green-600" : "text-red-600"}`}>
                      {lbl.sign} LKR {fmt(entry.amount)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lbl.color}`}>{lbl.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{entry.date}</span>
                    {entry.note && <span className="text-xs text-gray-500 truncate">· {entry.note}</span>}
                  </div>
                </div>

                {/* Running balances */}
                <div className="text-right flex-shrink-0 mr-2">
                  <p className="text-xs text-green-600 font-medium">💼 {fmt(entry.salary_after)}</p>
                  <p className="text-xs text-indigo-500 font-medium">🏦 {fmt(entry.savings_after)}</p>
                </div>

                {/* Delete */}
                <button className="text-xs text-red-300 hover:text-red-500 flex-shrink-0" onClick={() => deleteEntry(entry)}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
