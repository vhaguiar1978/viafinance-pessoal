import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBRL } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  FileBarChart,
  Repeat,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  obterCompetencia,
  gerarDespesasFixasDoMes,
  totaisDoMes,
  totaisAcumuladosConta,
  calcularSaldoConta,
} from "@/server/competencia";
import { ExportButton } from "@/components/export-button";
import { DashboardKpisECards } from "./bank-cards";

export default async function DashboardPage() {
  const user = await requireUser();
  const hoje = new Date();
  const comp = obterCompetencia(hoje.getMonth() + 1, hoje.getFullYear());
  await gerarDespesasFixasDoMes(user.id, comp.mes, comp.ano);
  const totais = await totaisDoMes(user.id, comp.mes, comp.ano);

  const contasAtivas = await prisma.conta.findMany({
    where: { userId: user.id, ativa: true },
    orderBy: [{ banco: "asc" }, { nome: "asc" }],
  });
  const contasComSaldo = await Promise.all(
    contasAtivas.map(async (c) => {
      const [
        saldoAtual,
        ultimosLancamentos,
        transfsOut,
        transfsIn,
        totaisConta,
      ] = await Promise.all([
        calcularSaldoConta(user.id, c.id),
        prisma.lancamento.findMany({
          where: {
            userId: user.id,
            contaId: c.id,
            status: { not: "cancelada" },
          },
          include: { categoria: true },
          orderBy: { data: "desc" },
          take: 5,
        }),
        prisma.transferencia.findMany({
          where: { userId: user.id, origemContaId: c.id },
          include: { destinoConta: true },
          orderBy: { data: "desc" },
          take: 5,
        }),
        prisma.transferencia.findMany({
          where: { userId: user.id, destinoContaId: c.id },
          include: { origemConta: true },
          orderBy: { data: "desc" },
          take: 5,
        }),
        totaisAcumuladosConta(user.id, c.id),
      ]);
      return {
        ...c,
        saldoAtual,
        ultimosLancamentos,
        transfsOut,
        transfsIn,
        totaisConta,
      };
    }),
  );

  const cartoes = await prisma.cartao.count({
    where: { userId: user.id, ativo: true },
  });
  const fixas = await prisma.despesaFixa.count({
    where: { userId: user.id, ativa: true },
  });

  const saldoTotalContas = contasComSaldo.reduce(
    (acc, c) => acc + c.saldoAtual,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumo de {comp.nome} de {comp.ano}
          </p>
        </div>
        <ExportButton
          tipo="demonstrativo"
          mes={comp.mes}
          ano={comp.ano}
          label="Exportar mês"
          showPrint
        />
      </div>

      {contasComSaldo.length > 0 ? (
        <DashboardKpisECards
          contas={contasComSaldo}
          saldoTotal={saldoTotalContas}
          totaisGlobais={{
            entradas: totais.entradas,
            despesasPagas: totais.despesasPagas,
            despesasAbertas: totais.despesasAbertas,
            saldoFinal: totais.saldoFinal,
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Entradas"
            value={totais.entradas}
            icon={ArrowDownRight}
            tone="success"
          />
          <KpiCard
            label="Despesas pagas"
            value={totais.despesasPagas}
            icon={ArrowUpRight}
            tone="destructive"
          />
          <KpiCard
            label="Em aberto"
            value={totais.despesasAbertas}
            icon={ArrowUpRight}
            tone="warning"
          />
          <KpiCard
            label="Saldo do mês"
            value={totais.saldoFinal}
            icon={Wallet}
            tone={totais.saldoFinal >= 0 ? "success" : "destructive"}
            highlight
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Atalhos</CardTitle>
            <CardDescription>Tudo pra organizar este mês</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <ShortcutBtn href="/demonstrativo" icon={FileBarChart}>
              Ver demonstrativo
            </ShortcutBtn>
            <ShortcutBtn href="/lancamentos/novo" icon={ArrowUpRight}>
              Novo lançamento
            </ShortcutBtn>
            <ShortcutBtn href="/despesas-fixas" icon={Repeat}>
              Despesas fixas
            </ShortcutBtn>
            <ShortcutBtn href="/investimentos" icon={TrendingUp}>
              Investimentos
            </ShortcutBtn>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sua estrutura</CardTitle>
            <CardDescription>O que você já cadastrou</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              icon={Wallet}
              label="Contas ativas"
              value={`${contasComSaldo.length}`}
            />
            <Row icon={CreditCard} label="Cartões" value={`${cartoes}`} />
            <Row icon={Repeat} label="Despesas fixas ativas" value={`${fixas}`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TIPO_LABEL: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  carteira: "Carteira",
  corretora: "Corretora",
  outra: "Outra",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "success" | "destructive" | "warning" | "info";
  highlight?: boolean;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-info";
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className={`mt-2 text-2xl font-bold ${toneClass}`}>
            {formatBRL(value)}
          </div>
        </div>
        <div className={`rounded-md bg-muted p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ShortcutBtn({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" asChild className="h-auto justify-start gap-3 p-4">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {children}
      </Link>
    </Button>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
