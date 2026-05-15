"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  Cartao,
  Categoria,
  Conta,
  Lancamento,
  Transferencia,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/utils";

type LancamentoFull = Lancamento & {
  categoria: Categoria | null;
  cartao: Cartao | null;
};
type TransfFull = Transferencia & { destinoConta?: Conta; origemConta?: Conta };

interface Props {
  conta: Conta;
  lancamentos: LancamentoFull[];
  transferenciasEnviadas: (Transferencia & { destinoConta: Conta })[];
  transferenciasRecebidas: (Transferencia & { origemConta: Conta })[];
}

const TIPO_LABEL: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  carteira: "Carteira",
  corretora: "Corretora",
  outra: "Outra",
};

interface ItemExtrato {
  id: string;
  data: Date;
  descricao: string;
  detalhe?: string;
  valor: number; // positivo = entrada, negativo = saída
  tipo: "receita" | "despesa" | "transferencia-out" | "transferencia-in";
  status?: string;
  categoria?: Categoria | null;
  cartao?: Cartao | null;
}

export function ContaDetalheClient({
  conta,
  lancamentos,
  transferenciasEnviadas,
  transferenciasRecebidas,
}: Props) {
  const [filtroTipo, setFiltroTipo] = useState<
    "todos" | "entradas" | "saidas" | "transferencias"
  >("todos");
  const [busca, setBusca] = useState("");

  // Unifica lançamentos e transferências em um extrato ordenado
  const todos = useMemo<ItemExtrato[]>(() => {
    const out: ItemExtrato[] = [];

    for (const l of lancamentos) {
      if (l.status === "cancelada") continue;
      out.push({
        id: `l-${l.id}`,
        data: l.data,
        descricao: l.descricao,
        valor: l.tipo === "receita" ? l.valor : -l.valor,
        tipo: l.tipo as "receita" | "despesa",
        status: l.status,
        categoria: l.categoria,
        cartao: l.cartao,
      });
    }

    for (const t of transferenciasEnviadas) {
      out.push({
        id: `tout-${t.id}`,
        data: t.data,
        descricao: t.descricao ?? `Transferência para ${t.destinoConta.nome}`,
        detalhe: `→ ${t.destinoConta.nome}`,
        valor: -t.valor,
        tipo: "transferencia-out",
      });
    }

    for (const t of transferenciasRecebidas) {
      out.push({
        id: `tin-${t.id}`,
        data: t.data,
        descricao: t.descricao ?? `Transferência de ${t.origemConta.nome}`,
        detalhe: `← ${t.origemConta.nome}`,
        valor: t.valor,
        tipo: "transferencia-in",
      });
    }

    return out.sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [lancamentos, transferenciasEnviadas, transferenciasRecebidas]);

  // Saldo atual = saldo inicial + soma de tudo
  const saldoAtual = useMemo(() => {
    return conta.saldoInicial + todos.reduce((acc, i) => acc + i.valor, 0);
  }, [conta.saldoInicial, todos]);

  // Estatísticas
  const entradasMes = useMemo(() => {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return todos
      .filter((i) => i.valor > 0 && i.data >= ini)
      .reduce((acc, i) => acc + i.valor, 0);
  }, [todos]);

  const saidasMes = useMemo(() => {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return todos
      .filter((i) => i.valor < 0 && i.data >= ini)
      .reduce((acc, i) => acc + Math.abs(i.valor), 0);
  }, [todos]);

  // Aplica filtros
  const filtrados = useMemo(() => {
    return todos.filter((i) => {
      if (filtroTipo === "entradas" && i.valor <= 0) return false;
      if (filtroTipo === "saidas" && i.valor >= 0) return false;
      if (
        filtroTipo === "transferencias" &&
        i.tipo !== "transferencia-in" &&
        i.tipo !== "transferencia-out"
      )
        return false;
      if (busca && !i.descricao.toLowerCase().includes(busca.toLowerCase()))
        return false;
      return true;
    });
  }, [todos, filtroTipo, busca]);

  // Calcula saldo "em runtime" mostrando o saldo após cada lançamento (do mais recente para o mais antigo)
  const itemsComSaldo = useMemo(() => {
    const sortedAsc = [...todos].sort(
      (a, b) => a.data.getTime() - b.data.getTime(),
    );
    let saldo = conta.saldoInicial;
    const map = new Map<string, number>();
    for (const i of sortedAsc) {
      saldo += i.valor;
      map.set(i.id, saldo);
    }
    return map;
  }, [todos, conta.saldoInicial]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Cabeçalho com cor da conta */}
      <Card className="overflow-hidden">
        <div
          className="h-2 w-full"
          style={{ background: conta.cor ?? "#94a3b8" }}
        />
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                href="/contas"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
              >
                <ArrowLeft className="h-3 w-3" /> voltar
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                  style={{ background: conta.cor ?? "#94a3b8" }}
                >
                  {TIPO_LABEL[conta.tipo] ?? conta.tipo}
                  {conta.banco ? ` • ${conta.banco}` : ""}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight">
                {conta.nome}
              </h1>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Saldo atual
              </div>
              <div
                className={`mt-1 text-xl font-bold ${saldoAtual >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatBRL(saldoAtual)}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                Saldo inicial: {formatBRL(conta.saldoInicial)}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Entradas do mês
              </div>
              <div className="mt-1 text-xl font-bold text-success">
                {formatBRL(entradasMes)}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Saídas do mês
              </div>
              <div className="mt-1 text-xl font-bold text-destructive">
                {formatBRL(saidasMes)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex rounded-md border bg-muted/20 p-0.5">
              {(
                [
                  { v: "todos", label: "Tudo" },
                  { v: "entradas", label: "↓ Entradas" },
                  { v: "saidas", label: "↑ Saídas" },
                  { v: "transferencias", label: "⇄ Transferências" },
                ] as const
              ).map((opt) => (
                <button
                  type="button"
                  key={opt.v}
                  onClick={() => setFiltroTipo(opt.v)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                    filtroTipo === opt.v
                      ? opt.v === "entradas"
                        ? "bg-success/20 text-success shadow-sm"
                        : opt.v === "saidas"
                          ? "bg-destructive/15 text-destructive shadow-sm"
                          : opt.v === "transferencias"
                            ? "bg-info/15 text-info shadow-sm"
                            : "bg-background shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição..."
              className="h-9 text-xs"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            <b className="text-foreground">{filtrados.length}</b> movimentação(ões)
          </div>
        </CardContent>
      </Card>

      {/* Extrato */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extrato</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma movimentação nesta conta.
            </div>
          ) : (
            <ul className="divide-y">
              {filtrados.map((i) => {
                const saldoNoMomento = itemsComSaldo.get(i.id);
                const isEntrada = i.valor > 0;
                const isTransf =
                  i.tipo === "transferencia-in" ||
                  i.tipo === "transferencia-out";
                return (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-3 p-3"
                  >
                    <div className="flex flex-1 items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          isTransf
                            ? "bg-info/15 text-info"
                            : isEntrada
                              ? "bg-success/20 text-success"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {isTransf ? (
                          <ArrowRightLeft className="h-4 w-4" />
                        ) : isEntrada ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{i.descricao}</span>
                          {i.status && i.status !== "paga" && (
                            <StatusBadge status={i.status} />
                          )}
                          {i.categoria && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                              style={{
                                background: i.categoria.cor ?? "#94a3b8",
                              }}
                            >
                              {i.categoria.nome}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {formatDateBR(i.data)}
                          {i.detalhe && ` • ${i.detalhe}`}
                          {i.cartao && ` • ${i.cartao.nome}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-base font-bold ${
                          isEntrada ? "text-success" : "text-destructive"
                        }`}
                      >
                        {isEntrada ? "+" : "−"} {formatBRL(Math.abs(i.valor))}
                      </div>
                      {saldoNoMomento !== undefined && (
                        <div className="text-[10px] text-muted-foreground">
                          saldo: {formatBRL(saldoNoMomento)}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
