"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinancialGoal } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Target,
  TrendingUp,
  Check,
} from "lucide-react";
import {
  criarMeta,
  atualizarMeta,
  ajustarValorMeta,
  excluirMeta,
  type MetaInput,
} from "@/server/actions/metas";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const CAT_LABEL: Record<string, string> = {
  emergencia: "Reserva de emergência",
  viagem: "Viagem",
  imovel: "Imóvel",
  veiculo: "Veículo",
  educacao: "Educação",
  aposentadoria: "Aposentadoria",
  outros: "Outros",
};

export function MetasClient({ metas }: { metas: FinancialGoal[] }) {
  const router = useRouter();
  const toast = useToast();

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const [openAjuste, setOpenAjuste] = useState<FinancialGoal | null>(null);
  const [valorAjuste, setValorAjuste] = useState(0);

  const [form, setForm] = useState<MetaInput>({
    nome: "",
    valorAlvo: 0,
    valorAtual: 0,
    prazo: null,
    categoria: "outros",
    observacao: null,
    status: "em_andamento",
  });

  function abrir(m?: FinancialGoal) {
    if (m) {
      setEditing(m);
      setForm({
        nome: m.nome,
        valorAlvo: m.valorAlvo,
        valorAtual: m.valorAtual,
        prazo: m.prazo?.toISOString().slice(0, 10) ?? null,
        categoria: m.categoria as MetaInput["categoria"],
        observacao: m.observacao,
        status: m.status as MetaInput["status"],
      });
    } else {
      setEditing(null);
      setForm({
        nome: "",
        valorAlvo: 0,
        valorAtual: 0,
        prazo: null,
        categoria: "outros",
        observacao: null,
        status: "em_andamento",
      });
    }
    setOpenForm(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await atualizarMeta(editing.id, form);
      else await criarMeta(form);
      toast.success(editing ? "Meta atualizada" : "Meta criada");
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function deletar(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    try {
      await excluirMeta(id);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function confirmarAjuste() {
    if (!openAjuste) return;
    setBusy(true);
    try {
      await ajustarValorMeta(openAjuste.id, valorAjuste);
      toast.success("Progresso atualizado");
      setOpenAjuste(null);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metas financeiras</h1>
          <p className="text-sm text-muted-foreground">
            Defina objetivos e acompanhe seu progresso
          </p>
        </div>
        <Button onClick={() => abrir()}>
          <Plus className="h-4 w-4" /> Nova meta
        </Button>
      </div>

      {metas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="font-semibold">Nenhuma meta cadastrada</div>
            <div className="text-sm text-muted-foreground">
              Exemplos: reserva de emergência, viagem, comprar carro
            </div>
            <Button onClick={() => abrir()}>
              <Plus className="h-4 w-4" /> Nova meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {metas.map((m) => {
            const pct = m.valorAlvo > 0 ? Math.min(1, m.valorAtual / m.valorAlvo) : 0;
            const falta = Math.max(0, m.valorAlvo - m.valorAtual);
            const concluida = m.status === "concluida";
            const mesesRestantes = m.prazo
              ? Math.max(
                  1,
                  Math.ceil(
                    (m.prazo.getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24 * 30),
                  ),
                )
              : null;
            const aporteIdeal = mesesRestantes ? falta / mesesRestantes : null;
            return (
              <Card key={m.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{m.nome}</span>
                        {m.categoria && (
                          <Badge variant="secondary" className="text-[10px]">
                            {CAT_LABEL[m.categoria] ?? m.categoria}
                          </Badge>
                        )}
                        {concluida && (
                          <Badge variant="success">
                            <Check className="mr-1 h-3 w-3" /> Concluída
                          </Badge>
                        )}
                        {m.status === "cancelada" && (
                          <Badge variant="muted">Cancelada</Badge>
                        )}
                      </div>
                      {m.prazo && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Prazo: {formatDateBR(m.prazo)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setOpenAjuste(m);
                          setValorAjuste(m.valorAtual);
                        }}
                        title="Atualizar progresso"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => abrir(m)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deletar(m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span>
                        <b>{formatBRL(m.valorAtual)}</b>
                        <span className="text-muted-foreground">
                          {" / "}
                          {formatBRL(m.valorAlvo)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(pct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${concluida ? "bg-success" : "bg-primary"}`}
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <div>Falta</div>
                      <div className="font-semibold text-foreground">
                        {formatBRL(falta)}
                      </div>
                    </div>
                    {aporteIdeal !== null && !concluida && (
                      <div>
                        <div>Aporte ideal/mês</div>
                        <div className="font-semibold text-foreground">
                          {formatBRL(aporteIdeal)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog form */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Reserva de emergência"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor alvo</Label>
                <MoneyInput
                  value={form.valorAlvo}
                  onChange={(v) => setForm({ ...form, valorAlvo: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor atual</Label>
                <MoneyInput
                  value={form.valorAtual}
                  onChange={(v) => setForm({ ...form, valorAtual: v })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoria ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categoria: (e.target.value as MetaInput["categoria"]) || null,
                    })
                  }
                >
                  {Object.entries(CAT_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo (opcional)</Label>
                <Input
                  type="date"
                  value={form.prazo ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, prazo: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input
                value={form.observacao ?? ""}
                onChange={(e) =>
                  setForm({ ...form, observacao: e.target.value || null })
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog ajuste rápido */}
      <Dialog open={!!openAjuste} onOpenChange={(o) => !o && setOpenAjuste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar progresso</DialogTitle>
          </DialogHeader>
          {openAjuste && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Meta: <b className="text-foreground">{openAjuste.nome}</b>
              </div>
              <div className="space-y-2">
                <Label>Novo valor atual</Label>
                <MoneyInput value={valorAjuste} onChange={setValorAjuste} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAjuste(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmarAjuste} disabled={busy}>
              {busy ? "Salvando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
