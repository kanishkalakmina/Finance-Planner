"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Log {
  id: string; type: string; amount: number; qty: number | null;
  date: string; note: string | null;
  products?: { name: string } | null;
}
interface DashData {
  shop_balance: number; initial_savings: number;
  month_in: number; month_out: number; net_profit: number;
  breakdown: Record<string, number>;
  recent_logs: Log[];
  low_stock: { id: string; name: string; quantity: number; threshold: number }[];
}

const TYPE_META: Record<string, { icon: string; label: string }> = {
  sale:          { icon: "🛒", label: "Sale"          },
  restock:       { icon: "📦", label: "Restock"       },
  expense:       { icon: "💸", label: "Expense"       },
  capital:       { icon: "🏦", label: "Capital Added" },
  rental_return: { icon: "↩️", label: "Rental Return" },
  rental_out:    { icon: "🔁", label: "Rented Out"    },
  stock_return:  { icon: "↩️", label: "Stock Removed" },
};

const MONEY_IN  = ["sale","capital","rental_return"];
const MONEY_OUT = ["restock","expense"];

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const res = await fetch(`/api/dashboard?month=${m}`).then(r => r.json());
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;
  if (!data) return null;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <input type="month" className="input py-1 text-sm w-36" value={month}
          onChange={e => { setMonth(e.target.value); load(e.target.value); }} />
      </div>

      {/* Shop Balance */}
      <div className="card bg-gray-900 text-white">
        <p className="text-sm text-gray-400 mb-1">Shop Balance</p>
        <p className="text-4xl font-bold tracking-tight">LKR {fmt(data.shop_balance)}</p>
        <p className="text-xs text-gray-500 mt-2">Starting capital: LKR {fmt(data.initial_savings)}</p>
      </div>

      {/* Monthly P&L */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Money In</p>
          <p className="text-lg font-bold text-green-600">LKR {fmt(data.month_in)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Money Out</p>
          <p className="text-lg font-bold text-red-500">LKR {fmt(data.month_out)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Net Profit</p>
          <p className={`text-lg font-bold ${data.net_profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            LKR {fmt(data.net_profit)}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      {Object.keys(data.breakdown).length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-1">This Month Breakdown</p>
          {Object.entries(data.breakdown).filter(([, v]) => v > 0).map(([type, amt]) => {
            const m = TYPE_META[type] ?? { icon: "📎", label: type };
            const isIn = MONEY_IN.includes(type);
            const isOut = MONEY_OUT.includes(type);
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{m.icon} {m.label}</span>
                <span className={`text-sm font-semibold ${isIn ? "text-green-600" : isOut ? "text-red-500" : "text-gray-500"}`}>
                  {isIn ? "+" : isOut ? "−" : "·"} LKR {fmt(amt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Low Stock */}
      {data.low_stock.length > 0 && (
        <div className="card border border-orange-200 bg-orange-50 space-y-2">
          <p className="text-sm font-semibold text-orange-700">⚠️ Low Stock ({data.low_stock.length})</p>
          {data.low_stock.map(p => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-gray-700">{p.name}</span>
              <span className="text-orange-600 font-medium">{p.quantity} left</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      {data.recent_logs.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <p className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">Recent Activity</p>
          {data.recent_logs.map(log => {
            const m = TYPE_META[log.type] ?? { icon: "📎", label: log.type };
            const isIn  = MONEY_IN.includes(log.type);
            const isOut = MONEY_OUT.includes(log.type);
            return (
              <div key={log.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <span className="text-lg flex-shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {m.label}{log.products?.name ? ` — ${log.products.name}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">
                    {log.date}{log.qty ? ` · ${log.qty} units` : ""}{log.note ? ` · ${log.note}` : ""}
                  </p>
                </div>
                {log.amount > 0 && (
                  <span className={`text-sm font-bold flex-shrink-0 ${isIn ? "text-green-600" : isOut ? "text-red-500" : "text-gray-500"}`}>
                    {isIn ? "+" : isOut ? "−" : "·"} LKR {fmt(log.amount)}
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
