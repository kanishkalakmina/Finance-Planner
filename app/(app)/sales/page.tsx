"use client";

import { useEffect, useState, useCallback } from "react";
import StatCard from "@/components/ui/StatCard";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

interface Product { id: string; name: string; category: string; sell_price: number | null; buy_price: number | null; quantity: number; item_type: string; }
interface Log {
  id: string; type: string; qty: number | null; unit_price: number | null; amount: number;
  date: string; note: string | null; products?: { name: string } | null;
}

const CAT_ICON: Record<string, string> = { saree:"👘", shoe:"👟", bag:"👜", rental:"🔁", other:"📦" };

export default function SalesPage() {
  const today = new Date().toISOString().split("T")[0];
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales]       = useState<Log[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const [form, setForm] = useState({ product_id:"", qty:"1", unit_price:"", date:today, note:"" });

  const load = useCallback(async () => {
    const [prods, logs] = await Promise.all([
      fetch("/api/products").then(r => r.json()),
      fetch("/api/logs?type=sale").then(r => r.json()),
    ]);
    if (Array.isArray(prods)) setProducts(prods.filter((p: Product) => p.item_type === "sale" || p.item_type === "sale_and_rent"));
    if (Array.isArray(logs)) setSales(logs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recordSale(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const qty = Number(form.qty);
    const price = Number(form.unit_price);
    const total = qty * price;
    const product = products.find(p => p.id === form.product_id);

    const res = await fetch("/api/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        type:"sale", product_id: form.product_id,
        qty, unit_price: price, amount: total,
        date: form.date, note: form.note || null,
      }),
    });
    const d = await res.json(); setSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setSuccess(`Sale recorded! LKR ${fmt(total)} added to balance.`);
    setForm({ product_id:"", qty:"1", unit_price:"", date:today, note:"" });
    await load();
    setTimeout(() => setSuccess(""), 4000);
    void product;
  }

  const selectedProduct = products.find(p => p.id === form.product_id);
  const previewTotal = form.unit_price && form.qty ? Number(form.unit_price) * Number(form.qty) : null;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter(s => s.date.startsWith(thisMonth));
  const monthRevenue = monthSales.reduce((s, l) => s + l.amount, 0);

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sales</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="This Month" value={`LKR ${fmt(monthRevenue)}`} color="green" />
        <StatCard label="Units Sold" value={String(monthSales.reduce((s, l) => s + (l.qty ?? 0), 0))} color="gray" />
        <StatCard label="All-Time" value={`LKR ${fmt(sales.reduce((s, l) => s + l.amount, 0))}`} color="blue" />
      </div>

      {/* Sale Form */}
      <div className="card space-y-4">
        <h3 className="font-bold text-gray-800">🛒 Record a Sale</h3>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">{success}</div>}

        {products.length === 0 ? (
          <p className="text-sm text-gray-400">No saleable products. Add products in Stock first.</p>
        ) : (
          <form onSubmit={recordSale} className="space-y-3">
            <div>
              <label className="label">Product</label>
              <select className="input" required value={form.product_id} onChange={e => {
                const p = products.find(pr => pr.id === e.target.value);
                setForm(f => ({ ...f, product_id: e.target.value, unit_price: p?.sell_price ? String(p.sell_price) : "" }));
              }}>
                <option value="">Select product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                    {CAT_ICON[p.category]} {p.name} — {p.quantity} in stock{p.quantity === 0 ? " (out)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedProduct && (
              <p className="text-xs text-gray-400">Suggested: LKR {fmt(selectedProduct.sell_price ?? 0)} · Buy: LKR {fmt(selectedProduct.buy_price ?? 0)}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Qty Sold</label>
                <input type="number" min="1" step="1" className="input" required value={form.qty} onChange={e => setForm(f => ({...f, qty:e.target.value}))} />
              </div>
              <div>
                <label className="label">Price / Unit (LKR)</label>
                <input type="number" min="0.01" step="0.01" className="input" required value={form.unit_price} onChange={e => setForm(f => ({...f, unit_price:e.target.value}))} />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" required value={form.date} onChange={e => setForm(f => ({...f, date:e.target.value}))} />
              </div>
              <div>
                <label className="label">Note (optional)</label>
                <input type="text" className="input" placeholder="e.g. Walk-in" value={form.note} onChange={e => setForm(f => ({...f, note:e.target.value}))} />
              </div>
            </div>
            {previewTotal !== null && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between">
                <span className="text-sm text-green-700">Will add to balance</span>
                <span className="font-bold text-green-700">+ LKR {fmt(previewTotal)}</span>
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={saving}>{saving ? "Saving…" : "Record Sale"}</button>
          </form>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        View full history in the <a href="/history" className="text-blue-600 underline">History</a> page.
      </p>
    </div>
  );
}
