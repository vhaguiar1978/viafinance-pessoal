"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileBarChart,
  CreditCard,
  TrendingUp,
  Menu,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: React.ElementType;
  match?: string[];
}

// Spec item 2: Menu mobile — Início, Lançar (FAB), Cartões, Investimentos, Mais
const tabs: Tab[] = [
  {
    href: "/dashboard",
    label: "Início",
    icon: Home,
    match: ["/dashboard", "/demonstrativo"],
  },
  // posição central reservada para o FAB (Lançar)
  { href: "/cartoes", label: "Cartões", icon: CreditCard, match: ["/cartoes"] },
  {
    href: "/investimentos",
    label: "Invest.",
    icon: TrendingUp,
    match: ["/investimentos"],
  },
];

export function MobileTabBar({
  onOpenMenu,
  onQuickAdd,
}: {
  onOpenMenu: () => void;
  onQuickAdd: () => void;
}) {
  const pathname = usePathname() ?? "";

  function isActive(t: Tab) {
    const arr = t.match ?? [t.href];
    return arr.some((p) => pathname === p || pathname.startsWith(p + "/"));
  }

  return (
    <>
      {/* FAB de lançamento rápido (acima do tab bar) */}
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label="Lançar gasto"
        className="fixed bottom-[68px] left-1/2 z-40 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Tab bar inferior — apenas mobile */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur lg:hidden"
        aria-label="Navegação principal"
      >
        <ul className="mx-auto flex max-w-md items-center justify-between">
          <TabItem tab={tabs[0]} active={isActive(tabs[0])} />
          <TabItem tab={tabs[1]} active={isActive(tabs[1])} />
          {/* placeholder central do FAB */}
          <li className="flex-1" aria-hidden />
          <TabItem tab={tabs[2]} active={isActive(tabs[2])} />
          <li className="flex-1">
            <button
              type="button"
              onClick={onOpenMenu}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium",
                "text-muted-foreground hover:text-foreground",
              )}
              aria-label="Mais"
            >
              <Menu className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <li className="flex-1">
      <Link
        href={tab.href}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{tab.label}</span>
      </Link>
    </li>
  );
}
