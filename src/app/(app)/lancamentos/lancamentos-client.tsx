"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Cartao, Categoria, Conta, Lancamento } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/status-badge";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeftRight,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import {
  criarLancamento,
  atualizarLancamento,
  excluirLancamento,
  marcarLancamentoPago,
  type LancamentoInput,
} from "@/server/actions/lancamentos";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

type LancamentoComRelacoes = Lancamento & {
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
};

interface Props {
  lancamentos: LancamentoComRelacoes[];
  categorias: Categoria[];
  contas: Conta[];
  cartoes: Cartao[];
}

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LancamentosClient({
  lancamentos,
  categorias,
  contas,
  cartoes,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const [openForm, setOpenForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<LancamentoComRelacoes | null>(null);

  const [form, setForm] = useState<LancamentoInput>({
    descricao: "",
    valor: 0,
    data: isoHoje(),
    tipo: "despesa",
    status: "paga",
    formaPagamento: "conta",
    categoriaId: null,
    contaId: null,
    cartaoId: null,
    ehAssinatura: false,
    ehDespesaFixaMensal: false,
    tipoValorFixa: "fixo",
    diaVencimentoFixa: new Date().getDate(),
    dataInicioFixa: isoHoje(),
    dataFimFixa: null,
    observacoes: null,
  });

  // Abre o form automaticamente quando vier ?novo=1 (FAB / atalho PWA)
  useEffect(() => {
    if (params.get("novo") === "1") {
      openCreate();
      router.replace("/lancamentos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-sugestão de categoria com base na descrição (item 20)
  useEffect(() => {
    if (editing) return;
    if (!openForm) return;
    if (!form.descricao || form.descricao.length < 3) return;
    if (form.categoriaId) return; // não sobrescreve escolha manual
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descricao: form.descricao, tipo: form.tipo }),
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j.categoriaId) {
          setForm((cur) =>
            cur.categoriaId ? cur : { ...cur, categoriaId: j.categoriaId },
          );
        }
      } catch {
        /* silencioso */
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.descricao, form.tipo, openForm, editing]);

  function openCreate() {
    setEditing(null);
    setForm({
      descricao: "",
      valor: 0,
      data: isoHoje(),
      tipo: "despesa",
      status: "paga",
      formaPagamento: "conta",
      categoriaId: null,
      contaId: null,
      cartaoId: null,
      ehAssinatura: false,
      ehDespesaFixaMensal: false,
      tipoValorFixa: "fixo",
      diaVencimentoFixa: new Date().getDate(),
      dataInicioFixa: isoHoje(),
      dataFimFixa: null,
      observacoes: null,
    });
    setOpenForm(true);
  }

  function openEdit(l: LancamentoComRelacoes) {
    setEditing(l);
    setForm({
      descricao: l.descricao,
      valor: l.valor,
      data: l.data.toISOString().slice(0, 10),
      tipo: l.tipo as "despesa" | "receita",
      status: l.status as LancamentoInput["status"],
      formaPagamento: l.formaPagamento as LancamentoInput["formaPagamento"],
      categoriaId: l.categoriaId,
      contaId: l.contaId,
      cartaoId: l.cartaoId,
      ehAssinatura: l.ehAssinatura,
      ehDespesaFixaMensal: false,
      tipoValorFixa: "fixo",
      diaVencimentoFixa: new Date().getDate(),
      dataInicioFixa: isoHoje(),
      dataFimFixa: null,
      observacoes: l.observacoes,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await atualizarLancamento(editing.id, form);
        toast.success("Lançamento atualizado");
      } else {
        const r = await criarLancamento(form);
        if (r.tipo === "despesa-fixa") {
          toast.success(
            "Despesa fixa criada",
            "Ela aparecerá no demonstrativo todo mês",
          );
        } else if (r.tipo === "parcelado") {
          toast.success(
            `${r.total} parcelas criadas`,
            "Limite do cartão foi abatido só uma vez",
          );
        } else if (r.tipo === "cartao") {
          toast.success("Compra no cartão criada");
        } else {
          toast.success("Lançamento criado");
        }
      }
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    try {
      await excluirLancamento(id);
      toast.success("Lançamento excluído");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function handlePagar(id: string) {
    try {
      await marcarLancamentoPago(id);
      toast.success("Marcado como pago");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  const categoriasDoTipo = categorias.filter((c) => c.tipo === form.tipo);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "receita" | "despesa">(
    "todos",
  );
  const [filtroContaId, setFiltroContaId] = useState<string>("todas");
  const [filtroCartaoId, setFiltroCartaoId] = useState<string>("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  const lancamentosFiltrados = lancamentos.filter((l) => {
    if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
    if (filtroContaId !== "todas" && (l.contaId ?? "") !== filtroContaId)
      return false;
    if (filtroCartaoId !== "todos" && (l.cartaoId ?? "") !== filtroCartaoId)
      return false;
    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      if (!l.descricao.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totaisFiltrados = {
    entradas: lancamentosFiltrados
      .filter((l) => l.tipo === "receita" && l.status !== "cancelada")
      .reduce((acc, l) => acc + l.valor, 0),
    saidas: lancamentosFiltrados
      .filter((l) => l.tipo === "despesa" && l.status !== "cancelada")
      .reduce((acc, l) => acc + l.valor, 0),
  };

  function limparFiltros() {
    setFiltroTipo("todos");
    setFiltroContaId("todas");
    setFiltroCartaoId("todos");
    setFiltroBusca("");
  }

  const temFiltros =
    filtroTipo !== "todos" ||
    filtroContaId !== "todas" ||
    filtroCartaoId !== "todos" ||
    filtroBusca !== "";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">
            Despesas, receitas, parcelas e assinaturas
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo lançamento
        </Button>
      </div>

      {/* Filtros */}
      {lancamentos.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {/* Toggle tipo: Entradas / Saídas / Tudo */}
              <div className="flex rounded-md border bg-muted/20 p-0.5 lg:col-span-2">
                <button
                  type="button"
                  onClick={() => setFiltroTipo("todos")}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${filtroTipo === "todos" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Tudo
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("receita")}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${filtroTipo === "receita" ? "bg-success/20 text-success shadow-sm" : "text-muted-foreground"}`}
                >
                  ↓ Entradas
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo("despesa")}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${filtroTipo === "despesa" ? "bg-destructive/15 text-destructive shadow-sm" : "text-muted-foreground"}`}
                >
                  ↑ Saídas
                </button>
              </div>

              <Select
                value={filtroContaId}
                onChange={(e) => setFiltroContaId(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="todas">Todas as contas</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.banco ? ` (${c.banco})` : ""}
                  </option>
                ))}
              </Select>

              <Select
                value={filtroCartaoId}
                onChange={(e) => setFiltroCartaoId(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="todos">Todos os cartões</option>
                {cartoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>

              <Input
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                placeholder="Buscar descrição..."
                className="h-9 text-xs"
              />
            </div>

            {/* Resumo dos filtros */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>
                  <b className="text-foreground">{lancamentosFiltrados.length}</b>{" "}
                  lançamento(s)
                </span>
                {totaisFiltrados.entradas > 0 && (
                  <span className="text-success">
                    ↓ +{formatBRL(totaisFiltrados.entradas)}
                  </span>
                )}
                {totaisFiltrados.saidas > 0 && (
                  <span className="text-destructive">
                    ↑ −{formatBRL(totaisFiltrados.saidas)}
                  </span>
                )}
              </div>
              {temFiltros && (
                <Button size="sm" variant="ghost" onClick={limparFiltros}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lancamentos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold">Nenhum lançamento ainda</div>
              <div className="text-sm text-muted-foreground">
                Registre suas movimentações para começar a usar o demonstrativo
              </div>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {lancamentosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum lançamento corresponde aos filtros.
              </div>
            ) : (
            <ul className="divide-y">
              {lancamentosFiltrados.map((l) => (
                <li
                  key={l.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 items-start gap-3">
                    <div
                      className={`mt-1 h-9 w-9 shrink-0 rounded-md ${l.tipo === "receita" ? "bg-success/20 text-success" : "bg-destructive/15 text-destructive"} flex items-center justify-center font-bold`}
                    >
                      {l.tipo === "receita" ? "+" : "-"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{l.descricao}</span>
                        <StatusBadge status={l.status} />
                        {l.parcelaGrupoId && (
                          <span className="text-xs text-muted-foreground">
                            Parcela {l.parcelaAtual}/{l.totalParcelas}
                          </span>
                        )}
                        {l.ehAssinatura && (
                          <span className="rounded-full bg-info/15 px-2 py-0.5 text-xs text-info">
                            Assinatura
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDateBR(l.data)}</span>
                        {l.categoria && <span>• {l.categoria.nome}</span>}
                        {l.conta && <span>• {l.conta.nome}</span>}
                        {l.cartao && <span>• {l.cartao.nome}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className={`text-right text-lg font-bold ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}
                    >
                      {l.tipo === "receita" ? "+" : "−"} {formatBRL(l.valor)}
                    </div>
                    {l.status !== "paga" && l.status !== "cancelada" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handlePagar(l.id)}
                        aria-label="Marcar como pago"
                      >
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(l)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(l.id)}
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
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar lançamento" : "Novo lançamento"}
            </DialogTitle>
            {!editing && (
              <DialogDescription>
                Para despesas que se repetem todo mês, marque "Despesa fixa
                mensal".
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo: e.target.value as "despesa" | "receita",
                      categoriaId: null,
                      ehDespesaFixaMensal:
                        e.target.value === "despesa"
                          ? form.ehDespesaFixaMensal
                          : false,
                    })
                  }
                >
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as LancamentoInput["status"],
                    })
                  }
                >
                  <option value="paga">Paga</option>
                  <option value="prevista">Prevista</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="atrasada">Atrasada</option>
                  <option value="cancelada">Cancelada</option>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Ex: Almoço, Salário, Aluguel"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor</Label>
                <MoneyInput
                  value={form.valor}
                  onChange={(v) => setForm({ ...form, valor: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoriaId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, categoriaId: e.target.value || null })
                  }
                >
                  <option value="">— Sem categoria —</option>
                  {categoriasDoTipo.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta</Label>
                <Select
                  value={form.contaId ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contaId: e.target.value || null,
                      cartaoId: e.target.value ? null : form.cartaoId,
                    })
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
              <div className="space-y-2">
                <Label>Cartão</Label>
                <Select
                  value={form.cartaoId ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cartaoId: e.target.value || null,
                      contaId: e.target.value ? null : form.contaId,
                    })
                  }
                >
                  <option value="">—</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Marcador: Despesa fixa mensal (item 1 da especificação) */}
            {!editing && form.tipo === "despesa" && (
              <div className="rounded-md border bg-info/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Repeat className="h-4 w-4 text-info" /> Despesa fixa
                      mensal
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Marque se essa despesa se repete todo mês
                    </div>
                  </div>
                  <Switch
                    checked={form.ehDespesaFixaMensal}
                    onCheckedChange={(v) =>
                      setForm({ ...form, ehDespesaFixaMensal: v })
                    }
                  />
                </div>

                {form.ehDespesaFixaMensal && (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, tipoValorFixa: "fixo" })
                        }
                        className={`rounded-md border p-3 text-left transition ${form.tipoValorFixa === "fixo" ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="text-sm font-medium">Valor fixo</div>
                        <div className="text-xs text-muted-foreground">
                          Mesmo valor todo mês (internet, aluguel)
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setForm({ ...form, tipoValorFixa: "variavel" })
                        }
                        className={`rounded-md border p-3 text-left transition ${form.tipoValorFixa === "variavel" ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="text-sm font-medium">Valor variável</div>
                        <div className="text-xs text-muted-foreground">
                          Muda mês a mês (luz, água, gás)
                        </div>
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Dia do vencimento</Label>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={form.diaVencimentoFixa ?? 1}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              diaVencimentoFixa: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Início</Label>
                        <Input
                          type="date"
                          value={form.dataInicioFixa ?? form.data}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              dataInicioFixa: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Fim (opcional)</Label>
                        <Input
                          type="date"
                          value={form.dataFimFixa ?? ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              dataFimFixa: e.target.value || null,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parcelas (só aparece quando faz sentido) */}
            {!editing &&
              form.tipo === "despesa" &&
              !form.ehDespesaFixaMensal && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    {(form.totalParcelas ?? 1) > 1
                      ? "Parcelas (valor acima = valor da parcela)"
                      : "Parcelas"}
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={form.totalParcelas ?? 1}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        totalParcelas: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                  {form.cartaoId && (form.totalParcelas ?? 1) > 1 && (
                    <p className="text-xs text-info">
                      Total da compra: {(form.valor * (form.totalParcelas ?? 1)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} •
                      abate o limite uma só vez no mês da 1ª parcela
                    </p>
                  )}
                  {!form.cartaoId && (
                    <p className="text-xs text-muted-foreground">
                      Para parcelar em vários meses
                    </p>
                  )}
                </div>
                <div className="flex items-end justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">Assinatura</div>
                    <div className="text-xs text-muted-foreground">
                      Streaming, software, app
                    </div>
                  </div>
                  <Switch
                    checked={form.ehAssinatura}
                    onCheckedChange={(v) =>
                      setForm({ ...form, ehAssinatura: v })
                    }
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenForm(false)}
              >
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
