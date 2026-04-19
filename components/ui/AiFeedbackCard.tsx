"use client";

export interface AiFeedback {
  status: "good" | "warning" | "critical";
  message: string;
  suggestion: string;
}

interface Props {
  feedback: AiFeedback | null;
  loading: boolean;
  onDismiss?: () => void;
}

const STATUS_CONFIG = {
  good:     { icon: "✅", label: "Looking Good",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-800",  badge: "bg-green-100 text-green-700"  },
  warning:  { icon: "⚠️",  label: "Heads Up",      bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-800", badge: "bg-yellow-100 text-yellow-700" },
  critical: { icon: "🔴", label: "Take Action",   bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800",    badge: "bg-red-100 text-red-700"      },
};

export default function AiFeedbackCard({ feedback, loading, onDismiss }: Props) {
  if (!loading && !feedback) return null;

  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-center gap-3 animate-pulse">
        <div className="text-xl">🤖</div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-blue-600 mb-1">AI Advisor analyzing…</div>
          <div className="h-3 bg-blue-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-blue-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!feedback) return null;
  const cfg = STATUS_CONFIG[feedback.status];

  return (
    <div className={`mt-3 rounded-xl border ${cfg.border} ${cfg.bg} p-3 relative`}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-sm leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
      <div className="flex items-start gap-2">
        <span className="text-lg mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">AI Advisor</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          </div>
          <p className={`text-sm font-medium ${cfg.text} mb-1`}>{feedback.message}</p>
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Suggestion:</span> {feedback.suggestion}
          </p>
        </div>
      </div>
    </div>
  );
}
