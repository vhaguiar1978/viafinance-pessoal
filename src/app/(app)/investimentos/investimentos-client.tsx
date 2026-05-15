"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Conta,
  Investimento,
  InvestmentAsset,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import {
  criarAsset,
  atualizarAsset,
  excluirAsset,
  criarMovimentacao,
  excluirMovimentacao,
  type InvestmentAssetInput,
  type MovimentacaoInput,
} from "@/server/actions/investimentos";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { GraficoCategorias, GraficoComparacao } from "@/components/charts";
import { ExportButton } from "@/components/export-button";

const TIPO_LABEL: Record<string, string> = {
  poupanca: "Poupança",
  cdb: "CDB",
  lci: "LCI",
  lca: "LCA",
  tesouro: "Tesouro Direto",
  fundo: "Fundo",
  bolsa: "Bolsa de Valores",
  acoes: "Ações",
  fii: "Fundo Imobiliário (FII)",
  etf: "ETF",
  bdr: "BDR",
  cripto: "Cripto",
  previdencia: "Previdência",
  conta_remunerada: "Conta remunerada",
  outros: "Outros",
};

const TIPO_COR: Record<string, string> = {
  poupanca: "#0ea5e9",          // azul
  cdb: "#0284c7",               // azul escuro
  lci: "#06b6d4",               // ciano
  lca: "#0891b2",               // ciano escuro
  tesouro: "#6366f1",           // indigo
  fundo: "#10b981",             // verde
  bolsa: "#a855f7",             // roxo
  acoes: "#9333ea",             // roxo escuro
  fii: "#ec4899",               // rosa
  etf: "#8b5cf6",               // violeta
  bdr: "#facc15",               // amarelo
  cripto: "#f97316",            // laranja
  previdencia: "#92400e",       // marrom
  conta_remunerada: "#22c55e",  // verde claro
  outros: "#94a3b8",            // cinza
};

const RISCO_INFO: Record<string, { label: string; color: string }> = {
  baixo: { label: "Risco baixo", color: "#10b981" },
  medio: { label: "Risco médio", color: "#f59e0b" },
  alto: { label: "Risco alto", color: "#ef4444" },
};

const LIQ_LABEL: Record<string, string> = {
  diaria: "Diária",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  sem_liquidez: "Sem liquidez",
};

type MovFull = Investimento & {
  conta: Conta | null;
  asset: InvestmentAsset | null;
};

interface Props {
  assets: InvestmentAsset[];
  movimentacoes: MovFull[];
  contas: Conta[];
}

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InvestimentosClient({
  assets,
  movimentacoes,
  contas,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [openAsset, setOpenAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<InvestmentAsset | null>(null);
  const [openMov, setOpenMov] = useState(false);
  const [busy, setBusy] = useState(false);

  const [assetForm, setAssetForm] = useState<InvestmentAssetInput>({
    nome: "",
    instituicao: null,
    tipo: "cdb",
    valorAplicado: 0,
    valorAtual: 0,
    dataAplicacao: isoHoje(),
    vencimento: null,
    liquidez: null,
    risco: null,
    objetivo: null,
    status: "ativo",
    observacoes: null,
  });

  const [movForm, setMovForm] = useState<MovimentacaoInput>({
    descricao: "",
    tipo: "aporte",
    valor: 0,
    data: isoHoje(),
    assetId: assets[0]?.id ?? null,
    contaId: contas[0]?.id ?? null,
    observacoes: null,
  });

  function abrirAsset(a?: InvestmentAsset) {
    if (a) {
      setEditingAsset(a);
      setAssetForm({
        nome: a.nome,
        instituicao: a.instituicao,
        tipo: a.tipo as InvestmentAssetInput["tipo"],
        valorAplicado: a.valorAplicado,
        valorAtual: a.valorAtual,
        dataAplicacao: a.dataAplicacao?.toISOString().slice(0, 10) ?? null,
        vencimento: a.vencimento?.toISOString().slice(0, 10) ?? null,
        liquidez: a.liquidez as InvestmentAssetInput["liquidez"],
        risco: a.risco as InvestmentAssetInput["risco"],
        objetivo: a.objetivo,
        status: a.status as InvestmentAssetInput["status"],
        observacoes: a.observacoes,
      });
    } else {
      setEditingAsset(null);
      setAssetForm({
        nome: "",
        instituicao: null,
        tipo: "cdb",
        valorAplicado: 0,
        valorAtual: 0,
        dataAplicacao: isoHoje(),
        vencimento: null,
        liquidez: null,
        risco: null,
        objetivo: null,
        status: "ativo",
        observacoes: null,
      });
    }
    setOpenAsset(true);
  }

  async function salvarAsset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingAsset) {
        await atualizarAsset(editingAsset.id, assetForm);
        toast.success("Ativo atualizado");
      } else {
        await criarAsset(assetForm);
        toast.success("Ativo cadastrado");
      }
      setOpenAsset(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function deletarAsset(id: string) {
    if (!confirm("Excluir este ativo? As movimentações vinculadas ficarão sem vínculo.")) return;
    try {
      await excluirAsset(id);
      toast.success("Excluído");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function salvarMov(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await criarMovimentacao(movForm);
      toast.success("Movimentação registrada");
      setOpenMov(false);
      setMovForm({
        descricao: "",
        tipo: "aporte",
        valor: 0,
        data: isoHoje(),
        assetId: assets[0]?.id ?? null,
        contaId: contas[0]?.id ?? null,
        observacoes: null,
      });
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function deletarMov(id: string) {
    if (!confirm("Excluir esta movimentação?")) return;
    try {
      await excluirMovimentacao(id);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  // Estatísticas / dashboard
  const stats = useMemo(() => {
    const ativos = assets.filter((a) => a.status === "ativo");
    const totalAplicado = ativos.reduce((acc, a) => acc + a.valorAplicado, 0);
    const totalAtual = ativos.reduce((acc, a) => acc + a.valorAtual, 0);
    const rendimento = totalAtual - totalAplicado;
    const pctRend = totalAplicado > 0 ? rendimento / totalAplicado : 0;

    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59);
    const rendMes = movimentacoes
      .filter(
        (m) => m.tipo === "rendimento" && m.data >= ini && m.data <= fim,
      )
      .reduce((acc, m) => acc + m.valor, 0);

    const proximosVenc = ativos
      .filter((a) => a.vencimento && a.vencimento > hoje)
      .sort(
        (a, b) =>
          (a.vencimento?.getTime() ?? 0) - (b.vencimento?.getTime() ?? 0),
      )
      .slice(0, 5);

    return { totalAplicado, totalAtual, rendimento, pctRend, rendMes, proximosVenc };
  }, [assets, movimentacoes]);

  // Distribuições para gráficos
  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) {
      if (a.status !== "ativo") continue;
      const k = TIPO_LABEL[a.tipo] ?? a.tipo;
      m.set(k, (m.get(k) ?? 0) + a.valorAtual);
    }
    return Array.from(m.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [assets]);

  const porRisco = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      if (a.status !== "ativo") continue;
      const k = a.risco ?? "indefinido";
      map.set(k, (map.get(k) ?? 0) + a.valorAtual);
    }
    return [
      { nome: "Baixo", valor: map.get("baixo") ?? 0, cor: "#10b981" },
      { nome: "Médio", valor: map.get("medio") ?? 0, cor: "#f59e0b" },
      { nome: "Alto", valor: map.get("alto") ?? 0, cor: "#ef4444" },
      { nome: "Sem definir", valor: map.get("indefinido") ?? 0, cor: "#94a3b8" },
    ].filter((d) => d.valor > 0);
  }, [assets]);

  const porInstituicao = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) {
      if (a.status !== "ativo") continue;
      const k = a.instituicao ?? "Sem instituição";
      m.set(k, (m.get(k) ?? 0) + a.valorAtual);
    }
    return Array.from(m.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [assets]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investimentos</h1>
          <p className="text-sm text-muted-foreground">
            Sua carteira, rentabilidade, evolução e vencimentos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            tipo="investimentos"
            mes={new Date().getMonth() + 1}
            ano={new Date().getFullYear()}
            label="Exportar carteira"
            showPrint
          />
          <Button variant="outline" onClick={() => setOpenMov(true)}>
            <Plus className="h-4 w-4" /> Movimentação
          </Button>
          <Button onClick={() => abrirAsset()}>
            <Plus className="h-4 w-4" /> Novo ativo
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total investido" value={stats.totalAplicado} icon={Wallet} />
        <Kpi
          label="Valor atual"
          value={stats.totalAtual}
          icon={TrendingUp}
          tone="success"
          highlight
        />
        <Kpi
          label="Rendimento total"
          value={stats.rendimento}
          icon={stats.rendimento >= 0 ? TrendingUp : TrendingDown}
          tone={stats.rendimento >= 0 ? "success" : "destructive"}
          extra={
            stats.totalAplicado > 0
              ? `${(stats.pctRend * 100).toFixed(2)}%`
              : undefined
          }
        />
        <Kpi
          label="Rendimento do mês"
          value={stats.rendMes}
          icon={TrendingUp}
          tone="info"
        />
      </div>

      <Tabs defaultValue="carteira">
        <TabsList>
          <TabsTrigger value="carteira">Carteira</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
          <TabsTrigger value="graficos">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="carteira" className="mt-4">
          {assets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <div className="rounded-full bg-muted p-3">
                  <TrendingUp className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="font-semibold">Nenhum ativo cadastrado</div>
                <div className="text-sm text-muted-foreground">
                  Cadastre seus CDBs, Tesouro, ações, FIIs, criptos...
                </div>
                <Button onClick={() => abrirAsset()}>
                  <Plus className="h-4 w-4" /> Novo ativo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {assets.map((a) => {
                const rend = a.valorAtual - a.valorAplicado;
                const pct = a.valorAplicado > 0 ? rend / a.valorAplicado : 0;
                return (
                  <Card key={a.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{a.nome}</span>
                            <span
                              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                              style={{ background: TIPO_COR[a.tipo] ?? "#94a3b8" }}
                            >
                              {TIPO_LABEL[a.tipo] ?? a.tipo}
                            </span>
                            {a.risco && RISCO_INFO[a.risco] && (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                style={{ background: RISCO_INFO[a.risco].color }}
                              >
                                {RISCO_INFO[a.risco].label}
                              </span>
                            )}
                            {a.status !== "ativo" && (
                              <Badge variant="muted">{a.status}</Badge>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {a.instituicao && <>{a.instituicao} • </>}
                            {a.liquidez && <>liq. {LIQ_LABEL[a.liquidez]}</>}
                            {a.vencimento && (
                              <> • vence {formatDateBR(a.vencimento)}</>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => abrirAsset(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deletarAsset(a.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Aplicado
                          </div>
                          <div className="font-semibold">
                            {formatBRL(a.valorAplicado)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Atual
                          </div>
                          <div className="font-semibold">
                            {formatBRL(a.valorAtual)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Rendimento
                          </div>
                          <div
                            className={`font-semibold ${rend >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {rend >= 0 ? "+" : ""}
                            {formatBRL(rend)}
                            <span className="ml-1 text-xs">
                              ({(pct * 100).toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="movs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {movimentacoes.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma movimentação ainda
                </div>
              ) : (
                <ul className="divide-y">
                  {movimentacoes.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white shadow-sm"
                            style={{
                              background:
                                m.tipo === "aporte"
                                  ? "#10b981"
                                  : m.tipo === "resgate"
                                    ? "#f59e0b"
                                    : m.tipo === "rendimento"
                                      ? "#0ea5e9"
                                      : m.tipo === "taxa" || m.tipo === "imposto"
                                        ? "#ef4444"
                                        : "#94a3b8",
                            }}
                          >
                            {m.tipo}
                          </span>
                          <span className="font-medium">{m.descricao}</span>
                          {m.asset && (
                            <span className="text-xs text-muted-foreground">
                              • {m.asset.nome}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateBR(m.data)}
                          {m.conta && ` • ${m.conta.nome}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatBRL(m.valor)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deletarMov(m.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficoCategorias data={porTipo} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por risco</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficoComparacao data={porRisco} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Por instituição</CardTitle>
              </CardHeader>
              <CardContent>
                <GraficoCategorias data={porInstituicao} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Próximos vencimentos */}
      {stats.proximosVenc.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {stats.proximosVenc.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{a.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {TIPO_LABEL[a.tipo]}
                      {a.instituicao && ` • ${a.instituicao}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatBRL(a.valorAtual)}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.vencimento ? formatDateBR(a.vencimento) : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Asset */}
      <Dialog open={openAsset} onOpenChange={setOpenAsset}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? "Editar ativo" : "Novo ativo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarAsset} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={assetForm.nome}
                  onChange={(e) => setAssetForm({ ...assetForm, nome: e.target.value })}
                  placeholder="Ex: Tesouro Selic 2029"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Instituição</Label>
                <Input
                  value={assetForm.instituicao ?? ""}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, instituicao: e.target.value || null })
                  }
                  placeholder="Ex: XP, Itaú, Nubank"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={assetForm.tipo}
                  onChange={(e) =>
                    setAssetForm({
                      ...assetForm,
                      tipo: e.target.value as InvestmentAssetInput["tipo"],
                    })
                  }
                >
                  {Object.entries(TIPO_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Risco</Label>
                <Select
                  value={assetForm.risco ?? ""}
                  onChange={(e) =>
                    setAssetForm({
                      ...assetForm,
                      risco: (e.target.value as InvestmentAssetInput["risco"]) || null,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="baixo">Baixo</option>
                  <option value="medio">Médio</option>
                  <option value="alto">Alto</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Liquidez</Label>
                <Select
                  value={assetForm.liquidez ?? ""}
                  onChange={(e) =>
                    setAssetForm({
                      ...assetForm,
                      liquidez: (e.target.value as InvestmentAssetInput["liquidez"]) || null,
                    })
                  }
                >
                  <option value="">—</option>
                  <option value="diaria">Diária</option>
                  <option value="mensal">Mensal</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="anual">Anual</option>
                  <option value="sem_liquidez">Sem liquidez</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor aplicado</Label>
                <MoneyInput
                  value={assetForm.valorAplicado}
                  onChange={(v) =>
                    setAssetForm({ ...assetForm, valorAplicado: v, valorAtual: assetForm.valorAtual || v })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Valor atual</Label>
                <MoneyInput
                  value={assetForm.valorAtual}
                  onChange={(v) => setAssetForm({ ...assetForm, valorAtual: v })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Aplicado em</Label>
                <Input
                  type="date"
                  value={assetForm.dataAplicacao ?? ""}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, dataAplicacao: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento (opcional)</Label>
                <Input
                  type="date"
                  value={assetForm.vencimento ?? ""}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, vencimento: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objetivo (opcional)</Label>
              <Input
                value={assetForm.objetivo ?? ""}
                onChange={(e) =>
                  setAssetForm({ ...assetForm, objetivo: e.target.value || null })
                }
                placeholder="Ex: Reserva de emergência, aposentadoria"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenAsset(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Movimentação */}
      <Dialog open={openMov} onOpenChange={setOpenMov}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarMov} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={movForm.tipo}
                  onChange={(e) =>
                    setMovForm({
                      ...movForm,
                      tipo: e.target.value as MovimentacaoInput["tipo"],
                    })
                  }
                >
                  <option value="aporte">Aporte</option>
                  <option value="resgate">Resgate</option>
                  <option value="rendimento">Rendimento</option>
                  <option value="taxa">Taxa</option>
                  <option value="imposto">Imposto</option>
                  <option value="vencimento">Vencimento</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={movForm.data}
                  onChange={(e) => setMovForm({ ...movForm, data: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={movForm.descricao}
                onChange={(e) => setMovForm({ ...movForm, descricao: e.target.value })}
                placeholder="Ex: Aporte mensal Tesouro"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor</Label>
                <MoneyInput
                  value={movForm.valor}
                  onChange={(v) => setMovForm({ ...movForm, valor: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ativo (opcional)</Label>
                <Select
                  value={movForm.assetId ?? ""}
                  onChange={(e) =>
                    setMovForm({ ...movForm, assetId: e.target.value || null })
                  }
                >
                  <option value="">—</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta de origem/destino (opcional)</Label>
              <Select
                value={movForm.contaId ?? ""}
                onChange={(e) =>
                  setMovForm({ ...movForm, contaId: e.target.value || null })
                }
              >
                <option value="">—</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenMov(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  highlight,
  extra,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: "success" | "destructive" | "info" | "warning";
  highlight?: boolean;
  extra?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success bg-success/10"
      : tone === "destructive"
        ? "text-destructive bg-destructive/10"
        : tone === "warning"
          ? "text-warning bg-warning/10"
          : tone === "info"
            ? "text-info bg-info/10"
            : "bg-muted text-foreground";
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md p-2 ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-lg font-bold">{formatBRL(value)}</div>
          {extra && (
            <div className="text-xs text-muted-foreground">{extra}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
