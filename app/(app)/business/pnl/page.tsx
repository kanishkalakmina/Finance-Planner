"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface PnL {
  month: string;
  total_income: number;
  total_expenses: number;
  withdrawals: number;
  funding_in: number;
  net_profit: number;
  profit_margin: number;
  income_breakdown: Record<string, number>;
  expense_breakdown: Record<string, number>;
  income_count: number;
  expense_count: number;
}

interface BalanceHistory {
  current_balance: number;
  history: { month: string; income: number; expenses: number; net: number; balance: number }[];
}

function fmt(n: number) {
  return n.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

const INCOME_META: Record<string, { label: string; color: string; fill: string }> = {
  sales:   { label: "Sales",         color: "text-green-700 bg-green-50",   fill: "#16a34a" },
  service: { label: "Service",       color: "text-blue-700 bg-blue-50",     fill: "#2563eb" },
  rental:  { label: "Rental Income", color: "text-purple-700 bg-purple-50", fill: "#9333ea" },
  other:   { label: "Other",         color: "text-gray-700 bg-gray-50",     fill: "#6b7280" },
};

const EXPENSE_META: Record<string, { label: string; color: string; fill: string }> = {
  stock:     { label: "Stock",     color: "text-orange-700 bg-orange-50", fill: "#ea580c" },
  utilities: { label: "Utilities", color: "text-purple-700 bg-purple-50", fill: "#9333ea" },
  transport: { label: "Transport", color: "text-blue-700 bg-blue-50",     fill: "#2563eb" },
  wages:     { label: "Wages",     color: "text-red-700 bg-red-50",       fill: "#dc2626" },
  rent:      { label: "Rent",      color: "text-yellow-700 bg-yellow-50", fill: "#ca8a04" },
  marketing: { label: "Marketing", color: "text-pink-700 bg-pink-50",     fill: "#db2777" },
  other:     { label: "Other",     color: "text-gray-700 bg-gray-50",     fill: "#6b7280" },
};

export default function BusinessPnLPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pnl, setPnl] = useState<PnL | null>(null);
  const [balance, setBalance] = useState<BalanceHistory | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((m: string) => {
    setLoading(true);
    Promise.all([
      fetch(`/api/business/pnl?month=${m}`).then(r => r.json()),
      fetch("/api/business/balance").then(r => r.json()),
    ]).then(([p, b]) => {
      setPnl(p);
      setBalance(b);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  if (loading) return <div className="text-gray-400 text-sm p-6">Loading…</div>;

  const incomeEntries = Object.entries(pnl?.income_breakdown ?? {});
  const expenseEntries = Object.entries(pnl?.expense_breakdown ?? {});
  const totalIncome = pnl?.total_income ?? 0;
  const totalExpenses = pnl?.total_expenses ?? 0;
  const netProfit = pnl?.net_profit ?? 0;
  const withdrawals = pnl?.withdrawals ?? 0;

  const incomePieData = incomeEntries.map(([src, amt]) => ({
    name: INCOME_META[src]?.label ?? src,
    value: amt,
    fill: INCOME_META[src]?.fill ?? "#6b7280",
  }));

  const expensePieData = expenseEntries.map(([cat, amt]) => ({
    name: EXPENSE_META[cat]?.label ?? cat,
    value: amt,
    fill: EXPENSE_META[cat]?.fill ?? "#6b7280",
  }));

  const historyData = (balance?.history ?? []).map(h => ({
    month: h.month.slice(5),
    income: h.income,
    expenses: h.expenses,
    balance: h.balance,
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/business" className="text-gray-400 hover:text-gray-600 text-sm">← Business Wallet</Link>
        <h2 className="text-2xl font-bold text-gray-900">P&amp;L Report</h2>
        <div className="ml-auto">
          <input
            type="month"
            className="input py-1.5 text-sm w-36"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl px-4 py-3 bg-green-600 text-white">
          <p className="text-xs opacity-75">Total Income</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(totalIncome)}</p>
          <p className="text-xs opacity-60">{pnl?.income_count} entries</p>
        </div>
        <div className="rounded-xl px-4 py-3 bg-red-500 text-white">
          <p className="text-xs opacity-75">Total Expenses</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(totalExpenses)}</p>
          <p className="text-xs opacity-60">{pnl?.expense_count} entries</p>
        </div>
        <div className="rounded-xl px-4 py-3 bg-blue-600 text-white">
          <p className="text-xs opacity-75">Personal Withdrawals</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(withdrawals)}</p>
          <p className="text-xs opacity-60">Business → Personal Savings</p>
        </div>
        <div className={`rounded-xl px-4 py-3 text-white ${netProfit >= 0 ? "bg-emerald-700" : "bg-orange-600"}`}>
          <p className="text-xs opacity-75">Net Profit / Loss</p>
          <p className="text-xl font-bold mt-0.5">LKR {fmt(netProfit)}</p>
          <p className="text-xs opacity-60">{(pnl?.profit_margin ?? 0).toFixed(1)}% margin</p>
        </div>
      </div>

      {/* Cash Balance (all-time) */}
      <div className={`rounded-2xl px-5 py-4 text-white ${(balance?.current_balance ?? 0) >= 0 ? "bg-green-700" : "bg-red-600"}`}>
        <p className="text-xs font-medium opacity-75 uppercase tracking-wide">Business Cash Balance (All Time)</p>
        <p className="text-3xl font-bold mt-1">LKR {fmt(balance?.current_balance ?? 0)}</p>
        <p className="text-xs opacity-60 mt-1">Cumulative: Funding + Income − Expenses − Withdrawals</p>
      </div>

      {/* Income breakdown */}
      {incomeEntries.length > 0 && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Income Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {incomeEntries.map(([src, amt]) => {
                const meta = INCOME_META[src] ?? INCOME_META.other;
                const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0;
                return (
                  <div key={src}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="text-sm font-medium text-gray-700">LKR {fmt(amt)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {incomePieData.length > 1 && (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={incomePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={false}>
                    {incomePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `LKR ${fmt(v)}`} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Expense breakdown */}
      {expenseEntries.length > 0 && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Expense Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {expenseEntries.map(([cat, amt]) => {
                const meta = EXPENSE_META[cat] ?? EXPENSE_META.other;
                const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="text-sm font-medium text-gray-700">LKR {fmt(amt)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {expensePieData.length > 1 && (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={false}>
                    {expensePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `LKR ${fmt(v)}`} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Balance history chart */}
      {historyData.length > 1 && (
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Business Balance History</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={historyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtShort} width={50} />
              <Tooltip formatter={(v: number) => `LKR ${fmt(v)}`} />
              <Area type="monotone" dataKey="balance" stroke="#16a34a" fill="url(#balGrad)" name="Balance" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {totalIncome === 0 && totalExpenses === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-sm">No income or expenses recorded for {month}.</p>
          <p className="text-xs mt-1">Go to Business Wallet to log entries.</p>
        </div>
      )}
    </div>
  );
}
