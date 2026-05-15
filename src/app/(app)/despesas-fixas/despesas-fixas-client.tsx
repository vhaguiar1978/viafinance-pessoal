"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, Conta, Cartao, DespesaFixa } from "@prisma/client";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Repeat, Calendar } from "lucide-react";
import {
  criarDespesaFixa,
  atualizarDespesaFixa,
  excluirDespesaFixa,
  alternarStatusDespesaFixa,
  type DespesaFixaInput,
  type EscopoEdicao,
} from "@/server/actions/despesas-fixas";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

type DespesaFixaComRelacoes = DespesaFixa & {
  categoria: Categoria | null;
  conta: Conta | null;
  cartao: Cartao | null;
};

interface Props {
  despesas: DespesaFixaComRelacoes[];
  categorias: Categoria[];
  contas: Conta[];
  cartoes: Cartao[];
}

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function DespesasFixasClient({
  despesas,
  categorias,
  contas,
  cartoes,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const [openForm, setOpenForm] = useState(false);
  const [openEscopo, setOpenEscopo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DespesaFixaComRelacoes | null>(null);

  const [form, setForm] = useState<DespesaFixaInput>({
    descricao: "",
    tipoValor: "fixo",
    valor: 0,
    categoriaId: null,
    contaId: null,
    cartaoId: null,
    diaVencimento: 10,
    dataInicio: isoHoje(),
    dataFim: null,
    ativa: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      descricao: "",
      tipoValor: "fixo",
      valor: 0,
      categoriaId: null,
      contaId: null,
      cartaoId: null,
      diaVencimento: 10,
      dataInicio: isoHoje(),
      dataFim: null,
      ativa: true,
    });
    setOpenForm(true);
  }

  function openEdit(d: DespesaFixaComRelacoes) {
    setEditing(d);
    setForm({
      descricao: d.descricao,
      tipoValor: d.tipoValor as "fixo" | "variavel",
      valor: d.valor,
      categoriaId: d.categoriaId,
      contaId: d.contaId,
      cartaoId: d.cartaoId,
      diaVencimento: d.diaVencimento,
      dataInicio: d.dataInicio.toISOString().slice(0, 10),
      dataFim: d.dataFim ? d.dataFim.toISOString().slice(0, 10) : null,
      ativa: d.ativa,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      // Pergunta o escopo
      setOpenForm(false);
      setOpenEscopo(true);
      return;
    }
    setBusy(true);
    try {
      await criarDespesaFixa(form);
      toast.success("Despesa fixa criada");
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function aplicarEscopo(escopo: EscopoEdicao) {
    if (!editing) return;
    setBusy(true);
    try {
      const hoje = new Date();
      await atualizarDespesaFixa(editing.id, form, escopo, {
        mes: hoje.getMonth() + 1,
        ano: hoje.getFullYear(),
      });
      toast.success("Despesa fixa atualizada");
      setOpenEscopo(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAtiva(d: DespesaFixaComRelacoes) {
    try {
      await alternarStatusDespesaFixa(d.id, !d.ativa);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Excluir esta despesa fixa? Isso também remove TODAS as ocorrências mensais geradas.",
      )
    )
      return;
    try {
      await excluirDespesaFixa(id);
      toast.success("Despesa fixa excluída");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Despesas Fixas</h1>
          <p className="text-sm text-muted-foreground">
            Cadastros que se repetem todo mês — automaticamente lançados no
            demonstrativo
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova despesa fixa
        </Button>
      </div>

      <div className="rounded-md border bg-info/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Repeat className="h-4 w-4 text-info" /> Como funciona
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
          <li>
            <b>Valor fixo</b>: usado para contas que não mudam (aluguel,
            internet, assinatura).
          </li>
          <li>
            <b>Valor variável</b>: o valor cadastrado é uma previsão. No mês
            informe o valor real (luz, água, gás).
          </li>
          <li>
            Se você informar o valor real, ele só vale para aquele mês — os
            próximos continuam com a previsão.
          </li>
        </ul>
      </div>

      {despesas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Repeat className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold">
                Nenhuma despesa fixa cadastrada
              </div>
              <div className="text-sm text-muted-foreground">
                Comece pelo aluguel, internet ou conta de luz
              </div>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova despesa fixa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {despesas.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  <div
                    className="mt-1 h-9 w-9 shrink-0 rounded-md"
                    style={{
                      background: d.categoria?.cor ?? "#94a3b8",
                      opacity: d.ativa ? 1 : 0.5,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{d.descricao}</span>
                      {d.categoria && (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                          style={{ background: d.categoria.cor ?? "#94a3b8" }}
                        >
                          {d.categoria.nome}
                        </span>
                      )}
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase text-white shadow-sm"
                        style={{
                          background:
                            d.tipoValor === "fixo" ? "#475569" : "#0ea5e9",
                        }}
                      >
                        {d.tipoValor === "fixo" ? "Valor fixo" : "Variável"}
                      </span>
                      {!d.ativa && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Inativa
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Vence dia {d.diaVencimento}</span>
                      {d.categoria && <span>• {d.categoria.nome}</span>}
                      {d.conta && <span>• {d.conta.nome}</span>}
                      {d.cartao && <span>• {d.cartao.nome}</span>}
                      <span>• Início {formatDateBR(d.dataInicio)}</span>
                      {d.dataFim && (
                        <span>• Fim {formatDateBR(d.dataFim)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {d.tipoValor === "fixo" ? "Valor" : "Previsão"}
                    </div>
                    <div className="text-lg font-bold">
                      {formatBRL(d.valor)}
                    </div>
                  </div>
                  <Switch
                    checked={d.ativa}
                    onCheckedChange={() => toggleAtiva(d)}
                    aria-label="Ativar/desativar"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar despesa fixa" : "Nova despesa fixa"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Ex: Internet, Aluguel, Conta de Luz"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de valor</Label>
                <Select
                  value={form.tipoValor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipoValor: e.target.value as "fixo" | "variavel",
                    })
                  }
                >
                  <option value="fixo">Valor fixo (todo mês igual)</option>
                  <option value="variavel">
                    Valor variável (previsão + valor real)
                  </option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {form.tipoValor === "fixo" ? "Valor mensal" : "Valor previsto"}
                </Label>
                <MoneyInput
                  value={form.valor}
                  onChange={(v) => setForm({ ...form, valor: v })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.categoriaId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, categoriaId: e.target.value || null })
                  }
                >
                  <option value="">— Sem categoria —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dia do vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaVencimento}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      diaVencimento: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                  <option value="">— Não pagar por conta —</option>
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
                  <option value="">— Não pagar por cartão —</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input
                  type="date"
                  value={form.dataInicio}
                  onChange={(e) =>
                    setForm({ ...form, dataInicio: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data final (opcional)</Label>
                <Input
                  type="date"
                  value={form.dataFim ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, dataFim: e.target.value || null })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm font-medium">Ativa</div>
              <Switch
                checked={form.ativa}
                onCheckedChange={(v) => setForm({ ...form, ativa: v })}
              />
            </div>

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

      {/* Diálogo do escopo de edição */}
      <Dialog open={openEscopo} onOpenChange={setOpenEscopo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar alteração para quais meses?</DialogTitle>
            <DialogDescription>
              Você está editando uma despesa fixa que já existe. Escolha o
              escopo da mudança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => aplicarEscopo("este-mes")}
              className="w-full rounded-md border p-4 text-left hover:bg-accent transition disabled:opacity-50"
            >
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="h-4 w-4 text-info" /> Somente este mês
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                A mudança vale apenas para a competência atual. Os próximos
                meses continuam como estão.
              </div>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => aplicarEscopo("todos-proximos")}
              className="w-full rounded-md border p-4 text-left hover:bg-accent transition disabled:opacity-50"
            >
              <div className="flex items-center gap-2 font-medium">
                <Repeat className="h-4 w-4 text-primary" /> Para todos os meses
                seguintes
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Atualiza o cadastro. Vale a partir deste mês — meses passados
                permanecem intactos.
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenEscopo(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
