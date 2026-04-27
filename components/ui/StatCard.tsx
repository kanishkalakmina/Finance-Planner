interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  color?: "green" | "red" | "blue" | "purple" | "emerald" | "gray";
  className?: string;
}

const COLOR_MAP: Record<string, string> = {
  green:   "text-green-600",
  red:     "text-red-500",
  blue:    "text-blue-600",
  purple:  "text-purple-600",
  emerald: "text-emerald-600",
  gray:    "text-gray-800",
};

export default function StatCard({ label, value, subtitle, color = "gray", className = "" }: StatCardProps) {
  return (
    <div className={`card text-center ${className}`}>
      <p className="text-xs text-gray-400 leading-tight">{label}</p>
      <p className={`text-sm sm:text-base font-bold mt-0.5 leading-snug break-words ${COLOR_MAP[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
