"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Cartao,
  Categoria,
  Conta,
  DespesaFixa,
  DespesaFixaMensal,
  Investimento,
  Lancamento,
  CardInstallment,
  CardPurchase,
  Transferencia,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Repeat,
  ArrowLeftRight,
  CreditCard,
  Layers,
  TrendingUp,
  Wallet,
  CheckCircle2,
  PencilLine,
  Tag,
  CircleDollarSign,
  Target,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import {
  formatBRL,
  formatDateBR,
  competenciaKey,
  nomeMes,
} from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import {
  alterarStatusOcorrencia,
  informarValorReal,
  excluirOcorrencia,
} from "@/server/actions/despesas-fixas";
import {
  excluirLancamento,
  marcarLancamentoPago,
} from "@/server/actions/lancamentos";
import { marcarParcelaPaga } from "@/server/actions/card-purchases";
import { ExportButton } from "@/components/export-button";
import {
  GraficoCategorias,
  GraficoComparacao,
  GraficoEvolucaoMes,
} from "@/components/charts";
import type { TotaisMes } from "@/server/competencia";

type LancamentoFull = Lancamento & {
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
};
type OcorrenciaFull = DespesaFixaMensal & {
  despesaFixa: DespesaFixa & {
    categoria: Categoria | null;
    conta: Conta | null;
    cartao: Cartao | null;
  };
};
type InvestFull = Investimento & { conta: Conta | null };
type CardInstallmentFull = CardInstallment & {
  purchase: CardPurchase & {
    categoria: Categoria | null;
    cartao: Cartao;
  };
};
type TransferenciaFull = Transferencia & {
  origemConta: Conta;
  destinoConta: Conta;
};

interface Props {
  mes: number;
  ano: number;
  nomeMes: string;
  totais: TotaisMes;
  lancamentos: LancamentoFull[];
  ocorrencias: OcorrenciaFull[];
  investimentos: InvestFull[];
  cardInstallments: CardInstallmentFull[];
  transferencias: TransferenciaFull[];
  categorias: Categoria[];
  contas: Conta[];
  cartoes: Cartao[];
}

const ANOS = Array.from({ length: 10 }, (_, i) => 2023 + i);

type FiltroStatus = "todos" | "pagas" | "abertas" | "atrasadas" | "previstas";

interface ItemUnificado {
  id: string;
  origemTipo: "lancamento" | "fixa" | "card";
  origemId: string;
  descricao: string;
  valor: number;
  valorPrevisto?: number;
  valorReal?: number | null;
  ehPrevisao?: boolean;
  data: Date;
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
  status: string;
  tipo: "despesa" | "receita";
  grupo:
    | "fixas"
    | "variaveis"
    | "cartao"
    | "parcelas"
    | "assinaturas"
    | "investimentos"
    | "entradas"
    | "transferencias";
  ehFixaVariavel?: boolean;
}

export function DemonstrativoClient({
  mes,
  ano,
  nomeMes: nomeMesProp,
  totais,
  lancamentos,
  ocorrencias,
  investimentos,
  cardInstallments,
  transferencias,
  categorias,
  contas,
  cartoes,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroConta, setFiltroConta] = useState<string>("todas");
  const [filtroCartao, setFiltroCartao] = useState<string>("todos");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("todos");

  const [valorRealDialog, setValorRealDialog] = useState<OcorrenciaFull | null>(
    null,
  );
  const [valorRealInput, setValorRealInput] = useState(0);
  const [busy, setBusy] = useState(false);

  function navegar(deltaMes: number) {
    let nm = mes + deltaMes;
    let na = ano;
    if (nm < 1) {
      nm = 12;
      na -= 1;
    }
    if (nm > 12) {
      nm = 1;
      na += 1;
    }
    router.push(`/demonstrativo?mes=${nm}&ano=${na}`);
  }

  function escolherCompetencia(m: number, a: number) {
    router.push(`/demonstrativo?mes=${m}&ano=${a}`);
  }

  // Unifica itens em uma lista única com agrupamento
  const itens = useMemo<ItemUnificado[]>(() => {
    const out: ItemUnificado[] = [];

    for (const o of ocorrencias) {
      const cat =
        o.categoriaIdOverride
          ? categorias.find((c) => c.id === o.categoriaIdOverride) ?? null
          : o.despesaFixa.categoria;
      const conta =
        o.contaIdOverride
          ? contas.find((c) => c.id === o.contaIdOverride) ?? null
          : o.despesaFixa.conta;
      const cartao =
        o.cartaoIdOverride
          ? cartoes.find((c) => c.id === o.cartaoIdOverride) ?? null
          : o.despesaFixa.cartao;
      const valor = o.valorReal ?? o.valorPrevisto;
      out.push({
        id: `fixa-${o.id}`,
        origemTipo: "fixa",
        origemId: o.id,
        descricao: o.descricaoOverride ?? o.despesaFixa.descricao,
        valor,
        valorPrevisto: o.valorPrevisto,
        valorReal: o.valorReal,
        ehPrevisao: o.valorReal === null,
        ehFixaVariavel: o.despesaFixa.tipoValor === "variavel",
        data: o.dataVencimento,
        categoria: cat,
        conta,
        cartao,
        status:
          o.despesaFixa.tipoValor === "variavel" && o.valorReal === null
            ? "aguardando-real"
            : o.status,
        tipo: "despesa",
        grupo: "fixas",
      });
    }

    for (const l of lancamentos) {
      let grupo: ItemUnificado["grupo"] = "variaveis";
      if (l.tipo === "receita") grupo = "entradas";
      else if (l.parcelaGrupoId) grupo = "parcelas";
      else if (l.ehAssinatura) grupo = "assinaturas";
      else if (l.cartaoId) grupo = "cartao";

      out.push({
        id: `lanc-${l.id}`,
        origemTipo: "lancamento",
        origemId: l.id,
        descricao: l.descricao,
        valor: l.valor,
        ehPrevisao: l.status === "prevista",
        data: l.data,
        categoria: l.categoria,
        conta: l.conta,
        cartao: l.cartao,
        status: l.status,
        tipo: l.tipo as "despesa" | "receita",
        grupo,
      });
    }

    for (const i of investimentos) {
      out.push({
        id: `inv-${i.id}`,
        origemTipo: "lancamento",
        origemId: i.id,
        descricao: `${i.tipo === "aporte" ? "Aporte" : i.tipo === "resgate" ? "Resgate" : "Rendimento"} • ${i.descricao}`,
        valor: i.valor,
        data: i.data,
        categoria: null,
        conta: i.conta,
        cartao: null,
        status: "paga",
        tipo: i.tipo === "aporte" ? "despesa" : "receita",
        grupo: "investimentos",
      });
    }

    // Parcelas do cartão (CardInstallment)
    for (const ci of cardInstallments) {
      const p = ci.purchase;
      const grupo: ItemUnificado["grupo"] = p.ehAssinatura
        ? "assinaturas"
        : p.totalParcelas > 1
          ? "parcelas"
          : "cartao";
      const descricao =
        p.totalParcelas > 1
          ? `${p.descricao} (${ci.numero}/${p.totalParcelas})`
          : p.descricao;
      out.push({
        id: `card-${ci.id}`,
        origemTipo: "card",
        origemId: ci.id,
        descricao,
        valor: ci.valor,
        ehPrevisao: ci.status === "prevista",
        data: ci.dataVencimento,
        categoria: p.categoria,
        conta: null,
        cartao: p.cartao,
        status: ci.status,
        tipo: "despesa",
        grupo,
      });
    }

    // Transferências entre contas — não contam como despesa nem receita
    for (const t of transferencias) {
      out.push({
        id: `transf-${t.id}`,
        origemTipo: "lancamento",
        origemId: t.id,
        descricao:
          t.descricao ??
          `${t.origemConta.nome} → ${t.destinoConta.nome}`,
        valor: t.valor,
        data: t.data,
        categoria: null,
        conta: t.origemConta,
        cartao: null,
        status: "paga",
        tipo: "despesa", // só pra exibir no agrupamento; não conta nos totais
        grupo: "transferencias",
      });
    }

    return out.sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [
    lancamentos,
    ocorrencias,
    investimentos,
    cardInstallments,
    transferencias,
    categorias,
    contas,
    cartoes,
  ]);

  // Aplica filtros
  const itensFiltrados = useMemo(() => {
    return itens.filter((it) => {
      if (filtroGrupo !== "todos" && it.grupo !== filtroGrupo) return false;
      if (filtroCategoria !== "todas") {
        if ((it.categoria?.id ?? "_") !== filtroCategoria) return false;
      }
      if (filtroConta !== "todas") {
        if ((it.conta?.id ?? "_") !== filtroConta) return false;
      }
      if (filtroCartao !== "todos") {
        if ((it.cartao?.id ?? "_") !== filtroCartao) return false;
      }
      if (filtroStatus !== "todos") {
        if (filtroStatus === "pagas" && it.status !== "paga") return false;
        if (filtroStatus === "previstas" && it.status !== "prevista" && it.status !== "aguardando-real")
          return false;
        if (filtroStatus === "atrasadas" && it.status !== "atrasada") return false;
        if (filtroStatus === "abertas") {
          if (it.status === "paga" || it.status === "cancelada") return false;
        }
      }
      return true;
    });
  }, [itens, filtroGrupo, filtroCategoria, filtroConta, filtroCartao, filtroStatus]);

  // Agrupamento para exibição
  const gruposExibidos = useMemo(() => {
    const map = new Map<string, ItemUnificado[]>();
    for (const it of itensFiltrados) {
      if (!map.has(it.grupo)) map.set(it.grupo, []);
      map.get(it.grupo)!.push(it);
    }
    return map;
  }, [itensFiltrados]);

  // Dados para gráficos
  const dadosGraficoCategorias = useMemo(() => {
    const m = new Map<string, { valor: number; cor?: string | null }>();
    for (const it of itens) {
      if (it.tipo !== "despesa") continue;
      if (it.status === "cancelada") continue;
      const key = it.categoria?.nome ?? "Sem categoria";
      const cur = m.get(key) ?? { valor: 0, cor: it.categoria?.cor };
      cur.valor += it.valor;
      m.set(key, cur);
    }
    return Array.from(m.entries())
      .map(([nome, v]) => ({ nome, valor: v.valor, cor: v.cor }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [itens]);

  const dadosFixasVariaveis = useMemo(() => {
    let fixas = 0;
    let variaveis = 0;
    for (const it of itens) {
      if (it.tipo !== "despesa") continue;
      if (it.status === "cancelada") continue;
      if (it.grupo === "fixas") fixas += it.valor;
      else variaveis += it.valor;
    }
    return [
      { nome: "Fixas", valor: fixas, cor: "#0ea5e9" },
      { nome: "Variáveis", valor: variaveis, cor: "#f97316" },
    ];
  }, [itens]);

  const dadosPagasAbertas = useMemo(() => {
    let pagas = 0;
    let abertas = 0;
    for (const it of itens) {
      if (it.tipo !== "despesa") continue;
      if (it.status === "cancelada") continue;
      if (it.status === "paga") pagas += it.valor;
      else abertas += it.valor;
    }
    return [
      { nome: "Pagas", valor: pagas, cor: "#10b981" },
      { nome: "Em aberto", valor: abertas, cor: "#facc15" },
    ];
  }, [itens]);

  const dadosEvolucao = useMemo(() => {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const porDia = new Map<number, number>();
    for (const it of itens) {
      if (it.tipo !== "despesa" || it.status === "cancelada") continue;
      const dia = it.data.getDate();
      porDia.set(dia, (porDia.get(dia) ?? 0) + it.valor);
    }
    let acumulado = 0;
    const out: { dia: string; acumulado: number }[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      acumulado += porDia.get(d) ?? 0;
      out.push({ dia: String(d), acumulado });
    }
    return out;
  }, [itens, ano, mes]);

  async function handleAcao(item: ItemUnificado, acao: "pagar" | "excluir") {
    try {
      if (item.origemTipo === "fixa") {
        if (acao === "pagar") {
          const oc = ocorrencias.find((o) => o.id === item.origemId);
          if (
            oc &&
            oc.despesaFixa.tipoValor === "variavel" &&
            oc.valorReal === null
          ) {
            setValorRealDialog(oc);
            setValorRealInput(oc.valorPrevisto);
            return;
          }
          await alterarStatusOcorrencia(item.origemId, "paga");
          toast.success("Marcado como pago");
        } else {
          if (!confirm("Cancelar esta ocorrência mensal?")) return;
          await excluirOcorrencia(item.origemId);
          toast.success("Ocorrência cancelada");
        }
      } else if (item.origemTipo === "card") {
        if (acao === "pagar") {
          await marcarParcelaPaga(item.origemId);
          toast.success("Parcela paga");
        } else {
          toast.info("Use a tela do cartão para cancelar uma compra");
          return;
        }
      } else {
        if (acao === "pagar") {
          await marcarLancamentoPago(item.origemId);
          toast.success("Marcado como pago");
        } else {
          if (!confirm("Excluir este lançamento?")) return;
          await excluirLancamento(item.origemId);
          toast.success("Lançamento excluído");
        }
      }
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function confirmarValorReal() {
    if (!valorRealDialog) return;
    setBusy(true);
    try {
      await alterarStatusOcorrencia(valorRealDialog.id, "paga", valorRealInput);
      toast.success("Valor real informado e pago");
      setValorRealDialog(null);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function abrirValorRealParaOcorrencia(o: OcorrenciaFull) {
    setValorRealDialog(o);
    setValorRealInput(o.valorReal ?? o.valorPrevisto);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Header com navegação de meses */}
      <Card className="bg-gradient-to-br from-primary/5 to-info/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => navegar(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-1 text-center sm:text-left">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Demonstrativo
              </div>
              <div className="text-2xl font-bold capitalize">
                {nomeMesProp} <span className="text-muted-foreground">{ano}</span>
              </div>
            </div>
            <Button size="icon" variant="outline" onClick={() => navegar(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={mes}
              onChange={(e) => escolherCompetencia(Number(e.target.value), ano)}
              className="h-9 w-36"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </Select>
            <Select
              value={ano}
              onChange={(e) => escolherCompetencia(mes, Number(e.target.value))}
              className="h-9 w-24"
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const hoje = new Date();
                escolherCompetencia(hoje.getMonth() + 1, hoje.getFullYear());
              }}
            >
              Mês atual
            </Button>
            <ExportButton
              tipo="demonstrativo"
              mes={mes}
              ano={ano}
              label="CSV"
              size="sm"
              showPrint
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        <KpiCard
          label="Entradas"
          value={totais.entradas}
          icon={ArrowDownRight}
          tone="success"
        />
        <KpiCard
          label="Despesas pagas"
          value={totais.despesasPagas}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Em aberto"
          value={totais.despesasAbertas}
          icon={ArrowUpRight}
          tone="warning"
        />
        <KpiCard
          label="Previstas"
          value={totais.despesasPrevistas}
          icon={Repeat}
          tone="info"
        />
        <KpiCard
          label="Cartão"
          value={totais.gastosCartao}
          icon={CreditCard}
          tone="info"
        />
        <KpiCard
          label="Investimentos"
          value={totais.investimentos}
          icon={TrendingUp}
          tone="info"
        />
        <KpiCard
          label={totais.limiteMensal !== null ? "Limite disponível" : "Limite (definir)"}
          value={totais.limiteDisponivel ?? 0}
          icon={Wallet}
          tone={
            totais.limiteMensal === null
              ? "info"
              : (totais.limiteDisponivel ?? 0) <= 0
                ? "destructive"
                : (totais.limitePercentual ?? 0) > 0.8
                  ? "warning"
                  : "success"
          }
        />
        <KpiCard
          label="Saldo do mês"
          value={totais.saldoFinal}
          icon={CircleDollarSign}
          tone={totais.saldoFinal >= 0 ? "success" : "destructive"}
          highlight
        />
      </div>

      {/* Barra do limite mensal com alertas */}
      <LimiteBar totais={totais} />

      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <div className="mr-2 flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="h-9 w-auto min-w-32"
          >
            <option value="todos">Todos status</option>
            <option value="pagas">Pagas</option>
            <option value="abertas">Em aberto</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="previstas">Previstas</option>
          </Select>
          <Select
            value={filtroGrupo}
            onChange={(e) => setFiltroGrupo(e.target.value)}
            className="h-9 w-auto min-w-32"
          >
            <option value="todos">Todos os grupos</option>
            <option value="entradas">Entradas</option>
            <option value="fixas">Fixas</option>
            <option value="variaveis">Variáveis</option>
            <option value="cartao">Cartão</option>
            <option value="parcelas">Parcelas</option>
            <option value="assinaturas">Assinaturas</option>
            <option value="investimentos">Investimentos</option>
            <option value="transferencias">Transferências</option>
          </Select>
          <Select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="h-9 w-auto min-w-36"
          >
            <option value="todas">Todas categorias</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            className="h-9 w-auto min-w-32"
          >
            <option value="todas">Todas as contas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            value={filtroCartao}
            onChange={(e) => setFiltroCartao(e.target.value)}
            className="h-9 w-auto min-w-32"
          >
            <option value="todos">Todos os cartões</option>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          {(filtroStatus !== "todos" ||
            filtroGrupo !== "todos" ||
            filtroCategoria !== "todas" ||
            filtroConta !== "todas" ||
            filtroCartao !== "todos") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiltroStatus("todos");
                setFiltroGrupo("todos");
                setFiltroCategoria("todas");
                setFiltroConta("todas");
                setFiltroCartao("todos");
              }}
            >
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Itens agrupados */}
      <div className="space-y-6">
        <Grupo
          titulo="Entradas"
          icone={ArrowDownRight}
          itens={gruposExibidos.get("entradas") ?? []}
          tone="success"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Despesas fixas"
          icone={Repeat}
          itens={gruposExibidos.get("fixas") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Despesas variáveis"
          icone={ArrowLeftRight}
          itens={gruposExibidos.get("variaveis") ?? []}
          tone="warning"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Cartão de crédito"
          icone={CreditCard}
          itens={gruposExibidos.get("cartao") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Parcelas"
          icone={Layers}
          itens={gruposExibidos.get("parcelas") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Assinaturas"
          icone={Tag}
          itens={gruposExibidos.get("assinaturas") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Investimentos"
          icone={TrendingUp}
          itens={gruposExibidos.get("investimentos") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
        <Grupo
          titulo="Transferências entre contas"
          icone={ArrowRightLeft}
          itens={gruposExibidos.get("transferencias") ?? []}
          tone="info"
          onAcao={handleAcao}
          onValorReal={abrirValorRealParaOcorrencia}
          ocorrenciasMap={new Map(ocorrencias.map((o) => [o.id, o]))}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoCategorias data={dadosGraficoCategorias} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução do mês</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoEvolucaoMes data={dadosEvolucao} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fixas × Variáveis</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoComparacao data={dadosFixasVariaveis} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagas × Em aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoComparacao data={dadosPagasAbertas} />
          </CardContent>
        </Card>
      </div>

      {/* Dialog Valor Real */}
      <Dialog
        open={!!valorRealDialog}
        onOpenChange={(o) => !o && setValorRealDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informar valor real</DialogTitle>
          </DialogHeader>
          {valorRealDialog && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="font-medium">
                  {valorRealDialog.descricaoOverride ??
                    valorRealDialog.despesaFixa.descricao}
                </div>
                <div className="text-muted-foreground">
                  Competência: {nomeMes(valorRealDialog.mes)}/{valorRealDialog.ano}
                </div>
                <div className="mt-1 text-muted-foreground">
                  Previsto:{" "}
                  <span className="font-medium text-foreground">
                    {formatBRL(valorRealDialog.valorPrevisto)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor real deste mês</Label>
                <MoneyInput
                  value={valorRealInput}
                  onChange={setValorRealInput}
                />
                <p className="text-xs text-muted-foreground">
                  Vale apenas para {nomeMes(valorRealDialog.mes)}. Os próximos
                  meses continuam com a previsão.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setValorRealDialog(null)}
              disabled={busy}
            >
              Cancelar
            </Button>
            <Button onClick={confirmarValorReal} disabled={busy}>
              {busy ? "Salvando..." : "Salvar e marcar como pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LimiteBar({ totais }: { totais: TotaisMes }) {
  if (totais.limiteMensal === null || totais.limiteMensal <= 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Você ainda não definiu um limite mensal de gastos para este mês.
            </span>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/limites">Definir limite</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pct = totais.limitePercentual ?? 0;
  const pctNum = pct * 100;
  let alerta: { msg: string; tone: "info" | "warning" | "destructive" } | null =
    null;
  if (pct >= 1) {
    alerta = {
      msg: `Você ultrapassou o limite mensal em ${formatBRL(totais.limiteUsado - totais.limiteMensal)}.`,
      tone: "destructive",
    };
  } else if (pct >= 0.9) {
    alerta = {
      msg: `Atenção: você já usou ${pctNum.toFixed(1)}% do limite. Disponível: ${formatBRL(totais.limiteDisponivel ?? 0)}.`,
      tone: "destructive",
    };
  } else if (pct >= 0.8) {
    alerta = {
      msg: `Você já usou ${pctNum.toFixed(1)}% do limite mensal.`,
      tone: "warning",
    };
  } else if (pct >= 0.5) {
    alerta = {
      msg: `Você já usou ${pctNum.toFixed(1)}% do limite mensal.`,
      tone: "info",
    };
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-primary" /> Limite do mês
          </div>
          <Link
            href="/limites"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            ajustar
          </Link>
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span>
              <b>{formatBRL(totais.limiteUsado)}</b>
              <span className="text-muted-foreground">
                {" "}
                / {formatBRL(totais.limiteMensal)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {pctNum.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all ${
                pct >= 0.9
                  ? "bg-destructive"
                  : pct >= 0.7
                    ? "bg-warning"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, pctNum)}%` }}
            />
          </div>
        </div>
        {alerta && (
          <div
            className={`flex items-center gap-2 rounded-md p-2.5 text-xs ${
              alerta.tone === "destructive"
                ? "bg-destructive/10 text-destructive"
                : alerta.tone === "warning"
                  ? "bg-warning/10 text-warning"
                  : "bg-info/10 text-info"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {alerta.msg}
          </div>
        )}
      </CardContent>
    </Card>
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
      ? "text-success bg-success/10"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10"
        : tone === "warning"
          ? "text-warning bg-warning/10"
          : "text-info bg-info/10";
  return (
    <Card className={highlight ? "border-primary/50 bg-primary/5" : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-lg font-bold">{formatBRL(value)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Grupo({
  titulo,
  icone: Icon,
  itens,
  tone,
  onAcao,
  onValorReal,
  ocorrenciasMap,
}: {
  titulo: string;
  icone: React.ElementType;
  itens: ItemUnificado[];
  tone: "success" | "warning" | "info" | "destructive";
  onAcao: (i: ItemUnificado, acao: "pagar" | "excluir") => void;
  onValorReal: (o: OcorrenciaFull) => void;
  ocorrenciasMap: Map<string, OcorrenciaFull>;
}) {
  if (itens.length === 0) return null;

  const total = itens.reduce(
    (acc, i) => acc + (i.tipo === "receita" ? i.valor : i.valor),
    0,
  );

  const toneIcon =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "warning"
        ? "text-warning bg-warning/10"
        : tone === "destructive"
          ? "text-destructive bg-destructive/10"
          : "text-info bg-info/10";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className={`rounded-md p-1.5 ${toneIcon}`}>
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{titulo}</CardTitle>
          <Badge variant="muted">{itens.length}</Badge>
        </div>
        <div className="text-sm font-semibold">{formatBRL(total)}</div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile: cards. Desktop: tabela */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Descrição</th>
                <th className="px-4 py-2 text-left">Categoria</th>
                <th className="px-4 py-2 text-left">Pagto</th>
                <th className="px-4 py-2 text-left">Data</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => (
                <tr key={it.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{it.descricao}</span>
                      {it.ehFixaVariavel && (
                        <Badge variant="info" className="text-[10px]">
                          variável
                        </Badge>
                      )}
                      {it.ehPrevisao && it.status !== "paga" && (
                        <Badge variant="muted" className="text-[10px]">
                          previsão
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {it.categoria ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{ color: it.categoria.cor ?? undefined }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            background: it.categoria.cor ?? "#94a3b8",
                          }}
                        />
                        {it.categoria.nome}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {it.cartao ? (
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {it.cartao.nome}
                      </span>
                    ) : it.conta ? (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        {it.conta.nome}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {formatDateBR(it.data)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={it.status} />
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${it.tipo === "receita" ? "text-success" : ""}`}
                  >
                    {it.tipo === "receita" ? "+" : "−"} {formatBRL(it.valor)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      {it.origemTipo === "fixa" &&
                        ocorrenciasMap.get(it.origemId)?.despesaFixa.tipoValor ===
                          "variavel" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              onValorReal(ocorrenciasMap.get(it.origemId)!)
                            }
                            aria-label="Valor real"
                            title="Informar valor real"
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                        )}
                      {it.status !== "paga" && it.status !== "cancelada" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onAcao(it, "pagar")}
                          aria-label="Marcar como pago"
                          title="Marcar como pago"
                        >
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y md:hidden">
          {itens.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{it.descricao}</span>
                  {it.ehFixaVariavel && (
                    <Badge variant="info" className="text-[10px]">
                      variável
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={it.status} />
                  <span>{formatDateBR(it.data)}</span>
                  {it.categoria && (
                    <span style={{ color: it.categoria.cor ?? undefined }}>
                      • {it.categoria.nome}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`font-bold ${it.tipo === "receita" ? "text-success" : ""}`}
                >
                  {it.tipo === "receita" ? "+" : "−"} {formatBRL(it.valor)}
                </div>
                {it.status !== "paga" && it.status !== "cancelada" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      it.origemTipo === "fixa" &&
                      ocorrenciasMap.get(it.origemId)?.despesaFixa.tipoValor ===
                        "variavel"
                        ? onValorReal(ocorrenciasMap.get(it.origemId)!)
                        : onAcao(it, "pagar")
                    }
                    className="mt-1 h-7"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Pagar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
