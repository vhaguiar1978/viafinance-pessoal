"use client";
import { useState } from "react";
import Link from "next/link";
import type {
  Categoria,
  Conta,
  Lancamento,
  Transferencia,
} from "@prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ArrowDownRight,
  ExternalLink,
  Upload,
  X as XIcon,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  corrente: "Corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  carteira: "Carteira",
  corretora: "Corretora",
  outra: "Outra",
};

type LancamentoFull = Lancamento & {
  categoria: Categoria | null;
};
type TransfOut = Transferencia & { destinoConta: Conta };
type TransfIn = Transferencia & { origemConta: Conta };

export interface TotaisConta {
  entradas: number;
  despesasPagas: number;
  despesasAbertas: number;
  saldoMes: number;
}

export interface TotaisGlobais {
  entradas: number;
  despesasPagas: number;
  despesasAbertas: number;
  saldoFinal: number;
}

export interface ContaCompleta extends Conta {
  saldoAtual: number;
  ultimosLancamentos: LancamentoFull[];
  transfsOut: TransfOut[];
  transfsIn: TransfIn[];
  totaisConta: TotaisConta;
}

interface ItemExtrato {
  id: string;
  data: Date;
  descricao: string;
  detalhe?: string;
  valor: number;
  categoria?: Categoria | null;
  tipo: "receita" | "despesa" | "transferencia-out" | "transferencia-in";
}

function mesclar(c: ContaCompleta): ItemExtrato[] {
  const out: ItemExtrato[] = [];
  for (const l of c.ultimosLancamentos) {
    out.push({
      id: `l-${l.id}`,
      data: l.data,
      descricao: l.descricao,
      valor: l.tipo === "receita" ? l.valor : -l.valor,
      categoria: l.categoria,
      tipo: l.tipo as "receita" | "despesa",
    });
  }
  for (const t of c.transfsOut) {
    out.push({
      id: `tout-${t.id}`,
      data: t.data,
      descricao: t.descricao ?? `Transferência para ${t.destinoConta.nome}`,
      detalhe: `→ ${t.destinoConta.nome}`,
      valor: -t.valor,
      tipo: "transferencia-out",
    });
  }
  for (const t of c.transfsIn) {
    out.push({
      id: `tin-${t.id}`,
      data: t.data,
      descricao: t.descricao ?? `Transferência de ${t.origemConta.nome}`,
      detalhe: `← ${t.origemConta.nome}`,
      valor: t.valor,
      tipo: "transferencia-in",
    });
  }
  return out.sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 6);
}

export function DashboardKpisECards({
  contas,
  saldoTotal,
  totaisGlobais,
}: {
  contas: ContaCompleta[];
  saldoTotal: number;
  totaisGlobais: TotaisGlobais;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const contaAtiva = aberta ? contas.find((c) => c.id === aberta) : null;

  // KPIs mostram dados da conta selecionada, ou totais globais
  const kpis = contaAtiva
    ? {
        entradas: contaAtiva.totaisConta.entradas,
        despesasPagas: contaAtiva.totaisConta.despesasPagas,
        despesasAbertas: contaAtiva.totaisConta.despesasAbertas,
        saldo: contaAtiva.totaisConta.saldoMes,
      }
    : {
        entradas: totaisGlobais.entradas,
        despesasPagas: totaisGlobais.despesasPagas,
        despesasAbertas: totaisGlobais.despesasAbertas,
        saldo: totaisGlobais.saldoFinal,
      };

  return (
    <>
      {/* KPIs do topo — refletem conta selecionada ou totais gerais */}
      {contaAtiva && (
        <Card
          className="flex flex-row items-center justify-between gap-3 border-l-4 bg-muted/30 p-3"
          style={{ borderLeftColor: contaAtiva.cor ?? "#94a3b8" }}
        >
          <div className="flex items-center gap-2 text-sm">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
              style={{ background: contaAtiva.cor ?? "#94a3b8" }}
            >
              {contaAtiva.banco ?? TIPO_LABEL[contaAtiva.tipo]}
            </span>
            <span className="font-medium">{contaAtiva.nome}</span>
            <span className="text-muted-foreground">
              — todas as movimentações da conta
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAberta(null)}
            aria-label="Limpar filtro"
          >
            <XIcon className="h-3.5 w-3.5" /> Ver tudo
          </Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Entradas"
          value={kpis.entradas}
          icon={ArrowDownRight}
          tone="success"
        />
        <KpiCard
          label="Despesas pagas"
          value={kpis.despesasPagas}
          icon={ArrowUpRight}
          tone="destructive"
        />
        <KpiCard
          label="Em aberto"
          value={kpis.despesasAbertas}
          icon={ArrowUpRight}
          tone="warning"
        />
        <KpiCard
          label={contaAtiva ? "Saldo atual" : "Saldo do mês"}
          value={contaAtiva ? contaAtiva.saldoAtual : kpis.saldo}
          icon={Wallet}
          tone={
            (contaAtiva ? contaAtiva.saldoAtual : kpis.saldo) >= 0
              ? "success"
              : "destructive"
          }
          highlight
        />
      </div>

      {/* Cards de contas + extrato inline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Minhas contas</CardTitle>
            <CardDescription>
              Saldo total:{" "}
              <b className="text-foreground">{formatBRL(saldoTotal)}</b> •
              clique numa conta pra filtrar os totais acima
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/contas">Gerenciar</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contas.map((c) => {
              const ativa = aberta === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAberta(ativa ? null : c.id)}
                  className={`group relative overflow-hidden rounded-lg border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-md ${
                    ativa ? "border-primary/60 shadow-md" : ""
                  }`}
                >
                  <div
                    className="absolute left-0 top-0 h-full w-1.5"
                    style={{ background: c.cor ?? "#94a3b8" }}
                  />
                  <div className="ml-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                        style={{ background: c.cor ?? "#94a3b8" }}
                      >
                        {c.banco ?? TIPO_LABEL[c.tipo] ?? c.tipo}
                      </span>
                      {ativa ? (
                        <ChevronUp className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{c.nome}</div>
                    <div
                      className={`text-xl font-bold ${c.saldoAtual >= 0 ? "text-foreground" : "text-destructive"}`}
                    >
                      {formatBRL(c.saldoAtual)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {ativa
                        ? "Toque para fechar"
                        : "Toque para filtrar e ver extrato →"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Extrato inline da conta aberta */}
          {contaAtiva &&
            (() => {
              const itens = mesclar(contaAtiva);
              return (
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                        style={{ background: contaAtiva.cor ?? "#94a3b8" }}
                      >
                        {contaAtiva.banco ?? TIPO_LABEL[contaAtiva.tipo]}
                      </span>
                      <span className="font-semibold">{contaAtiva.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        últimas movimentações
                      </span>
                    </div>
                    <Link
                      href={`/contas/${contaAtiva.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Ver extrato completo
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  {itens.length === 0 ? (
                    <div className="space-y-3 py-6 text-center">
                      <div className="text-sm text-muted-foreground">
                        Nenhuma movimentação ainda nesta conta.
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/importar">
                          <Upload className="h-3.5 w-3.5" /> Importar extrato
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {itens.map((it) => {
                        const isEntrada = it.valor > 0;
                        const isTransf =
                          it.tipo === "transferencia-in" ||
                          it.tipo === "transferencia-out";
                        return (
                          <li
                            key={it.id}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <div className="flex flex-1 items-center gap-2">
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                  isTransf
                                    ? "bg-info/15 text-info"
                                    : isEntrada
                                      ? "bg-success/20 text-success"
                                      : "bg-destructive/15 text-destructive"
                                }`}
                              >
                                {isTransf ? (
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                ) : isEntrada ? (
                                  <ArrowDownLeft className="h-3.5 w-3.5" />
                                ) : (
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate font-medium">
                                    {it.descricao}
                                  </span>
                                  {it.categoria && (
                                    <span
                                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                      style={{
                                        background:
                                          it.categoria.cor ?? "#94a3b8",
                                      }}
                                    >
                                      {it.categoria.nome}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatDateBR(it.data)}
                                  {it.detalhe && ` • ${it.detalhe}`}
                                </div>
                              </div>
                            </div>
                            <div
                              className={`shrink-0 text-sm font-bold ${
                                isEntrada ? "text-success" : "text-destructive"
                              }`}
                            >
                              {isEntrada ? "+" : "−"}{" "}
                              {formatBRL(Math.abs(it.valor))}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}
        </CardContent>
      </Card>
    </>
  );
}

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
