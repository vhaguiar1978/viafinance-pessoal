"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Conta, Transferencia } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowRightLeft,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  criarTransferencia,
  excluirTransferencia,
  type TransferenciaInput,
} from "@/server/actions/transferencias";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

function isoHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TransferenciaFull = Transferencia & {
  origemConta: Conta;
  destinoConta: Conta;
};

export function TransferenciasClient({
  transferencias,
  contas,
}: {
  transferencias: TransferenciaFull[];
  contas: Conta[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<TransferenciaInput>({
    origemContaId: contas[0]?.id ?? "",
    destinoContaId: contas[1]?.id ?? "",
    valor: 0,
    data: isoHoje(),
    descricao: null,
    observacoes: null,
  });

  function abrirForm() {
    setForm({
      origemContaId: contas[0]?.id ?? "",
      destinoContaId: contas[1]?.id ?? contas[0]?.id ?? "",
      valor: 0,
      data: isoHoje(),
      descricao: null,
      observacoes: null,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await criarTransferencia(form);
      toast.success("Transferência registrada");
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta transferência?")) return;
    try {
      await excluirTransferencia(id);
      toast.success("Excluída");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transferências</h1>
          <p className="text-sm text-muted-foreground">
            Movimentações entre suas próprias contas — não contam como despesa
          </p>
        </div>
        <Button onClick={abrirForm} disabled={contas.length < 2}>
          <Plus className="h-4 w-4" /> Nova transferência
        </Button>
      </div>

      {contas.length < 2 && (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <span>
              Você precisa ter pelo menos <b>duas contas</b> cadastradas para
              fazer transferências.
            </span>
          </CardContent>
        </Card>
      )}

      {transferencias.length === 0 ? (
        contas.length >= 2 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="rounded-full bg-muted p-3">
                <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <div className="font-semibold">Nenhuma transferência ainda</div>
                <div className="text-sm text-muted-foreground">
                  Registre movimentações entre suas contas
                </div>
              </div>
              <Button onClick={abrirForm}>
                <Plus className="h-4 w-4" /> Nova transferência
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {transferencias.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="rounded-md bg-info/15 p-2 text-info">
                      <ArrowRightLeft className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {t.origemConta.nome}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {t.destinoConta.nome}
                        </span>
                      </div>
                      {t.descricao && (
                        <div className="text-xs text-muted-foreground">
                          {t.descricao}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDateBR(t.data)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-lg font-bold">
                      {formatBRL(t.valor)}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(t.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova transferência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>De (origem)</Label>
                <Select
                  value={form.origemContaId}
                  onChange={(e) =>
                    setForm({ ...form, origemContaId: e.target.value })
                  }
                  required
                >
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.banco ? ` (${c.banco})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Para (destino)</Label>
                <Select
                  value={form.destinoContaId}
                  onChange={(e) =>
                    setForm({ ...form, destinoContaId: e.target.value })
                  }
                  required
                >
                  {contas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.banco ? ` (${c.banco})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
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
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={form.descricao ?? ""}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value || null })
                }
                placeholder="Ex: Reserva de emergência, separar para viagem"
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
                {busy ? "Salvando..." : "Transferir"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
