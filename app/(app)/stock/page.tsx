"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

interface Product {
  id: string; name: string; category: string; item_type: string;
  buy_price: number; sell_price: number | null; rental_price: number | null;
  quantity: number; low_stock_threshold: number;
}

const CATEGORIES = ["saree","shoe","bag","rental","other"];
const ITEM_TYPES  = ["sale","rent","sale_and_rent"];
const CAT_ICON: Record<string, string> = { saree:"👘", shoe:"👟", bag:"👜", rental:"🔁", other:"📦" };
const TYPE_LABEL: Record<string, string> = { sale:"For Sale", rent:"For Rent", sale_and_rent:"Sale & Rent" };

export default function StockPage() {
  const today = new Date().toISOString().split("T")[0];
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"catalog"|"restock"|"remove">("catalog");
  const [error, setError]       = useState("");
  const [search, setSearch]     = useState("");

  // Add product form
  const [showAdd, setShowAdd] = useState(false);
  const [pForm, setPForm] = useState({ name:"", category:"saree", item_type:"sale", buy_price:"", sell_price:"", rental_price:"", quantity:"0", low_stock_threshold:"5" });
  const [pSaving, setPSaving] = useState(false);

  // Restock form
  const [rForm, setRForm] = useState({ product_id:"", qty:"1", cost_per_unit:"", date:today, note:"" });
  const [rSaving, setRSaving] = useState(false);
  const [rSuccess, setRSuccess] = useState("");

  // Remove stock form
  const [rmForm, setRmForm] = useState({ product_id:"", qty:"1", refund_per_unit:"", date:today, note:"" });
  const [rmSaving, setRmSaving] = useState(false);
  const [rmSuccess, setRmSuccess] = useState("");

  const load = useCallback(async () => {
    const data = await fetch("/api/products").then(r => r.json());
    if (Array.isArray(data)) setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault(); setPSaving(true); setError("");
    const res = await fetch("/api/products", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        name: pForm.name, category: pForm.category, item_type: pForm.item_type,
        buy_price: Number(pForm.buy_price || 0),
        sell_price: pForm.sell_price ? Number(pForm.sell_price) : null,
        rental_price: pForm.rental_price ? Number(pForm.rental_price) : null,
        quantity: Number(pForm.quantity), low_stock_threshold: Number(pForm.low_stock_threshold),
      }),
    });
    const d = await res.json(); setPSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setPForm({ name:"", category:"saree", item_type:"sale", buy_price:"", sell_price:"", rental_price:"", quantity:"0", low_stock_threshold:"5" });
    setShowAdd(false); await load();
  }

  async function removeStock(e: React.FormEvent) {
    e.preventDefault(); setRmSaving(true); setError(""); setRmSuccess("");
    const qty = Number(rmForm.qty);
    const refund = Number(rmForm.refund_per_unit) * qty;
    const product = products.find(p => p.id === rmForm.product_id);
    if (product && product.quantity < qty) { setError(`Only ${product.quantity} in stock`); setRmSaving(false); return; }
    const res = await fetch("/api/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        type:"stock_return", product_id: rmForm.product_id,
        qty, unit_price: Number(rmForm.refund_per_unit),
        amount: refund, date: rmForm.date,
        note: rmForm.note || `Stock removed: ${product?.name ?? ""} ×${qty}`,
      }),
    });
    const d = await res.json(); setRmSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setRmSuccess(`Removed ${qty} units. LKR ${fmt(refund)} added back to balance.`);
    setRmForm({ product_id:"", qty:"1", refund_per_unit:"", date:today, note:"" });
    await load();
  }

  async function restock(e: React.FormEvent) {
    e.preventDefault(); setRSaving(true); setError(""); setRSuccess("");
    const cost = Number(rForm.cost_per_unit) * Number(rForm.qty);
    const product = products.find(p => p.id === rForm.product_id);
    const res = await fetch("/api/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        type:"restock", product_id: rForm.product_id,
        qty: Number(rForm.qty), unit_price: Number(rForm.cost_per_unit),
        amount: cost, date: rForm.date,
        note: rForm.note || `Restock: ${product?.name ?? ""} ×${rForm.qty}`,
      }),
    });
    const d = await res.json(); setRSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setRSuccess(`Restocked ${rForm.qty} units. LKR ${fmt(cost)} deducted from balance.`);
    setRForm({ product_id:"", qty:"1", cost_per_unit:"", date:today, note:"" });
    await load();
  }

  const visible = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold text-gray-900">Stock</h2>
        <div className="flex gap-2">
          {([["catalog","📦 Catalog"],["restock","🔄 Restock"],["remove","↩️ Remove"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${tab === t ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* CATALOG TAB */}
      {tab === "catalog" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input type="text" className="input flex-1" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm">+ Add Product</button>
          </div>

          {showAdd && (
            <form onSubmit={addProduct} className="card space-y-3">
              <h3 className="font-semibold text-gray-800">New Product</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Name</label>
                  <input className="input" required value={pForm.name} onChange={e => setPForm(f => ({...f, name:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={pForm.category} onChange={e => setPForm(f => ({...f, category:e.target.value}))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICON[c]} {c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={pForm.item_type} onChange={e => setPForm(f => ({...f, item_type:e.target.value}))}>
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Buy Price (LKR)</label>
                  <input type="number" min="0" step="0.01" className="input" value={pForm.buy_price} onChange={e => setPForm(f => ({...f, buy_price:e.target.value}))} />
                </div>
                {(pForm.item_type === "sale" || pForm.item_type === "sale_and_rent") && (
                  <div>
                    <label className="label">Sell Price (LKR)</label>
                    <input type="number" min="0" step="0.01" className="input" value={pForm.sell_price} onChange={e => setPForm(f => ({...f, sell_price:e.target.value}))} />
                  </div>
                )}
                {(pForm.item_type === "rent" || pForm.item_type === "sale_and_rent") && (
                  <div>
                    <label className="label">Rental Price (LKR)</label>
                    <input type="number" min="0" step="0.01" className="input" value={pForm.rental_price} onChange={e => setPForm(f => ({...f, rental_price:e.target.value}))} />
                  </div>
                )}
                <div>
                  <label className="label">Initial Qty</label>
                  <input type="number" min="0" step="1" className="input" value={pForm.quantity} onChange={e => setPForm(f => ({...f, quantity:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Low Stock Alert</label>
                  <input type="number" min="0" step="1" className="input" value={pForm.low_stock_threshold} onChange={e => setPForm(f => ({...f, low_stock_threshold:e.target.value}))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm" disabled={pSaving}>{pSaving ? "Saving…" : "Add Product"}</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          )}

          {visible.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📦</p>
              <p className="text-sm">{search ? "No products match." : "No products yet. Add one above."}</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden divide-y divide-gray-50">
              {visible.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl flex-shrink-0">{CAT_ICON[p.category] ?? "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{TYPE_LABEL[p.item_type]}</span>
                      {p.quantity <= p.low_stock_threshold && p.item_type !== "rent" && (
                        <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">Low stock</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                      <span>Buy: LKR {fmt(p.buy_price)}</span>
                      {p.sell_price && <span>Sell: LKR {fmt(p.sell_price)}</span>}
                      {p.rental_price && <span>Rent: LKR {fmt(p.rental_price)}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-800">{p.quantity}</p>
                    <p className="text-xs text-gray-400">in stock</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REMOVE STOCK TAB */}
      {tab === "remove" && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">↩️ Remove Stock</h3>
            <p className="text-xs text-gray-400 mt-0.5">Return stock to supplier or remove items. Refund amount is added back to shop balance.</p>
          </div>

          {rmSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{rmSuccess}</div>}

          {products.length === 0 ? (
            <p className="text-sm text-gray-400">No products yet.</p>
          ) : (
            <form onSubmit={removeStock} className="space-y-3">
              <div>
                <label className="label">Product</label>
                <select className="input" required value={rmForm.product_id} onChange={e => {
                  const p = products.find(pr => pr.id === e.target.value);
                  setRmForm(f => ({ ...f, product_id:e.target.value, refund_per_unit: p?.buy_price ? String(p.buy_price) : "" }));
                }}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id} disabled={p.quantity === 0}>{CAT_ICON[p.category]} {p.name} ({p.quantity} in stock)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity to Remove</label>
                  <input type="number" min="1" step="1" className="input" required value={rmForm.qty} onChange={e => setRmForm(f => ({...f, qty:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Refund per Unit (LKR)</label>
                  <input type="number" min="0" step="0.01" className="input" required value={rmForm.refund_per_unit} onChange={e => setRmForm(f => ({...f, refund_per_unit:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" required value={rmForm.date} onChange={e => setRmForm(f => ({...f, date:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Reason (optional)</label>
                  <input type="text" className="input" placeholder="e.g. Returned to supplier" value={rmForm.note} onChange={e => setRmForm(f => ({...f, note:e.target.value}))} />
                </div>
              </div>
              {rmForm.refund_per_unit && rmForm.qty && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between items-center">
                  <span className="text-sm text-green-700">Will add back to balance</span>
                  <span className="font-bold text-green-700">+ LKR {fmt(Number(rmForm.refund_per_unit) * Number(rmForm.qty))}</span>
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={rmSaving}>{rmSaving ? "Removing…" : "Confirm Removal"}</button>
            </form>
          )}
        </div>
      )}

      {/* RESTOCK TAB */}
      {tab === "restock" && (
        <div className="card space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">Restock Products</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cost will be automatically deducted from shop balance.</p>
          </div>

          {rSuccess && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">{rSuccess}</div>}

          {products.length === 0 ? (
            <p className="text-sm text-gray-400">No products yet. Add products in the Catalog tab first.</p>
          ) : (
            <form onSubmit={restock} className="space-y-3">
              <div>
                <label className="label">Product</label>
                <select className="input" required value={rForm.product_id} onChange={e => {
                  const p = products.find(pr => pr.id === e.target.value);
                  setRForm(f => ({ ...f, product_id:e.target.value, cost_per_unit: p?.buy_price ? String(p.buy_price) : "" }));
                }}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{CAT_ICON[p.category]} {p.name} ({p.quantity} in stock)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Quantity</label>
                  <input type="number" min="1" step="1" className="input" required value={rForm.qty} onChange={e => setRForm(f => ({...f, qty:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Cost per Unit (LKR)</label>
                  <input type="number" min="0.01" step="0.01" className="input" required value={rForm.cost_per_unit} onChange={e => setRForm(f => ({...f, cost_per_unit:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" required value={rForm.date} onChange={e => setRForm(f => ({...f, date:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Note (optional)</label>
                  <input type="text" className="input" value={rForm.note} onChange={e => setRForm(f => ({...f, note:e.target.value}))} />
                </div>
              </div>
              {rForm.cost_per_unit && rForm.qty && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex justify-between items-center">
                  <span className="text-sm text-red-700">Will deduct from balance</span>
                  <span className="font-bold text-red-700">− LKR {fmt(Number(rForm.cost_per_unit) * Number(rForm.qty))}</span>
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={rSaving}>{rSaving ? "Restocking…" : "Confirm Restock"}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
