import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon = "📭", title, description, action }: EmptyStateProps) {
  return (
    <div className="card text-center py-10 text-gray-400 space-y-2">
      <p className="text-3xl">{icon}</p>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {description && <p className="text-xs">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
