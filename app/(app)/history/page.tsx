"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface SaleLog {
  id: string; qty: number | null; unit_price: number | null; amount: number;
  date: string; note: string | null; products?: { name: string; category: string } | null;
}
interface Rental {
  id: string; quantity: number; customer_name: string | null; rental_fee: number;
  fee_collected: number | null; rent_date: string; actual_return_date: string | null;
  expected_return_date: string; returned: boolean;
  products?: { name: string; category: string } | null;
}

const CAT_ICON: Record<string, string> = { saree:"👘", shoe:"👟", bag:"👜", rental:"🔁", other:"📦" };
const PAGE_SIZE = 20;

function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2 px-1">
      <span className="text-xs text-gray-400">Page {page} of {pages}</span>
      <div className="flex gap-2">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          ← Prev
        </button>
        <button onClick={() => onPage(page + 1)} disabled={page >= pages}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Next →
        </button>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab]         = useState<"sales"|"rentals">("sales");
  const [month, setMonth]     = useState(currentMonth());
  const [sales, setSales]     = useState<SaleLog[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesPage, setSalesPage]   = useState(1);
  const [rentalsPage, setRentalsPage] = useState(1);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    setSalesPage(1);
    setRentalsPage(1);
    const [salesRes, rentalsRes] = await Promise.all([
      fetch(`/api/logs?type=sale&month=${m}`).then(r => r.json()),
      fetch("/api/rentals?all=1").then(r => r.json()),
    ]);
    if (Array.isArray(salesRes)) setSales(salesRes);
    if (Array.isArray(rentalsRes)) setRentals(rentalsRes);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  const filteredRentals = rentals.filter(r => {
    const dateKey = r.returned ? r.actual_return_date : r.rent_date;
    return dateKey?.startsWith(month);
  });

  const monthRevenue = sales.reduce((s, l) => s + l.amount, 0);
  const monthUnits   = sales.reduce((s, l) => s + (l.qty ?? 0), 0);
  const rentalIncome = filteredRentals.filter(r => r.returned).reduce((s, r) => s + Number(r.fee_collected ?? r.rental_fee), 0);

  const pagedSales   = sales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  const pagedRentals = filteredRentals.slice((rentalsPage - 1) * PAGE_SIZE, rentalsPage * PAGE_SIZE);

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">History</h2>
          <p className="text-xs text-gray-400 mt-0.5">Sales and rental records</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" className="input py-1 text-sm w-36" value={month}
            onChange={e => { setMonth(e.target.value); load(e.target.value); }} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-400">Sales Revenue</p>
          <p className="text-lg font-bold text-green-600">LKR {fmt(monthRevenue)}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Units Sold</p>
          <p className="text-lg font-bold text-gray-800">{monthUnits}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-400">Rental Income</p>
          <p className="text-lg font-bold text-purple-600">LKR {fmt(rentalIncome)}</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2">
        <button onClick={() => setTab("sales")}
          className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${tab === "sales" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          🛒 Sales ({sales.length})
        </button>
        <button onClick={() => setTab("rentals")}
          className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${tab === "rentals" ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          🔁 Rentals ({filteredRentals.length})
        </button>
      </div>

      {/* Sales list */}
      {tab === "sales" && (
        <div className="space-y-3">
          {sales.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-sm">No sales in {month}.</p>
            </div>
          ) : (
            <>
              <div className="card p-0 overflow-hidden divide-y divide-gray-50">
                {pagedSales.map(s => {
                  const icon = CAT_ICON[s.products?.category ?? "other"] ?? "📦";
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-base flex-shrink-0">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{s.products?.name ?? "Product"}</p>
                        <p className="text-xs text-gray-400">
                          {s.date} · {s.qty ?? 0} unit{(s.qty ?? 0) !== 1 ? "s" : ""}
                          {s.unit_price ? ` @ LKR ${fmt(s.unit_price)}` : ""}
                          {s.note ? ` · ${s.note}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-green-600">+ LKR {fmt(s.amount)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={salesPage} total={sales.length} onPage={setSalesPage} />
            </>
          )}
        </div>
      )}

      {/* Rentals list */}
      {tab === "rentals" && (
        <div className="space-y-3">
          {filteredRentals.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🔁</p>
              <p className="text-sm">No rentals in {month}.</p>
            </div>
          ) : (
            <>
              <div className="card p-0 overflow-hidden divide-y divide-gray-50">
                {pagedRentals.map(r => {
                  const icon = CAT_ICON[r.products?.category ?? "rental"] ?? "🔁";
                  const overdue = !r.returned && new Date(r.expected_return_date) < new Date();
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${r.returned ? "bg-green-100" : overdue ? "bg-red-100" : "bg-purple-100"}`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-800">{r.products?.name ?? "Item"} × {r.quantity}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.returned ? "bg-green-100 text-green-700" : overdue ? "bg-red-100 text-red-600" : "bg-purple-100 text-purple-700"}`}>
                            {r.returned ? "Returned" : overdue ? "Overdue" : "Out"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {r.rent_date} → {r.actual_return_date ?? r.expected_return_date}
                          {r.customer_name ? ` · ${r.customer_name}` : ""}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {r.returned ? (
                          <p className="text-sm font-bold text-green-600">+ LKR {fmt(r.fee_collected ?? r.rental_fee)}</p>
                        ) : (
                          <p className="text-sm font-medium text-gray-500">LKR {fmt(r.rental_fee)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={rentalsPage} total={filteredRentals.length} onPage={setRentalsPage} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
