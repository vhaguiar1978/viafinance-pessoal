"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { AppHeader } from "./app-header";
import { MobileTabBar } from "./mobile-tabbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  function handleQuickAdd() {
    router.push("/lancamentos?novo=1");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onOpenSidebar={() => setOpen(true)} />
        <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">{children}</main>
      </div>
      <MobileTabBar
        onOpenMenu={() => setOpen(true)}
        onQuickAdd={handleQuickAdd}
      />
    </div>
  );
}
