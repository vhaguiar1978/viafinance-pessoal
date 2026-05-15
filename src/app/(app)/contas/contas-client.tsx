"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Conta } from "@prisma/client";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import {
  criarConta,
  atualizarConta,
  excluirConta,
  ContaInput,
} from "@/server/actions/contas";
import { formatBRL } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const CORES = [
  "#0a0a0a", // preto
  "#475569", // prata
  "#b45309", // dourado
  "#10b981", // verde
  "#0ea5e9", // azul
  "#06b6d4", // ciano
  "#6366f1", // indigo
  "#a855f7", // roxo
  "#ec4899", // rosa
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#facc15", // amarelo
  "#84cc16", // lima
  "#92400e", // marrom
];

const TIPO_LABEL: Record<string, string> = {
  corrente: "Conta corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  carteira: "Carteira",
  corretora: "Corretora",
  outra: "Outra",
};

export function ContasClient({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const toast = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Conta | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<ContaInput>({
    nome: "",
    banco: null,
    tipo: "corrente",
    saldoInicial: 0,
    cor: CORES[0],
    ativa: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      nome: "",
      banco: null,
      tipo: "corrente",
      saldoInicial: 0,
      cor: CORES[0],
      ativa: true,
    });
    setOpenForm(true);
  }

  function openEdit(c: Conta) {
    setEditing(c);
    setForm({
      nome: c.nome,
      banco: c.banco ?? null,
      tipo: c.tipo as ContaInput["tipo"],
      saldoInicial: c.saldoInicial,
      cor: c.cor ?? CORES[0],
      ativa: c.ativa,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await atualizarConta(editing.id, form);
        toast.success("Conta atualizada");
      } else {
        await criarConta(form);
        toast.success("Conta criada");
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
    if (!confirm("Excluir esta conta?")) return;
    try {
      await excluirConta(id);
      toast.success("Conta excluída");
      router.refresh();
    } catch (err) {
      toast.error(
        "Erro ao excluir",
        err instanceof Error ? err.message : "Falha",
      );
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas</h1>
          <p className="text-sm text-muted-foreground">
            Contas correntes, poupança e dinheiro em espécie
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      {contas.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contas.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div
                className="h-1.5 w-full"
                style={{ background: c.cor ?? "#94a3b8" }}
              />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                      style={{ background: c.cor ?? "#94a3b8" }}
                    >
                      {TIPO_LABEL[c.tipo] ?? c.tipo}
                      {c.banco ? ` • ${c.banco}` : ""}
                    </span>
                    <div className="mt-2 text-base font-semibold">{c.nome}</div>
                  </div>
                  {!c.ativa && <Badge variant="muted">Inativa</Badge>}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Saldo inicial
                </div>
                <div className="text-xl font-bold">
                  {formatBRL(c.saldoInicial)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/contas/${c.id}`}>Ver extrato</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(c)}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
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
              {editing ? "Editar conta" : "Nova conta"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Conta principal"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Banco / instituição</Label>
                <Input
                  value={form.banco ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, banco: e.target.value || null })
                  }
                  placeholder="Ex: Nubank, Itaú, XP"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tipo: e.target.value as ContaInput["tipo"],
                    })
                  }
                >
                  <option value="corrente">Conta corrente</option>
                  <option value="poupanca">Poupança</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="carteira">Carteira</option>
                  <option value="corretora">Corretora</option>
                  <option value="outra">Outra</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Saldo inicial</Label>
                <MoneyInput
                  value={form.saldoInicial}
                  onChange={(v) => setForm({ ...form, saldoInicial: v })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setForm({ ...form, cor: c })}
                    className={`h-7 w-7 rounded-full border-2 transition ${form.cor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Conta ativa</div>
                <div className="text-xs text-muted-foreground">
                  Aparece na hora de lançar despesas
                </div>
              </div>
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
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="rounded-full bg-muted p-3">
          <Wallet className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <div className="font-semibold">Nenhuma conta cadastrada</div>
          <div className="text-sm text-muted-foreground">
            Crie sua primeira conta para começar a lançar movimentações
          </div>
        </div>
        <Button onClick={onCreate}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </CardContent>
    </Card>
  );
}
