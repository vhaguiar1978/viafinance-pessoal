"use client";
import { Menu, Moon, Sun, LogOut, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "./ui/button";
import { useTheme } from "./theme-provider";

export function AppHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
      <Button
        size="icon"
        variant="ghost"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggle}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm sm:flex">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{session?.user?.name ?? ""}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    </header>
  );
}
