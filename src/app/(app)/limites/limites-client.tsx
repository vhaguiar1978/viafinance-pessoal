"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Categoria,
  CategoryLimit,
  MonthlyLimit,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Target,
  Trash2,
} from "lucide-react";
import { formatBRL, nomeMes } from "@/lib/utils";
import {
  definirLimiteMensal,
  definirLimiteCategoria,
  excluirLimiteCategoria,
} from "@/server/actions/limites";
import type { TotaisMes } from "@/server/competencia";
import { useToast } from "@/components/toast-provider";

const ANOS = Array.from({ length: 10 }, (_, i) => 2023 + i);

type CategoryLimitFull = CategoryLimit & { categoria: Categoria };

interface Props {
  mes: number;
  ano: number;
  limiteMensal: MonthlyLimit | null;
  categorias: Categoria[];
  limitesCategoria: CategoryLimitFull[];
  totais: TotaisMes;
}

export function LimitesClient({
  mes,
  ano,
  limiteMensal,
  categorias,
  limitesCategoria,
  totais,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [valor, setValor] = useState(limiteMensal?.valor ?? 0);
  const [incluiCartao, setIncluiCartao] = useState(
    limiteMensal?.incluiCartao ?? true,
  );
  const [incluiInvest, setIncluiInvest] = useState(
    limiteMensal?.incluiInvestimentos ?? false,
  );
  const [busy, setBusy] = useState(false);

  // Dialog para limite por categoria
  const [openCatDialog, setOpenCatDialog] = useState(false);
  const [catId, setCatId] = useState("");
  const [catValor, setCatValor] = useState(0);

  function navegar(delta: number) {
    let nm = mes + delta;
    let na = ano;
    if (nm < 1) {
      nm = 12;
      na -= 1;
    }
    if (nm > 12) {
      nm = 1;
      na += 1;
    }
    router.push(`/limites?mes=${nm}&ano=${na}`);
  }
  function escolher(m: number, a: number) {
    router.push(`/limites?mes=${m}&ano=${a}`);
  }

  async function handleSalvar() {
    setBusy(true);
    try {
      await definirLimiteMensal({
        mes,
        ano,
        valor,
        incluiCartao,
        incluiInvestimentos: incluiInvest,
      });
      toast.success("Limite salvo");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleSalvarCategoria() {
    if (!catId) {
      toast.error("Selecione a categoria");
      return;
    }
    setBusy(true);
    try {
      await definirLimiteCategoria({
        categoriaId: catId,
        mes,
        ano,
        valor: catValor,
      });
      toast.success("Limite da categoria salvo");
      setOpenCatDialog(false);
      setCatId("");
      setCatValor(0);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleExcluirCategoria(id: string) {
    if (!confirm("Remover limite desta categoria?")) return;
    try {
      await excluirLimiteCategoria(id);
      toast.success("Limite removido");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  const pct = totais.limitePercentual ?? 0;
  const pctNum = (pct * 100).toFixed(1);

  let alertaMsg: string | null = null;
  let alertaTone: "info" | "warning" | "destructive" = "info";
  if (totais.limiteMensal !== null) {
    if (pct >= 1) {
      alertaMsg = "Limite mensal atingido ou ultrapassado.";
      alertaTone = "destructive";
    } else if (pct >= 0.9) {
      alertaMsg = `Você está em ${pctNum}% do limite.`;
      alertaTone = "destructive";
    } else if (pct >= 0.8) {
      alertaMsg = `Você já usou ${pctNum}% do limite mensal.`;
      alertaTone = "warning";
    } else if (pct >= 0.5) {
      alertaMsg = `Você já usou ${pctNum}% do limite mensal.`;
      alertaTone = "info";
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Limite Mensal</h1>
        <p className="text-sm text-muted-foreground">
          Defina quanto pode gastar neste mês e acompanhe o consumo
        </p>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-info/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => navegar(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Competência
              </div>
              <div className="text-xl font-bold capitalize">
                {nomeMes(mes)}{" "}
                <span className="text-muted-foreground">{ano}</span>
              </div>
            </div>
            <Button size="icon" variant="outline" onClick={() => navegar(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={mes}
              onChange={(e) => escolher(Number(e.target.value), ano)}
              className="h-9 w-32"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </Select>
            <Select
              value={ano}
              onChange={(e) => escolher(mes, Number(e.target.value))}
              className="h-9 w-24"
            >
              {ANOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limite geral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Valor do limite mensal</Label>
            <MoneyInput value={valor} onChange={setValor} />
            <p className="text-xs text-muted-foreground">
              Coloque R$ 0 para remover o limite
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">
                  Incluir gastos do cartão
                </div>
                <div className="text-xs text-muted-foreground">
                  Parcelas e compras à vista no cartão entram no limite
                </div>
              </div>
              <Switch checked={incluiCartao} onCheckedChange={setIncluiCartao} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">
                  Aportes em investimentos
                </div>
                <div className="text-xs text-muted-foreground">
                  Considerar aporte como "gasto" do mês
                </div>
              </div>
              <Switch checked={incluiInvest} onCheckedChange={setIncluiInvest} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSalvar} disabled={busy}>
              {busy ? "Salvando..." : "Salvar limite"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Acompanhamento do limite */}
      {totais.limiteMensal !== null && totais.limiteMensal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acompanhamento do mês</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Kpi label="Limite" value={formatBRL(totais.limiteMensal)} />
              <Kpi
                label="Usado"
                value={formatBRL(totais.limiteUsado)}
                tone="warning"
              />
              <Kpi
                label="Disponível"
                value={formatBRL(totais.limiteDisponivel ?? 0)}
                tone={
                  (totais.limiteDisponivel ?? 0) > 0 ? "success" : "destructive"
                }
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">% usado</span>
                <span className="font-semibold">{pctNum}%</span>
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
                  style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
              </div>
            </div>
            {alertaMsg && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  alertaTone === "destructive"
                    ? "bg-destructive/10 text-destructive"
                    : alertaTone === "warning"
                      ? "bg-warning/10 text-warning"
                      : "bg-info/10 text-info"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                {alertaMsg}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Limites por categoria */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Limites por categoria</CardTitle>
          <Button size="sm" onClick={() => setOpenCatDialog(true)}>
            <Target className="h-4 w-4" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {limitesCategoria.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum limite por categoria definido
            </div>
          ) : (
            <ul className="divide-y">
              {limitesCategoria.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ background: l.categoria.cor ?? "#94a3b8" }}
                    />
                    <span className="font-medium">{l.categoria.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatBRL(l.valor)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleExcluirCategoria(l.id)}
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

      <Dialog open={openCatDialog} onOpenChange={setOpenCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limite por categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
              >
                <option value="">— escolher —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor do limite</Label>
              <MoneyInput value={catValor} onChange={setCatValor} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCatDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarCategoria} disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
