import { Badge } from "@/components/ui/badge";

const STATUS_INFO: Record<
  string,
  { label: string; variant: "secondary" | "success" | "warning" | "info" | "muted" | "destructive" }
> = {
  prevista: { label: "Prevista", variant: "info" },
  confirmada: { label: "Confirmada", variant: "warning" },
  paga: { label: "Paga", variant: "success" },
  atrasada: { label: "Atrasada", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "muted" },
  "aguardando-real": { label: "Aguardando valor real", variant: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const info = STATUS_INFO[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}
