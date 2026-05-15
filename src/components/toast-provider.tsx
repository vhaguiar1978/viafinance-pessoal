"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";
interface Toast {
  id: number;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (t: Omit<Toast, "id">) => void;
  success: (msg: string, desc?: string) => void;
  error: (msg: string, desc?: string) => void;
  info: (msg: string, desc?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++idRef.current;
      setToasts((cur) => [...cur, { ...t, id }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const api = React.useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) =>
        show({ title, description, variant: "success" }),
      error: (title, description) =>
        show({ title, description, variant: "error" }),
      info: (title, description) =>
        show({ title, description, variant: "info" }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        {toasts.map((t) => {
          const Icon =
            t.variant === "success"
              ? CheckCircle2
              : t.variant === "error"
                ? AlertCircle
                : Info;
          return (
            <div
              key={t.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg",
                t.variant === "success" && "border-success/40",
                t.variant === "error" && "border-destructive/40",
                t.variant === "info" && "border-info/40",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  t.variant === "success" && "text-success",
                  t.variant === "error" && "text-destructive",
                  t.variant === "info" && "text-info",
                )}
              />
              <div className="flex-1">
                {t.title && (
                  <div className="text-sm font-medium">{t.title}</div>
                )}
                {t.description && (
                  <div className="text-xs text-muted-foreground">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => remove(t.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve estar dentro de ToastProvider");
  return ctx;
}
