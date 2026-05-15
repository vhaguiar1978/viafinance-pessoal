"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import {
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  CategoriaInput,
} from "@/server/actions/categorias";
import { useToast } from "@/components/toast-provider";

const CORES = [
  "#0a0a0a", // preto
  "#475569", // prata
  "#b45309", // dourado
  "#0ea5e9", // azul
  "#06b6d4", // ciano
  "#10b981", // verde
  "#22c55e", // verde claro
  "#6366f1", // indigo
  "#8b5cf6", // violeta
  "#a855f7", // roxo
  "#ec4899", // rosa
  "#ef4444", // vermelho
  "#f97316", // laranja
  "#facc15", // amarelo
  "#84cc16", // lima
  "#92400e", // marrom
  "#94a3b8", // cinza
];

export function CategoriasClient({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const toast = useToast();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState<CategoriaInput>({
    nome: "",
    tipo: "despesa",
    cor: CORES[0],
    icone: null,
  });

  function openCreate(tipo: "despesa" | "receita") {
    setEditing(null);
    setForm({ nome: "", tipo, cor: CORES[0], icone: null });
    setOpenForm(true);
  }

  function openEdit(c: Categoria) {
    setEditing(c);
    setForm({
      nome: c.nome,
      tipo: c.tipo as CategoriaInput["tipo"],
      cor: c.cor ?? CORES[0],
      icone: c.icone,
    });
    setOpenForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) await atualizarCategoria(editing.id, form);
      else await criarCategoria(form);
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setOpenForm(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta categoria?")) return;
    try {
      await excluirCategoria(id);
      toast.success("Categoria excluída");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  const despesas = categorias.filter((c) => c.tipo === "despesa");
  const receitas = categorias.filter((c) => c.tipo === "receita");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categorias</h1>
        <p className="text-sm text-muted-foreground">
          Organize seus lançamentos por categoria
        </p>
      </div>

      <Tabs defaultValue="despesa">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="despesa">Despesas ({despesas.length})</TabsTrigger>
            <TabsTrigger value="receita">Receitas ({receitas.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="despesa" className="mt-4">
          <Lista
            categorias={despesas}
            tipo="despesa"
            onCreate={() => openCreate("despesa")}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="receita" className="mt-4">
          <Lista
            categorias={receitas}
            tipo="receita"
            onCreate={() => openCreate("receita")}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar categoria" : "Nova categoria"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo: e.target.value as CategoriaInput["tipo"],
                  })
                }
              >
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </Select>
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

function Lista({
  categorias,
  tipo,
  onCreate,
  onEdit,
  onDelete,
}: {
  categorias: Categoria[];
  tipo: "despesa" | "receita";
  onCreate: () => void;
  onEdit: (c: Categoria) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-end">
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </div>
        {categorias.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <div className="rounded-full bg-muted p-3">
              <Tag className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">
              Nenhuma categoria de {tipo} ainda
            </div>
          </div>
        ) : (
          <ul className="divide-y">
            {categorias.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
                    style={{ background: c.cor ?? "#94a3b8" }}
                  >
                    {c.nome}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(c)}
                    aria-label="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(c.id)}
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
