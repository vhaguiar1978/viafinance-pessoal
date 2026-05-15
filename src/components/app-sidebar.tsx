"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  ArrowRightLeft,
  Repeat,
  FileBarChart,
  Wallet,
  CreditCard,
  Tag,
  TrendingUp,
  Target,
  Upload,
  Sparkles,
  Building2,
  FileText,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demonstrativo", label: "Demonstrativo Mensal", icon: FileBarChart },
  { href: "/analise", label: "Análise Inteligente", icon: Sparkles },
  { href: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { href: "/despesas-fixas", label: "Despesas Fixas", icon: Repeat },
  { href: "/transferencias", label: "Transferências", icon: ArrowRightLeft },
  { href: "/limites", label: "Limite Mensal", icon: Target },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/importar", label: "Importar Extrato", icon: Upload },
  { href: "/bancos-conectados", label: "Bancos Conectados", icon: Building2 },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/categorias", label: "Categorias", icon: Tag },
];

export function AppSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-base font-bold">ViaFinance</span>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 text-xs text-muted-foreground">
          ViaFinance Pessoal
        </div>
      </aside>
    </>
  );
}
