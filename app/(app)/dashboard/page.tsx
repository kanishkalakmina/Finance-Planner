"use client";

import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import StatCard from "@/components/ui/StatCard";

function fmt(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmt2(n: number) { return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtK(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : fmt(n); }
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface TrendPoint { month: string; income: number; expenses: number; net: number; }
interface Log { id: string; type: string; amount: number; qty: number | null; date: string; note: string | null; products?: { name: string } | null; }
interface TopSeller { name: string; category: string; units: number; revenue: number; }
interface DashData {
  shop_balance: number;
  initial_savings: number;
  total_capital_added: number;
  total_capital_invested: number;
  month_in: number; month_out: number; net_profit: number;
  breakdown: Record<string, number>;
  trend: TrendPoint[];
  recent_logs: Log[];
  low_stock: { id: string; name: string; quantity: number; threshold: number }[];
  top_sellers: TopSeller[];
  avg_monthly_expenses: number;
  safe_withdrawal: number;
  total_stock_value: number;
}

const TYPE_META: Record<string, { icon: string; label: string; in: boolean; out: boolean }> = {
  sale:          { icon: "🛒", label: "Sales",          in: true,  out: false },
  restock:       { icon: "📦", label: "Restock",        in: false, out: true  },
  expense:       { icon: "💸", label: "Expenses",       in: false, out: true  },
  capital:       { icon: "🏦", label: "Capital Added",  in: true,  out: false },
  rental_return: { icon: "↩️", label: "Rental Income",  in: true,  out: false },
  rental_out:    { icon: "🔁", label: "Rented Out",     in: false, out: false },
  stock_return:  { icon: "↩️", label: "Stock Returned", in: true,  out: false },
  withdrawal:    { icon: "💵", label: "Withdrawal",     in: false, out: true  },
};

const CAT_ICON: Record<string, string> = { saree: "👘", shoe: "👟", bag: "👜", rental: "🔁", other: "📦" };

interface WdResult {
  verdict: "safe" | "risky" | "danger";
  withdraw_amount: number;
  balance_before: number;
  balance_after: number;
  avg_monthly_expenses: number;
  months_buffer_remaining: number;
  safe_buffer_needed: number;
  explanation: string;
  consequences: string;
  return_advice: string;
}

interface AiResponse {
  advice: string;
  business_paths: string[];
  key_action: string;
  mistake_to_avoid: string;
  growth_priority: string;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData]   = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  const [aiData, setAiData]       = useState<AiResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoaded, setAiLoaded]   = useState(false);

  const [aiStatus, setAiStatus]   = useState<"checking"|"online"|"offline">("checking");
  const [aiLatency, setAiLatency] = useState<number | null>(null);

  const [dashQ, setDashQ]           = useState("");
  const [dashAnswer, setDashAnswer] = useState<AiResponse | null>(null);
  const [dashAsking, setDashAsking] = useState(false);

  const [wdAmt, setWdAmt]           = useState("");
  const [wdChecking, setWdChecking] = useState(false);
  const [wdResult, setWdResult]     = useState<WdResult | null>(null);
  const [wdNote, setWdNote]         = useState("");
  const [wdDoing, setWdDoing]       = useState(false);
  const [wdDone, setWdDone]         = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    const res = await fetch(`/api/dashboard?month=${m}`).then(r => r.json());
    setData(res);
    setLoading(false);
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  useEffect(() => {
    fetch("/api/ai/status")
      .then(r => r.json())
      .then(d => { setAiStatus(d.online ? "online" : "offline"); setAiLatency(d.latency ?? null); })
      .catch(() => setAiStatus("offline"));
  }, []);

  async function loadAI() {
    if (aiLoaded) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "Give me a complete overview of my business performance: what is selling well, what is slow, where am I losing money, and what should I focus on this month to grow?" }),
      });
      const d = await res.json();
      setAiData(d); setAiLoaded(true);
    } catch { /* silently fail */ } finally { setAiLoading(false); }
  }

  async function askFollowUp(q: string) {
    if (!q.trim() || dashAsking) return;
    setDashAsking(true); setDashAnswer(null);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await res.json();
      setDashAnswer(d);
    } catch { /* ignore */ } finally { setDashAsking(false); }
  }

  async function checkWithdrawal() {
    const amt = Number(wdAmt);
    if (!amt || amt <= 0) return;
    setWdChecking(true); setWdResult(null);
    try {
      const res = await fetch("/api/ai/withdrawal-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt }),
      });
      const d = await res.json();
      setWdResult(d);
    } catch { /* ignore */ } finally { setWdChecking(false); }
  }

  async function confirmWithdraw() {
    if (!wdResult || wdResult.verdict === "danger") return;
    setWdDoing(true);
    const res = await fetch("/api/logs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "withdrawal", amount: wdResult.withdraw_amount,
        date: new Date().toISOString().split("T")[0],
        note: wdNote.trim() || "Personal withdrawal",
      }),
    });
    setWdDoing(false);
    if (res.ok) {
      setWdDone(`LKR ${fmt(wdResult.withdraw_amount)} withdrawn successfully.`);
      setWdAmt(""); setWdResult(null); setWdNote("");
      load(month);
      setTimeout(() => setWdDone(""), 5000);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;
  if (!data) return null;

  const trendData = data.trend.map(t => ({ ...t, month: t.month.slice(5) }));
  const roi = data.total_capital_invested > 0
    ? (((data.shop_balance + data.total_stock_value - data.total_capital_invested) / data.total_capital_invested) * 100).toFixed(1)
    : "0";

  return (
    <div className="w-full space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex-1 min-w-0">Dashboard</h2>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${
          aiStatus === "online"  ? "bg-green-50 border-green-200 text-green-700" :
          aiStatus === "offline" ? "bg-red-50 border-red-200 text-red-600" :
                                   "bg-yellow-50 border-yellow-200 text-yellow-600"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            aiStatus === "online"  ? "bg-green-500" :
            aiStatus === "offline" ? "bg-red-500" :
                                     "bg-yellow-400 animate-pulse"
          }`} />
          <span>
            {aiStatus === "checking" ? "Checking AI…" :
             aiStatus === "online"   ? `AI${aiLatency ? ` ${aiLatency}ms` : ""}` :
                                       "AI Offline"}
          </span>
        </div>
        <input type="month" className="input py-1 text-sm w-32" value={month}
          onChange={e => { setMonth(e.target.value); load(e.target.value); }} />
      </div>

      {wdDone && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3 font-medium">
          💵 {wdDone}
        </div>
      )}

      {/* Two-column grid — stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-3 space-y-4">

          {/* Shop Balance */}
          <div className="card bg-gray-900 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-1">Shop Balance</p>
                <p className="text-3xl sm:text-4xl font-bold tracking-tight">LKR {fmt(data.shop_balance)}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                  <span>Start: <span className="text-gray-200 font-semibold">LKR {fmt(data.initial_savings)}</span></span>
                  {data.total_capital_added > 0 && (
                    <span>Added: <span className="text-green-400 font-semibold">LKR {fmt(data.total_capital_added)}</span></span>
                  )}
                  <span>Stock: <span className="text-blue-300 font-semibold">LKR {fmt(data.total_stock_value)}</span></span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Invested: LKR {fmt(data.total_capital_invested)} · ROI: <span className={Number(roi) >= 0 ? "text-green-400" : "text-red-400"}>{roi}%</span>
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">Safe to withdraw</p>
                <p className={`text-lg sm:text-xl font-bold ${data.safe_withdrawal > 0 ? "text-green-400" : "text-red-400"}`}>
                  LKR {fmt(data.safe_withdrawal)}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">3-month buffer</p>
              </div>
            </div>
          </div>

          {/* Monthly P&L */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard label="Money In" value={`LKR ${fmt(data.month_in)}`} color="green" subtitle={month} />
            <StatCard label="Money Out" value={`LKR ${fmt(data.month_out)}`} color="red" subtitle={month} />
            <StatCard label="Net Profit" value={`LKR ${fmt(data.net_profit)}`} color={data.net_profit >= 0 ? "emerald" : "red"} subtitle={month} />
          </div>

          {/* 6-Month Trend */}
          {data.trend.some(t => t.income > 0 || t.expenses > 0) && (
            <div className="card space-y-4">
              <p className="text-sm font-semibold text-gray-700">6-Month Trend</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip formatter={(v: number) => `LKR ${fmt2(v)}`} labelStyle={{ color: "#374151", fontWeight: 600 }} contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f87171" strokeWidth={2.5} dot={{ r: 3, fill: "#f87171" }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2, fill: "#6366f1" }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Monthly Breakdown</p>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-xs min-w-[280px]">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left pb-1">Month</th>
                        <th className="text-right pb-1">Income</th>
                        <th className="text-right pb-1">Expenses</th>
                        <th className="text-right pb-1">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...data.trend].reverse().map(t => (
                        <tr key={t.month} className={t.month === month ? "bg-blue-50" : ""}>
                          <td className="py-1.5 font-medium text-gray-700">{t.month}</td>
                          <td className="py-1.5 text-right text-green-600">{fmt(t.income)}</td>
                          <td className="py-1.5 text-right text-red-500">{fmt(t.expenses)}</td>
                          <td className={`py-1.5 text-right font-semibold ${t.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {t.net >= 0 ? "+" : ""}LKR {fmt(t.net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Top Sellers */}
          {data.top_sellers.length > 0 && (
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-3">🔥 Top Selling Items</p>
              <div className="space-y-2.5">
                {data.top_sellers.map((item, i) => {
                  const maxUnits = data.top_sellers[0].units;
                  const pct = maxUnits > 0 ? Math.round((item.units / maxUnits) * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex-shrink-0">{CAT_ICON[item.category] ?? "📦"}</span>
                          <span className="text-sm font-medium text-gray-800 truncate">{item.name}</span>
                          {i === 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Best</span>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-semibold text-gray-700">{item.units}</span>
                          <span className="text-xs text-gray-400 ml-1">{fmt(item.revenue)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Withdrawal Analyzer */}
          <div className="card space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">💸 Withdrawal Analyzer</p>
              <p className="text-xs text-gray-400 mt-0.5">Check if it&apos;s safe to withdraw</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">LKR</span>
                <input
                  type="number" min="1" step="1" placeholder="e.g. 50000"
                  className="input text-sm pl-10 w-full"
                  value={wdAmt}
                  onChange={e => { setWdAmt(e.target.value); setWdResult(null); }}
                  onKeyDown={e => e.key === "Enter" && checkWithdrawal()}
                />
              </div>
              <button onClick={checkWithdrawal} disabled={wdChecking || !wdAmt}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors">
                {wdChecking ? "…" : "Check"}
              </button>
            </div>

            {wdChecking && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            )}

            {wdResult && !wdChecking && (
              <div className={`rounded-xl border p-3 space-y-3 ${
                wdResult.verdict === "safe"  ? "bg-green-50 border-green-200" :
                wdResult.verdict === "risky" ? "bg-yellow-50 border-yellow-200" :
                                               "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{wdResult.verdict === "safe" ? "✅" : wdResult.verdict === "risky" ? "⚠️" : "❌"}</span>
                  <span className={`text-sm font-bold ${
                    wdResult.verdict === "safe" ? "text-green-700" : wdResult.verdict === "risky" ? "text-yellow-700" : "text-red-700"
                  }`}>
                    {wdResult.verdict === "safe" ? "Safe to Withdraw" : wdResult.verdict === "risky" ? "Risky — Proceed Carefully" : "Not Recommended"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/70 rounded-lg px-3 py-2">
                    <p className="text-gray-400">Before</p>
                    <p className="font-bold text-gray-800">LKR {fmt(wdResult.balance_before)}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg px-3 py-2">
                    <p className="text-gray-400">After</p>
                    <p className={`font-bold ${wdResult.balance_after >= 0 ? "text-gray-800" : "text-red-600"}`}>
                      LKR {fmt(wdResult.balance_after)}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg px-3 py-2">
                    <p className="text-gray-400">Buffer</p>
                    <p className={`font-bold ${wdResult.months_buffer_remaining >= 3 ? "text-green-700" : wdResult.months_buffer_remaining >= 1 ? "text-yellow-700" : "text-red-600"}`}>
                      {wdResult.months_buffer_remaining} months
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg px-3 py-2">
                    <p className="text-gray-400">Avg Exp</p>
                    <p className="font-bold text-gray-800">LKR {fmt(wdResult.avg_monthly_expenses)}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed">{wdResult.explanation}</p>
                <p className="text-xs text-gray-500 italic">{wdResult.consequences}</p>

                {wdResult.return_advice && (
                  <div className="bg-white/70 rounded-lg px-3 py-2 border border-white">
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">🔄 When to Return</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{wdResult.return_advice}</p>
                  </div>
                )}

                {wdResult.verdict !== "danger" && (
                  <div className="space-y-2 border-t border-white/50 pt-3">
                    <input type="text" placeholder="Note (optional)" className="input text-sm w-full"
                      value={wdNote} onChange={e => setWdNote(e.target.value)} />
                    <button onClick={confirmWithdraw} disabled={wdDoing}
                      className={`w-full text-sm font-semibold py-2.5 rounded-lg text-white transition-colors disabled:opacity-50 ${
                        wdResult.verdict === "safe" ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"
                      }`}>
                      {wdDoing ? "Processing…" : `Confirm Withdraw LKR ${fmt(wdResult.withdraw_amount)}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
        {/* END LEFT COLUMN */}

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-4">

          {/* AI Business Insights */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">🤖 AI Insights</p>
              {!aiLoaded && (
                <button onClick={loadAI} disabled={aiLoading || aiStatus === "offline"}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 font-medium disabled:opacity-50">
                  {aiLoading ? "Analyzing…" : "Get Insights"}
                </button>
              )}
            </div>

            {aiLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-3 bg-gray-100 rounded w-3/5" />
              </div>
            )}

            {aiData && !aiLoading && (
              <div className="space-y-3">
                <p className="text-xs text-gray-700 leading-relaxed">{aiData.advice}</p>

                <div className="space-y-1.5">
                  <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-green-600 mb-0.5">✅ Key Action</p>
                    <p className="text-xs text-green-800">{aiData.key_action}</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-red-600 mb-0.5">⚠️ Avoid</p>
                    <p className="text-xs text-red-800">{aiData.mistake_to_avoid}</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-purple-600 mb-0.5">🚀 Growth</p>
                    <p className="text-xs text-purple-800">{aiData.growth_priority}</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Ask a Question</p>
                  <div className="flex flex-wrap gap-1">
                    {["Best profit item?", "Reduce expenses?", "Can I expand?"].map(q => (
                      <button key={q} onClick={() => { setDashQ(q); askFollowUp(q); }}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" className="input text-xs flex-1" placeholder="Ask anything…"
                      value={dashQ} onChange={e => setDashQ(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && askFollowUp(dashQ)} />
                    <button onClick={() => askFollowUp(dashQ)} disabled={dashAsking || !dashQ.trim()}
                      className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-40 font-medium">
                      {dashAsking ? "…" : "Ask"}
                    </button>
                  </div>
                  {dashAsking && <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />}
                  {dashAnswer && !dashAsking && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
                      <p className="text-xs text-gray-700 leading-relaxed">{dashAnswer.advice}</p>
                      {dashAnswer.key_action && <p className="text-xs text-green-700 font-medium">✅ {dashAnswer.key_action}</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!aiLoaded && !aiLoading && (
              <p className="text-xs text-gray-400">Click &quot;Get Insights&quot; for AI-powered tips based on your business data.</p>
            )}
          </div>

          {/* Recent Activity */}
          {data.recent_logs.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <p className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">Recent Activity</p>
              <div className="divide-y divide-gray-50">
                {data.recent_logs.map(log => {
                  const m = TYPE_META[log.type] ?? { icon: "📎", label: log.type, in: false, out: false };
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-base flex-shrink-0">{m.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {m.label}{log.products?.name ? ` — ${log.products.name}` : ""}
                        </p>
                        <p className="text-xs text-gray-400">
                          {log.date}{log.qty ? ` · ${log.qty} units` : ""}{log.note ? ` · ${log.note}` : ""}
                        </p>
                      </div>
                      {log.amount > 0 && (
                        <span className={`text-xs font-bold flex-shrink-0 ${m.in ? "text-green-600" : m.out ? "text-red-500" : "text-gray-500"}`}>
                          {m.in ? "+" : m.out ? "−" : "·"} LKR {fmt(log.amount)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Low Stock */}
          {data.low_stock.length > 0 && (
            <div className="card border border-orange-200 bg-orange-50">
              <p className="text-sm font-semibold text-orange-700 mb-2">⚠️ Low Stock ({data.low_stock.length})</p>
              <div className="space-y-1.5">
                {data.low_stock.map(p => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">{p.name}</span>
                    <span className="text-orange-600 font-semibold">{p.quantity} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* This Month Breakdown */}
          {Object.keys(data.breakdown).length > 0 && (
            <div className="card">
              <p className="text-sm font-semibold text-gray-700 mb-3">This Month</p>
              <div className="space-y-2">
                {Object.entries(data.breakdown).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a).map(([type, amt]) => {
                  const m = TYPE_META[type] ?? { icon: "📎", label: type, in: false, out: false };
                  const pct = data.month_in > 0 && m.in ? Math.round((amt / data.month_in) * 100) : data.month_out > 0 && m.out ? Math.round((amt / data.month_out) * 100) : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{m.icon} {m.label}</span>
                        <span className={`font-semibold ${m.in ? "text-green-600" : m.out ? "text-red-500" : "text-gray-500"}`}>
                          {m.in ? "+" : m.out ? "−" : "·"} LKR {fmt(amt)}
                        </span>
                      </div>
                      {pct > 0 && (
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${m.in ? "bg-green-400" : "bg-red-400"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {data.recent_logs.length === 0 && data.month_in === 0 && data.month_out === 0 && (
            <div className="card text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">No transactions yet.</p>
            </div>
          )}

        </div>
        {/* END RIGHT COLUMN */}

      </div>
    </div>
  );
}
