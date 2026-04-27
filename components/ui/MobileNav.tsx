"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const TAB_ITEMS = [
  { href: "/dashboard",    label: "Home",    icon: "📊" },
  { href: "/sales",        label: "Sales",   icon: "🛒" },
  { href: "/stock",        label: "Stock",   icon: "📦" },
  { href: "/advisor",      label: "Advisor", icon: "🤖" },
];

const MORE_ITEMS = [
  { href: "/rentals",      label: "Rentals",      icon: "🔁" },
  { href: "/history",      label: "History",      icon: "📋" },
  { href: "/transactions", label: "Transactions", icon: "🧾" },
  { href: "/settings",     label: "Settings",     icon: "⚙️" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch h-16 safe-area-bottom">
        {TAB_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
                active ? "text-blue-600" : "text-gray-500"
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
            isMoreActive ? "text-blue-600" : "text-gray-500"
          }`}
        >
          <span className="text-xl leading-none">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-4 pb-2 pt-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">More</p>
          <div className="grid grid-cols-2 gap-2">
            {MORE_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="px-4 pt-2 border-t border-gray-100 mt-2 safe-area-bottom space-y-1">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <span className="text-lg">🚪</span>
              Sign Out
            </button>
          </form>
          <p className="text-xs text-gray-300 text-center pb-1">v{process.env.NEXT_PUBLIC_APP_VERSION ?? "—"}</p>
        </div>
      </div>
    </>
  );
}
