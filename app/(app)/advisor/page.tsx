"use client";

import { useState } from "react";

interface AiResponse {
  advice: string;
  business_paths: string[];
  key_action: string;
  mistake_to_avoid: string;
  growth_priority: string;
}

const QUICK_QUESTIONS = [
  "What products should I focus on selling more?",
  "How can I improve my profit margin?",
  "Which expenses can I reduce?",
  "Is my business growing or declining?",
  "What should I restock first?",
  "How is my rental business performing?",
  "What new business paths can I explore?",
  "Which category makes the most profit?",
  "What are my slow-moving products?",
  "How can I increase rental income?",
];

export default function AdvisorPage() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true); setError(""); setResponse(null);
    try {
      const res = await fetch("/api/ai/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to get advice"); return; }
      setResponse(data);
    } catch {
      setError("Could not connect to AI advisor. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">AI Advisor</h2>
        <p className="text-sm text-gray-400 mt-1">Reads all your sales, stock, rentals & expenses to give specific advice.</p>
      </div>

      {/* Quick questions */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Questions</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => { setQuestion(q); ask(q); }}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors font-medium">
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Custom question */}
      <div className="card space-y-3">
        <label className="label">Ask the AI Advisor</label>
        <div className="flex gap-2">
          <input type="text" className="input flex-1"
            placeholder="e.g. Which product gives me the best profit margin?"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask(question)}
          />
          <button onClick={() => ask(question)} disabled={loading || !question.trim()}
            className="btn-primary text-sm px-4 disabled:opacity-50">
            {loading ? "…" : "Ask"}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      {loading && (
        <div className="card space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
        </div>
      )}

      {response && !loading && (
        <div className="space-y-4">
          {/* Main advice */}
          <div className="card space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">🤖 AI Analysis</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{response.advice}</p>
          </div>

          {/* Business paths */}
          {response.business_paths?.length > 0 && (
            <div className="card space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Business Opportunities</p>
              <div className="space-y-2">
                {response.business_paths.map((path, i) => (
                  <div key={i} className="flex gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
                    <span className="text-blue-500 font-bold flex-shrink-0">→</span>
                    <p className="text-sm text-blue-800">{path}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3 action cards */}
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">✅ Key Action</p>
              <p className="text-sm font-medium text-green-800">{response.key_action}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">⚠️ Mistake to Avoid</p>
              <p className="text-sm font-medium text-red-800">{response.mistake_to_avoid}</p>
            </div>
            <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">🚀 Growth Priority</p>
              <p className="text-sm font-medium text-purple-800">{response.growth_priority}</p>
            </div>
          </div>
        </div>
      )}

      {!response && !loading && !error && (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-sm font-medium">Your AI Business Advisor</p>
          <p className="text-xs mt-1">Ask a question above or pick one of the quick options</p>
          <p className="text-xs mt-1 text-gray-300">Reads all your sales, stock, rentals & expenses</p>
        </div>
      )}
    </div>
  );
}
