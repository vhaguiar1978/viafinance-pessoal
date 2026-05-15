import { requireUser } from "@/lib/session";
import { gerarAnalises } from "@/server/analise";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nomeMes } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  Target,
  CreditCard,
  Repeat,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface Props {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

const AREA_ICONS: Record<string, React.ElementType> = {
  limite: Target,
  cartao: CreditCard,
  fixas: Repeat,
  assinaturas: Tag,
  carteira: TrendingUp,
  metas: Target,
  fluxo: Wallet,
};

const SEV_INFO: Record<
  string,
  { icon: React.ElementType; bg: string; text: string; border: string }
> = {
  info: {
    icon: Info,
    bg: "bg-info/10",
    text: "text-info",
    border: "border-info/30",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning/10",
    text: "text-warning",
    border: "border-warning/40",
  },
  danger: {
    icon: AlertTriangle,
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/40",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
  },
};

export default async function AnalisePage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;
  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();

  const items = await gerarAnalises(user.id, mes, ano);

  // Agrupa por severidade
  const ordem = ["danger", "warning", "info", "success"] as const;
  const grupos = ordem.map((sev) => ({
    sev,
    items: items.filter((i) => i.severidade === sev),
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Análise Inteligente
          </h1>
          <p className="text-sm text-muted-foreground">
            Insights educativos para {nomeMes(mes)} de {ano}
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <b>Importante:</b> as análises são educativas e baseadas nos seus
        próprios dados. Não substituem orientação profissional de um consultor
        financeiro.
      </div>

      {grupos.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.sev}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {g.sev === "danger"
                  ? "Atenção urgente"
                  : g.sev === "warning"
                    ? "Vale revisar"
                    : g.sev === "info"
                      ? "Para reflexão"
                      : "Coisas boas"}
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {g.items.map((item) => {
                  const sev = SEV_INFO[item.severidade];
                  const SevIcon = sev.icon;
                  const AreaIcon = AREA_ICONS[item.area] ?? Info;
                  return (
                    <Card key={item.id} className={`${sev.border} border`}>
                      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                        <div className={`rounded-md p-2 ${sev.bg} ${sev.text}`}>
                          <SevIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-sm font-semibold">
                            {item.titulo}
                          </CardTitle>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                            <AreaIcon className="h-3 w-3" /> {item.area}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 text-sm">
                        {item.detalhe}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ),
      )}
    </div>
  );
}
