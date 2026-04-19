"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function daysDiff(d: string) {
  const diff = new Date(d).getTime() - new Date().setHours(0,0,0,0);
  return Math.ceil(diff / 86400000);
}

interface Product { id: string; name: string; category: string; rental_price: number | null; quantity: number; item_type: string; }
interface Rental {
  id: string; product_id: string; quantity: number; customer_name: string | null;
  rental_fee: number; rent_date: string; expected_return_date: string;
  actual_return_date: string | null; fee_collected: number | null; returned: boolean;
  products?: { name: string; category: string; rental_price: number | null } | null;
}

const CAT_ICON: Record<string, string> = { saree:"👘", shoe:"👟", bag:"👜", rental:"🔁", other:"📦" };

export default function RentalsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [products, setProducts]   = useState<Product[]>([]);
  const [rentals, setRentals]     = useState<Rental[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"active"|"rent_out"|"history">("active");
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  // Rent out form
  const [form, setForm] = useState({ product_id:"", quantity:"1", customer_name:"", rental_fee:"", rent_date:today, expected_return_date:"" });
  const [saving, setSaving] = useState(false);

  // Return modal
  const [returning, setReturning] = useState<Rental | null>(null);
  const [feeCollected, setFeeCollected] = useState("");
  const [returnDate, setReturnDate] = useState(today);
  const [retSaving, setRetSaving] = useState(false);

  const load = useCallback(async () => {
    const [prods, rents] = await Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/rentals?all=1").then(r => r.json()),
    ]);
    if (Array.isArray(prods)) setProducts(prods.filter((p: Product) => p.item_type === "rent" || p.item_type === "sale_and_rent"));
    if (Array.isArray(rents)) setRentals(rents);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function rentOut(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/rentals", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        product_id: form.product_id, quantity: Number(form.quantity),
        customer_name: form.customer_name || null,
        rental_fee: Number(form.rental_fee),
        rent_date: form.rent_date, expected_return_date: form.expected_return_date,
      }),
    });
    const d = await res.json(); setSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setSuccess("Rental recorded!");
    setForm({ product_id:"", quantity:"1", customer_name:"", rental_fee:"", rent_date:today, expected_return_date:"" });
    setTab("active"); await load();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function recordReturn() {
    if (!returning) return;
    setRetSaving(true); setError("");
    const res = await fetch(`/api/rentals/${returning.id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ fee_collected: Number(feeCollected || returning.rental_fee), return_date: returnDate }),
    });
    const d = await res.json(); setRetSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setReturning(null); setFeeCollected(""); setReturnDate(today);
    await load();
  }

  const active  = rentals.filter(r => !r.returned);
  const history = rentals.filter(r => r.returned);

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Rentals</h2>
        <div className="flex gap-2 flex-wrap">
          {([["active","Active","🔁"],[`rent_out`,"Rent Out","📤"],["history","History","📋"]] as const).map(([t, label, icon]) => (
            <button key={t} onClick={() => setTab(t as typeof tab)}
              className={`text-sm px-3 py-1.5 rounded-full font-medium border transition-colors ${tab === t ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {icon} {label} {t === "active" && active.length > 0 ? `(${active.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3">{success}</div>}

      {/* ACTIVE */}
      {tab === "active" && (
        <div className="space-y-3">
          {active.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">🔁</p>
              <p className="text-sm">No active rentals.</p>
            </div>
          ) : active.map(r => {
            const days = daysDiff(r.expected_return_date);
            const overdue = days < 0;
            return (
              <div key={r.id} className={`card border ${overdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{r.products?.name ?? "Item"} × {r.quantity}</p>
                    {r.customer_name && <p className="text-sm text-gray-500">Customer: {r.customer_name}</p>}
                    <p className="text-sm text-gray-500">Rented: {r.rent_date} · Due: {r.expected_return_date}</p>
                    <p className={`text-sm font-medium mt-1 ${overdue ? "text-red-600" : "text-gray-600"}`}>
                      {overdue ? `⚠️ ${Math.abs(days)} days overdue` : `${days} days left`}
                    </p>
                    <p className="text-sm font-semibold text-gray-700 mt-1">Fee: LKR {fmt(r.rental_fee)}</p>
                  </div>
                  <button onClick={() => { setReturning(r); setFeeCollected(String(r.rental_fee)); }}
                    className="btn-primary text-xs flex-shrink-0">
                    Record Return
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENT OUT */}
      {tab === "rent_out" && (
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">📤 Rent Out an Item</h3>
          {products.length === 0 ? (
            <p className="text-sm text-gray-400">No rental products. Add products with type "For Rent" in Stock first.</p>
          ) : (
            <form onSubmit={rentOut} className="space-y-3">
              <div>
                <label className="label">Product</label>
                <select className="input" required value={form.product_id} onChange={e => {
                  const p = products.find(pr => pr.id === e.target.value);
                  setForm(f => ({ ...f, product_id:e.target.value, rental_fee: p?.rental_price ? String(p.rental_price) : "" }));
                }}>
                  <option value="">Select product…</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                      {CAT_ICON[p.category]} {p.name} — {p.quantity} available{p.quantity === 0 ? " (none)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" min="1" step="1" className="input" required value={form.quantity} onChange={e => setForm(f => ({...f, quantity:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Rental Fee (LKR)</label>
                  <input type="number" min="0.01" step="0.01" className="input" required value={form.rental_fee} onChange={e => setForm(f => ({...f, rental_fee:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Customer Name</label>
                  <input type="text" className="input" placeholder="Optional" value={form.customer_name} onChange={e => setForm(f => ({...f, customer_name:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Rent Date</label>
                  <input type="date" className="input" required value={form.rent_date} onChange={e => setForm(f => ({...f, rent_date:e.target.value}))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Expected Return Date</label>
                  <input type="date" className="input" required value={form.expected_return_date} onChange={e => setForm(f => ({...f, expected_return_date:e.target.value}))} />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? "Saving…" : "Confirm Rental"}</button>
            </form>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <div className="card p-0 overflow-hidden">
          <p className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">Rental History</p>
          {history.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No completed rentals yet.</div>
          ) : history.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <span className="text-lg">↩️</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{r.products?.name ?? "Item"} × {r.quantity}</p>
                <p className="text-xs text-gray-400">
                  {r.rent_date} → {r.actual_return_date ?? r.expected_return_date}
                  {r.customer_name ? ` · ${r.customer_name}` : ""}
                </p>
              </div>
              <span className="text-sm font-bold text-green-600 flex-shrink-0">+ LKR {fmt(r.fee_collected ?? r.rental_fee)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Return Modal */}
      {returning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900">Record Return</h3>
            <p className="text-sm text-gray-600">
              {returning.products?.name} × {returning.quantity}
              {returning.customer_name ? ` · ${returning.customer_name}` : ""}
            </p>
            <div>
              <label className="label">Fee Collected (LKR)</label>
              <input type="number" min="0" step="0.01" className="input"
                value={feeCollected} onChange={e => setFeeCollected(e.target.value)} />
            </div>
            <div>
              <label className="label">Return Date</label>
              <input type="date" className="input" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
            {feeCollected && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between">
                <span className="text-sm text-green-700">Will add to balance</span>
                <span className="font-bold text-green-700">+ LKR {fmt(Number(feeCollected))}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={recordReturn} className="btn-primary flex-1" disabled={retSaving}>{retSaving ? "Saving…" : "Confirm Return"}</button>
              <button onClick={() => setReturning(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
