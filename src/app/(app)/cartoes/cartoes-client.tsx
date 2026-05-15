"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Cartao } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import {
  criarCartao,
  atualizarCartao,
  excluirCartao,
  CartaoInput,
} from "@/server/actions/cartoes";
import { formatBRL } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

const CORES = [
  "#0a0a0a", // preto (black card / premium)
  "#475569", // grafite / silver
  "#b45309", // dourado / gold
  "#6366f1", // indigo
  "#0ea5e9", // azul
  "#10b981", // verde
  "#06b6d4", // ciano
  "#a855f7", // roxo
  "#ec4899", // rosa
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#facc15", // amarelo
  "#84cc16", // lima
  "#92400e", // marrom
];

type CartaoComUso = Cartao & { limiteUsado: number };

export function CartoesClient({ cartoes }: { cartoes: CartaoComUso[] }) {
  const router = useRouter();
  const toast = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Cartao | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<CartaoInput>({
    nome: "",
    banco: null,
    limite: 0,
    diaFechamento: 28,
    diaVencimento: 10,
    cor: CORES[0],
    ativo: true,
  });

  function openCreate() {
    setEditing(null);
    setForm({
      nome: "",
      banco: null,
      limite: 0,
      diaFechamento: 28,
      diaVencimento: 10,
      cor: CORES[0],
      ativo: true,
    });
    setOpenForm(true);
  }

  function openEdit(c: Cartao) {
    setEditing(c);
    setForm({
      nome: c.nome,
      banco: c.banco ?? null,
      limite: c.limite,
      diaFechamento: c.diaFechamento,
      diaVencimento: c.diaVencimento,
      cor: c.cor ?? CORES[0],
      ativo: c.ativo,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await atualizarCartao(editing.id, form);
      else await criarCartao(form);
      toast.success(editing ? "Cartão atualizado" : "Cartão criado");
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este cartão?")) return;
    try {
      await excluirCartao(id);
      toast.success("Cartão excluído");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões</h1>
          <p className="text-sm text-muted-foreground">
            Seus cartões de crédito e seus vencimentos
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo cartão
        </Button>
      </div>

      {cartoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold">Nenhum cartão cadastrado</div>
              <div className="text-sm text-muted-foreground">
                Cadastre seus cartões pra controlar gastos e faturas
              </div>
            </div>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo cartão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div
                className="flex h-32 flex-col justify-between p-5 text-white"
                style={{
                  background: `linear-gradient(135deg, ${c.cor ?? "#6366f1"}, ${c.cor ?? "#6366f1"}dd)`,
                }}
              >
                <div className="flex items-start justify-between">
                  <CreditCard className="h-6 w-6 opacity-80" />
                  {!c.ativo && <Badge variant="muted">Inativo</Badge>}
                </div>
                <div>
                  <div className="text-xs uppercase opacity-80">
                    {c.banco ?? "Cartão"}
                  </div>
                  <div className="text-lg font-semibold">{c.nome}</div>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Usado</div>
                    <div className="font-semibold">
                      {formatBRL(c.limiteUsado)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Disponível
                    </div>
                    <div className="font-semibold text-success">
                      {formatBRL(Math.max(0, c.limite - c.limiteUsado))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Fecha / Vence
                    </div>
                    <div className="font-semibold">
                      {c.diaFechamento}/{c.diaVencimento}
                    </div>
                  </div>
                </div>
                {c.limite > 0 && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        c.limiteUsado / c.limite > 0.9
                          ? "bg-destructive"
                          : c.limiteUsado / c.limite > 0.7
                            ? "bg-warning"
                            : "bg-primary"
                      }`}
                      style={{
                        width: `${Math.min(100, (c.limiteUsado / c.limite) * 100)}%`,
                      }}
                    />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/cartoes/${c.id}`}>Ver fatura</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
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
              {editing ? "Editar cartão" : "Novo cartão"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do cartão</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Nubank Roxinho"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Banco / bandeira</Label>
                <Input
                  value={form.banco ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, banco: e.target.value || null })
                  }
                  placeholder="Ex: Nubank, Itaú, Visa"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Limite</Label>
              <MoneyInput
                value={form.limite}
                onChange={(v) => setForm({ ...form, limite: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dia do fechamento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaFechamento}
                  onChange={(e) =>
                    setForm({ ...form, diaFechamento: Number(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Dia do vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.diaVencimento}
                  onChange={(e) =>
                    setForm({ ...form, diaVencimento: Number(e.target.value) })
                  }
                  required
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
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="text-sm font-medium">Cartão ativo</div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
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
    </div>
  );
}
