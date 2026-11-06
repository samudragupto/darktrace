"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutDashboard, Radar, ShieldCheck, type LucideIcon } from "lucide-react";

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Forensic Live", href: "/demo", icon: Radar },
];

/**
 * App shell navigation. A floating left rail from lg up; brand plus a swipeable tab
 * strip on smaller screens. The wallet lives in the TopBar.
 */
export function Header() {
  const pathname = usePathname();

  return (
    <header className="shrink-0 bg-surface border border-border rounded-card shadow-card p-3 flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start lg:w-60 lg:h-[calc(100vh-2rem)] lg:gap-0 lg:p-4">
      <Link href="/" className="inline-flex items-center gap-2.5 self-start rounded-full py-1 pr-2 text-text lg:mb-8">
        <span
          aria-hidden="true"
          className="grid place-items-center w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-ink text-on-ink"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#F0B429]" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">DarkTrace</span>
          <span className="hidden sm:inline text-xs text-muted">MEV forensics</span>
        </span>
      </Link>

      <nav aria-label="Primary" className="-mx-1 overflow-x-auto no-scrollbar lg:mx-0 lg:overflow-visible">
        <ul className="flex gap-1 p-1 lg:flex-col lg:p-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-full px-3 lg:px-3.5 py-2 text-sm whitespace-nowrap transition-colors ${
                    isActive ? "bg-ink text-on-ink font-medium" : "text-muted hover:text-text hover:bg-surface-2"
                  }`}
                >
                  <Icon aria-hidden="true" className="w-4 h-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="hidden lg:flex mt-auto items-start gap-2 rounded-2xl bg-surface-2 p-3 text-xs text-muted leading-relaxed">
        <ShieldCheck aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-good" />
        Testnets only. Never connect a wallet that holds real funds.
      </p>
    </header>
  );
}
