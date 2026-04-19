"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Log {
  id: string; type: string; qty: number | null; unit_price: number | null;
  amount: number; date: string; note: string | null;
  products?: { name: string } | null;
}

const META: Record<string, { icon: string; label: string; in: boolean; out: boolean }> = {
  sale:          { icon:"🛒", label:"Sale",           in:true,  out:false },
  restock:       { icon:"📦", label:"Restock",        in:false, out:true  },
  expense:       { icon:"💸", label:"Expense",        in:false, out:true  },
  capital:       { icon:"🏦", label:"Capital Added",  in:true,  out:false },
  rental_return: { icon:"↩️", label:"Rental Return",  in:true,  out:false },
  rental_out:    { icon:"🔁", label:"Rented Out",     in:false, out:false },
  stock_return:  { icon:"↩️", label:"Stock Removed",  in:true,  out:false },
};

type Filter = "all"|"sale"|"restock"|"expense"|"capital"|"rental_return"|"rental_out";

export default function TransactionsPage() {
  const [month, setMonth]   = useState(currentMonth());
  const [filter, setFilter] = useState<Filter>("all");
  const [logs, setLogs]     = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const data = await fetch(`/api/logs?month=${m}`).then(r => r.json());
    if (Array.isArray(data)) setLogs(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  const visible = filter === "all" ? logs : logs.filter(l => l.type === filter);
  const totalIn  = logs.filter(l => META[l.type]?.in).reduce((s, l) => s + l.amount, 0);
  const totalOut = logs.filter(l => META[l.type]?.out).reduce((s, l) => s + l.amount, 0);

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transactions</h2>
          <p className="text-xs text-gray-400 mt-0.5">Every record in one place</p>
        </div>
        <input type="month" className="input py-1 text-sm w-36" value={month}
          onChange={e => { setMonth(e.target.value); load(e.target.value); }} />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Money In</p>
          <p className="text-lg font-bold text-green-600">LKR {fmt(totalIn)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Money Out</p>
          <p className="text-lg font-bold text-red-500">LKR {fmt(totalOut)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Net</p>
          <p className={`text-lg font-bold ${totalIn - totalOut >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            LKR {fmt(totalIn - totalOut)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {([
          ["all",          `All (${logs.length})`],
          ["sale",         `🛒 Sales`],
          ["restock",      `📦 Restock`],
          ["expense",      `💸 Expenses`],
          ["capital",      `🏦 Capital`],
          ["rental_return",`↩️ Returns`],
          ["rental_out",   `🔁 Rentals`],
        ] as [Filter, string][]).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${filter === f ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">No transactions for this period.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden divide-y divide-gray-50">
          {visible.map(log => {
            const m = META[log.type] ?? { icon:"📎", label:log.type, in:false, out:false };
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${m.in ? "bg-green-100" : m.out ? "bg-red-100" : "bg-gray-100"}`}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">
                    {m.label}{log.products?.name ? ` — ${log.products.name}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    {log.date}
                    {log.qty ? ` · ${log.qty} units` : ""}
                    {log.unit_price ? ` @ LKR ${fmt(log.unit_price)}` : ""}
                    {log.note ? ` · ${log.note}` : ""}
                  </p>
                </div>
                {log.amount > 0 && (
                  <span className={`text-sm font-bold flex-shrink-0 ${m.in ? "text-green-600" : m.out ? "text-red-500" : "text-gray-500"}`}>
                    {m.in ? "+" : m.out ? "−" : "·"} LKR {fmt(log.amount)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
