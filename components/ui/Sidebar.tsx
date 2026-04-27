"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",    icon: "📊" },
  { href: "/sales",        label: "Sales",        icon: "🛒" },
  { href: "/rentals",      label: "Rentals",      icon: "🔁" },
  { href: "/stock",        label: "Stock",        icon: "📦" },
  { href: "/history",      label: "History",      icon: "📋" },
  { href: "/transactions", label: "Transactions", icon: "🧾" },
  { href: "/advisor",      label: "AI Advisor",   icon: "🤖" },
  { href: "/settings",     label: "Settings",     icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-100">
        <h1 className="font-bold text-gray-900 text-sm leading-tight">
          Business<br />Manager
        </h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <span>🚪</span> Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
