"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Categoria,
  Conta,
  ImportBatch,
  ImportedTransaction,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Zap,
  Eye,
  Sparkles,
} from "lucide-react";
import {
  criarImportBatch,
  importarDireto,
  confirmarImportBatch,
  cancelarImportBatch,
  atualizarTransacaoImportada,
} from "@/server/actions/importacao";
import { formatBRL, formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";

type BatchFull = ImportBatch & {
  conta: Conta | null;
  transactions: (ImportedTransaction & { categoria: Categoria | null })[];
};

interface Props {
  contas: Conta[];
  categorias: Categoria[];
  batches: BatchFull[];
}

export function ImportarClient({ contas, categorias, batches }: Props) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [origem, setOrigem] = useState("");
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [resumo, setResumo] = useState<{
    importadas: number;
    duplicadas: number;
    total: number;
  } | null>(null);
  const [deteccao, setDeteccao] = useState<{
    banco: string;
    confianca: number;
    contaSugeridaNome: string | null;
  } | null>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setFilename(file.name);
    const baseName = file.name.replace(/\.[a-z]+$/i, "");
    if (!nome) setNome(baseName);
    setResumo(null);
    setDeteccao(null);

    const isPDF =
      file.name.toLowerCase().endsWith(".pdf") ||
      file.type === "application/pdf";

    if (isPDF) {
      // Pipeline PDF: server extrai texto e devolve um CSV equivalente
      try {
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/extract-pdf", {
          method: "POST",
          body: fd,
        });
        const j = await r.json();
        if (!r.ok) {
          toast.error(
            "Não consegui ler o PDF",
            j.error ?? "Tente exportar em CSV ou OFX",
          );
          setFilename(null);
          setCsv("");
          return;
        }
        setCsv(j.csv);
        toast.success(
          `${j.totalLinhas} transações extraídas do PDF`,
          j.banco ? `Banco detectado: ${j.banco}` : undefined,
        );
        if (j.banco) {
          setDeteccao({
            banco: j.banco,
            confianca: j.confianca ?? 0,
            contaSugeridaNome: j.contaSugeridaNome ?? null,
          });
          if (!origem) setOrigem(j.banco);
          if (j.contaSugeridaId) setContaId(j.contaSugeridaId);
        }
      } catch (err) {
        toast.error(
          "Erro ao ler PDF",
          err instanceof Error ? err.message : "Falha",
        );
        setFilename(null);
        setCsv("");
      }
      return;
    }

    // Pipeline CSV (atual)
    const text = await file.text();
    setCsv(text);

    try {
      const r = await fetch("/api/detect-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text.slice(0, 50_000) }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.detectado) {
          setDeteccao(j.detectado);
          if (!origem) setOrigem(j.detectado.banco);
          if (j.detectado.contaSugeridaId) {
            setContaId(j.detectado.contaSugeridaId);
          }
        }
      }
    } catch {
      // silencioso
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    await handleFiles(e.dataTransfer.files);
  }

  async function importarTudoDeUmaVez() {
    if (!csv || !nome) {
      toast.error("Selecione um arquivo");
      return;
    }
    setBusy(true);
    try {
      const r = await importarDireto({
        nome,
        csv,
        origem: origem || null,
        contaId: contaId || null,
      });
      toast.success(
        `${r.importadas} lançamentos importados`,
        r.duplicadas > 0
          ? `${r.duplicadas} duplicada(s) ignorada(s)`
          : undefined,
      );
      setResumo(r);
      setCsv("");
      setFilename(null);
      setNome("");
      setOrigem("");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function gerarPrevia() {
    if (!csv || !nome) {
      toast.error("Selecione um arquivo");
      return;
    }
    setBusy(true);
    try {
      await criarImportBatch({
        nome,
        csv,
        origem: origem || null,
        contaId: contaId || null,
      });
      toast.success("Prévia gerada", "Revise abaixo antes de confirmar");
      setCsv("");
      setFilename(null);
      setNome("");
      setOrigem("");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Central de Importação
        </h1>
        <p className="text-sm text-muted-foreground">
          Arraste seu extrato bancário (CSV ou PDF). O sistema detecta tudo, categoriza
          e evita duplicatas.
        </p>
      </div>

      {/* Zona principal de drag & drop */}
      <Card
        className={`relative overflow-hidden transition-colors ${
          dragOver ? "border-primary bg-primary/5" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <CardContent className="p-0">
          <label
            htmlFor="file-import"
            className="flex cursor-pointer flex-col items-center justify-center gap-3 p-10 text-center"
          >
            <input
              id="file-import"
              ref={fileRef}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Upload className="h-8 w-8" />
            </div>
            {filename ? (
              <div>
                <div className="text-base font-semibold">{filename}</div>
                <div className="text-xs text-muted-foreground">
                  {csv.length.toLocaleString("pt-BR")} caracteres • pronto pra
                  importar
                </div>
              </div>
            ) : (
              <div>
                <div className="text-base font-semibold">
                  Arraste seu extrato aqui
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  ou clique para escolher um arquivo (CSV ou PDF)
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Funciona com Nubank, Itaú, Bradesco, Santander, Caixa, BB,
                  Inter, C6, Sicoob, Mercado Pago, PagSeguro e outros
                </div>
              </div>
            )}
            {filename && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setCsv("");
                  setFilename(null);
                  setNome("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                escolher outro
              </button>
            )}
          </label>
        </CardContent>
      </Card>

      {/* Banco detectado automaticamente */}
      {filename && deteccao && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="rounded-md bg-info/15 p-2 text-info">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 text-sm">
              <div className="font-medium">
                Banco detectado: <b className="text-info">{deteccao.banco}</b>
                {" "}
                <Badge variant="info" className="text-[10px]">
                  {Math.round(deteccao.confianca * 100)}% certeza
                </Badge>
              </div>
              {deteccao.contaSugeridaNome ? (
                <div className="text-xs text-muted-foreground">
                  Vinculando a esta importação na conta{" "}
                  <b className="text-foreground">
                    {deteccao.contaSugeridaNome}
                  </b>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Não encontrei conta vinculada a esse banco — selecione em
                  &quot;opções avançadas&quot; se quiser.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Após selecionar arquivo: 2 caminhos */}
      {filename && (
        <Card>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={importarTudoDeUmaVez}
              disabled={busy}
              className="group flex flex-col items-start gap-2 rounded-lg border-2 border-primary bg-primary/5 p-5 text-left transition hover:bg-primary/10 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-primary p-1.5 text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="font-semibold">Importar tudo</span>
                <Badge variant="success" className="text-[10px]">
                  recomendado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Lança tudo de uma vez. Pula duplicatas e categoriza
                automaticamente. <b>Mais rápido.</b>
              </p>
            </button>

            <button
              type="button"
              onClick={gerarPrevia}
              disabled={busy}
              className="flex flex-col items-start gap-2 rounded-lg border p-5 text-left transition hover:bg-accent disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1.5">
                  <Eye className="h-4 w-4" />
                </div>
                <span className="font-semibold">Revisar antes</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Mostra uma prévia editável. Você confere cada linha e marca o
                que quer importar.
              </p>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Resumo da última importação direta */}
      {resumo && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Sparkles className="h-5 w-5 text-success" />
            <div className="flex-1 text-sm">
              <div className="font-medium">
                {resumo.importadas} lançamento(s) importado(s)
              </div>
              <div className="text-xs text-muted-foreground">
                {resumo.duplicadas > 0 && (
                  <>{resumo.duplicadas} duplicada(s) ignorada(s) • </>
                )}
                {resumo.total} linha(s) processada(s)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opções avançadas (colapsável) */}
      {filename && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {showAdvanced ? "Esconder" : "Mostrar"} opções avançadas
          </button>
          {showAdvanced && (
            <Card className="mt-2">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs">Nome da importação</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Banco/origem (opcional)</Label>
                  <Input
                    value={origem}
                    onChange={(e) => setOrigem(e.target.value)}
                    placeholder="Ex: Nubank"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Conta destino</Label>
                  <Select
                    value={contaId}
                    onChange={(e) => setContaId(e.target.value)}
                  >
                    <option value="">— Sem conta vinculada —</option>
                    {contas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.banco ? ` (${c.banco})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Histórico de importações em rascunho */}
      {batches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico
          </h2>
          {batches.map((b) => (
            <BatchCard
              key={b.id}
              batch={b}
              categorias={categorias}
              onChange={() => router.refresh()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchCard({
  batch,
  categorias,
  onChange,
}: {
  batch: BatchFull;
  categorias: Categoria[];
  onChange: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isRascunho = batch.status === "rascunho";

  async function confirmar() {
    if (
      !confirm(
        `Importar ${batch.transactions.filter((t) => t.selecionado && t.status !== "duplicada").length} lançamentos?`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await confirmarImportBatch(batch.id);
      toast.success(`${r.importadas} lançamentos importados`);
      onChange();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function cancelar() {
    if (
      !confirm("Apagar esta importação? Os lançamentos ainda não foram efetivados.")
    )
      return;
    setBusy(true);
    try {
      await cancelarImportBatch(batch.id);
      toast.success("Cancelada");
      onChange();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTx(id: string, value: boolean) {
    try {
      await atualizarTransacaoImportada({ id, selecionado: value });
      onChange();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function setCategoriaTx(id: string, categoriaId: string | null) {
    try {
      await atualizarTransacaoImportada({ id, categoriaId });
      onChange();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  const selecionadas = batch.transactions.filter(
    (t) => t.selecionado && t.status !== "duplicada",
  ).length;
  const dup = batch.transactions.filter((t) => t.status === "duplicada").length;
  const totalValor = batch.transactions
    .filter((t) => t.selecionado && t.status !== "duplicada")
    .reduce((acc, t) => acc + (t.tipo === "receita" ? t.valor : -t.valor), 0);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">{batch.nome}</CardTitle>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>{batch.totalLinhas} linhas</span>
            <span>•</span>
            <span>{selecionadas} a importar</span>
            {dup > 0 && (
              <>
                <span>•</span>
                <span className="text-warning">{dup} duplicada(s)</span>
              </>
            )}
            {batch.conta && (
              <>
                <span>•</span>
                <span>Conta: {batch.conta.nome}</span>
              </>
            )}
            <span>•</span>
            <Badge variant={batch.status === "confirmado" ? "success" : "info"}>
              {batch.status === "confirmado" ? "Confirmada" : "Rascunho"}
            </Badge>
          </div>
        </div>
        {isRascunho && (
          <div className="flex gap-2">
            <Button onClick={confirmar} disabled={busy || selecionadas === 0}>
              <CheckCircle2 className="h-4 w-4" /> Confirmar
            </Button>
            <Button variant="ghost" onClick={cancelar} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {selecionadas > 0 && isRascunho && (
          <div className="border-y bg-muted/30 p-3 text-sm">
            <b>Total selecionado:</b>{" "}
            <span className={totalValor < 0 ? "text-destructive" : "text-success"}>
              {formatBRL(Math.abs(totalValor))} ({totalValor < 0 ? "saída" : "entrada"})
            </span>
          </div>
        )}
        <ul className="divide-y">
          {batch.transactions.map((t) => (
            <TxRow
              key={t.id}
              tx={t}
              categorias={categorias}
              editable={isRascunho}
              onToggle={(v) => toggleTx(t.id, v)}
              onCategoria={(id) => setCategoriaTx(t.id, id)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TxRow({
  tx,
  categorias,
  editable,
  onToggle,
  onCategoria,
}: {
  tx: ImportedTransaction & { categoria: Categoria | null };
  categorias: Categoria[];
  editable: boolean;
  onToggle: (v: boolean) => void;
  onCategoria: (id: string | null) => void;
}) {
  const isDup = tx.status === "duplicada";
  const isImported = tx.status === "importado";
  const categoriasDoTipo = categorias.filter((c) => c.tipo === tx.tipo);

  return (
    <li
      className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 ${
        isDup ? "bg-warning/5" : ""
      } ${tx.selecionado ? "" : "opacity-60"}`}
    >
      {editable && !isDup && (
        <input
          type="checkbox"
          checked={tx.selecionado}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-4 w-4 cursor-pointer accent-primary"
          aria-label="Selecionar"
        />
      )}
      {isDup && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
      {isImported && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{tx.descricao}</span>
          {isDup && (
            <Badge variant="warning" className="text-[10px]">
              Possível duplicada
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateBR(tx.data)}
        </div>
      </div>

      <Select
        value={tx.categoriaId ?? ""}
        onChange={(e) => onCategoria(e.target.value || null)}
        disabled={!editable}
        className="h-9 w-44 text-xs"
      >
        <option value="">— Sem categoria —</option>
        {categoriasDoTipo.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </Select>

      <div
        className={`min-w-24 text-right text-base font-bold ${
          tx.tipo === "receita" ? "text-success" : "text-destructive"
        }`}
      >
        {tx.tipo === "receita" ? "+" : "−"} {formatBRL(tx.valor)}
      </div>
    </li>
  );
}
