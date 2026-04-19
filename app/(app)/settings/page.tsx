"use client";

import { useEffect, useState, useCallback } from "react";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

interface Log { id: string; amount: number; date: string; note: string | null; }

export default function SettingsPage() {
  const today = new Date().toISOString().split("T")[0];

  const [capital, setCapital]           = useState("");
  const [capitalLocked, setCapitalLocked] = useState(false);
  const [capSaving, setCapSaving]       = useState(false);
  const [capSaved, setCapSaved]         = useState(false);

  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate]     = useState(today);
  const [addNote, setAddNote]     = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError]   = useState("");

  const [entries, setEntries] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = useCallback(async () => {
    const [prof, logs] = await Promise.all([
      fetch("/api/profile").then(r => r.json()),
      fetch("/api/logs?type=capital").then(r => r.json()),
    ]);
    if (prof?.initial_savings != null) {
      setCapital(String(prof.initial_savings));
      setCapitalLocked(Number(prof.initial_savings) > 0);
    }
    if (Array.isArray(logs)) setEntries(logs);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveCapital(e: React.FormEvent) {
    e.preventDefault(); setCapSaving(true); setError("");
    const res = await fetch("/api/profile", {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ initial_savings: Number(capital) }),
    });
    const d = await res.json(); setCapSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setCapitalLocked(true); setCapSaved(true);
    setTimeout(() => setCapSaved(false), 3000);
  }

  async function addFunds(e: React.FormEvent) {
    e.preventDefault(); setAddSaving(true); setAddError("");
    const res = await fetch("/api/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ type:"capital", amount: Number(addAmount), date: addDate, note: addNote || null }),
    });
    const d = await res.json(); setAddSaving(false);
    if (!res.ok) { setAddError(d.error ?? "Failed"); return; }
    setAddAmount(""); setAddNote(""); setAddDate(today);
    await load();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Remove this capital entry? It will reduce the shop balance.")) return;
    await fetch(`/api/logs/${id}`, { method:"DELETE" });
    await load();
  }

  const totalAdded = entries.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="max-w-lg space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Settings</h2>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {/* Starting Capital */}
      <section className="card space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">Starting Capital</h3>
          <p className="text-xs text-gray-400 mt-0.5">The amount you originally invested. Set once.</p>
        </div>

        {capitalLocked ? (
          <div className="space-y-2">
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">Starting Capital (locked)</p>
                <p className="text-xl font-bold text-gray-800">LKR {fmt(Number(capital))}</p>
              </div>
              <span>🔒</span>
            </div>
            <p className="text-xs text-gray-400">Use <strong>Add Funds</strong> below to inject more money into the shop.</p>
          </div>
        ) : (
          <form onSubmit={saveCapital} className="space-y-3">
            <div>
              <label className="label">Starting Capital (LKR)</label>
              <input type="number" min="0" step="0.01" className="input" placeholder="e.g. 1800000"
                value={capital} onChange={e => setCapital(e.target.value)} required />
              {capital && <p className="text-xs text-gray-500 mt-1">= LKR {fmt(Number(capital))}</p>}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              <p className="text-xs text-yellow-700">⚠️ Set this once. It cannot be changed after saving.</p>
            </div>
            {capSaved && <p className="text-sm text-green-600 font-medium">Saved and locked.</p>}
            <button type="submit" className="btn-primary text-sm" disabled={capSaving}>
              {capSaving ? "Saving…" : "Save & Lock"}
            </button>
          </form>
        )}
      </section>

      {/* Add Funds */}
      <section className="card space-y-4">
        <div>
          <h3 className="font-semibold text-gray-800">Add Funds to Shop</h3>
          <p className="text-xs text-gray-400 mt-0.5">Owner deposits, loans received, etc. Increases shop balance.</p>
        </div>

        {addError && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{addError}</div>}

        <form onSubmit={addFunds} className="space-y-3">
          <div>
            <label className="label">Amount (LKR)</label>
            <input type="number" min="1" step="0.01" className="input" placeholder="e.g. 50000"
              value={addAmount} onChange={e => setAddAmount(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={addDate} onChange={e => setAddDate(e.target.value)} required />
            </div>
            <div>
              <label className="label">Reason / Note</label>
              <input type="text" className="input" placeholder="e.g. Bank loan" value={addNote} onChange={e => setAddNote(e.target.value)} />
            </div>
          </div>
          {addAmount && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex justify-between items-center">
              <span className="text-sm text-green-700">Will add to shop balance</span>
              <span className="font-bold text-green-700">+ LKR {fmt(Number(addAmount))}</span>
            </div>
          )}
          <button type="submit" className="btn-primary text-sm" disabled={addSaving}>
            {addSaving ? "Adding…" : "Add Funds"}
          </button>
        </form>

        {entries.length > 0 && (
          <div className="border-t border-gray-100 pt-4 space-y-1">
            <div className="flex justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fund History</p>
              <p className="text-xs font-bold text-green-700">Total: LKR {fmt(totalAdded)}</p>
            </div>
            {entries.map(e => (
              <div key={e.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-green-700">+ LKR {fmt(e.amount)}</span>
                    <span className="text-xs text-gray-400">{e.date}</span>
                  </div>
                  {e.note && <p className="text-xs text-gray-500 truncate">{e.note}</p>}
                </div>
                <button onClick={() => deleteEntry(e.id)} className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Expense Tracker */}
      <ExpenseSection />
    </div>
  );
}

function ExpenseSection() {
  const today = new Date().toISOString().split("T")[0];
  const EXPENSE_TYPES = ["rent","wages","utilities","transport","marketing","other"];
  const [form, setForm] = useState({ category:"rent", amount:"", date:today, note:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");

  async function addExpense(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/logs", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ type:"expense", amount: Number(form.amount), date: form.date, note: form.note || form.category }),
    });
    const d = await res.json(); setSaving(false);
    if (!res.ok) { setError(d.error); return; }
    setSuccess(`LKR ${Number(form.amount).toLocaleString("en-LK")} expense recorded.`);
    setForm({ category:"rent", amount:"", date:today, note:"" });
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <section className="card space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800">Record Business Expense</h3>
        <p className="text-xs text-gray-400 mt-0.5">Rent, wages, utilities… deducted from shop balance.</p>
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2">{success}</div>}
      <form onSubmit={addExpense} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({...f, category:e.target.value}))}>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount (LKR)</label>
            <input type="number" min="1" step="0.01" className="input" required value={form.amount} onChange={e => setForm(f => ({...f, amount:e.target.value}))} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={form.date} onChange={e => setForm(f => ({...f, date:e.target.value}))} />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input type="text" className="input" value={form.note} onChange={e => setForm(f => ({...f, note:e.target.value}))} />
          </div>
        </div>
        {form.amount && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 flex justify-between">
            <span className="text-sm text-red-700">Will deduct from balance</span>
            <span className="font-bold text-red-700">− LKR {Number(form.amount).toLocaleString("en-LK", {minimumFractionDigits:2})}</span>
          </div>
        )}
        <button type="submit" className="btn-primary text-sm" disabled={saving}>{saving ? "Saving…" : "Record Expense"}</button>
      </form>
    </section>
  );
}
