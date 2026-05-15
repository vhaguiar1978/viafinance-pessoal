"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BankConnection, ConsentRecord, SyncLog } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Building2,
  Shield,
  Plus,
  Trash2,
  RefreshCcw,
  CircleSlash,
  ExternalLink,
  Info,
} from "lucide-react";
import { formatDateBR } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import {
  conectarBanco,
  desconectarBanco,
  excluirConexao,
  sincronizarAgora,
} from "@/server/actions/open-finance";

type Conexao = BankConnection & {
  consentRecord: ConsentRecord | null;
  _count: {
    bankAccounts: number;
    cardAccounts: number;
    investmentPositions: number;
    syncLogs: number;
  };
};

interface Props {
  conexoes: Conexao[];
  logs: SyncLog[];
}

const STATUS_INFO: Record<
  string,
  { label: string; variant: "success" | "warning" | "muted" | "destructive" }
> = {
  conectado: { label: "Conectado", variant: "success" },
  desconectado: { label: "Desconectado", variant: "muted" },
  expirado: { label: "Consentimento expirado", variant: "warning" },
  erro: { label: "Erro", variant: "destructive" },
};

const FREQ_LABEL: Record<string, string> = {
  manual: "Manual",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

export function BancosClient({ conexoes, logs }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [openConn, setOpenConn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bancoNome, setBancoNome] = useState("");
  const [freq, setFreq] = useState<"manual" | "diaria" | "semanal" | "mensal">("manual");

  async function handleConectar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const url = await conectarBanco({ bancoNome, frequenciaSync: freq });
      if (url) window.open(url, "_blank");
      toast.success("Fluxo iniciado", "Conclua o consentimento no banco");
      setOpenConn(false);
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleSync(id: string) {
    setBusy(true);
    try {
      await sincronizarAgora(id);
      toast.success("Sincronização realizada");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisc(id: string) {
    if (!confirm("Desconectar este banco? Os dados existentes ficam preservados.")) return;
    try {
      await desconectarBanco(id);
      toast.success("Desconectado");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("APAGAR esta conexão? Todos os dados associados serão removidos.")) return;
    try {
      await excluirConexao(id);
      toast.success("Conexão excluída");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bancos Conectados
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte bancos via Open Finance para sincronizar contas, cartões e
            investimentos
          </p>
        </div>
        <Button onClick={() => setOpenConn(true)}>
          <Plus className="h-4 w-4" /> Conectar banco
        </Button>
      </div>

      <Card className="border-info/40 bg-info/5">
        <CardContent className="flex flex-col gap-2 p-4 text-sm sm:flex-row">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-info" />
          <div className="space-y-1">
            <div className="font-medium">Sua segurança em primeiro lugar</div>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              <li>
                Nunca pedimos senha do banco, código SMS ou qualquer credencial
                sensível.
              </li>
              <li>
                Toda conexão acontece por <b>consentimento Open Finance</b>{" "}
                autorizado no ambiente do seu banco.
              </li>
              <li>
                Você pode desconectar ou revogar o consentimento a qualquer
                momento.
              </li>
              <li>
                Enquanto não houver um provider Open Finance ativo, use a{" "}
                <b>Central de Importação</b> (CSV) para trazer extratos.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {conexoes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="font-semibold">Nenhum banco conectado</div>
            <div className="text-sm text-muted-foreground">
              A integração com Open Finance estará disponível em breve. A
              estrutura já está pronta — falta apenas plugar um provider.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {conexoes.map((c) => {
            const s = STATUS_INFO[c.status] ?? STATUS_INFO.desconectado;
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-md bg-muted p-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{c.bancoNome}</span>
                        <Badge variant={s.variant}>{s.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          via {c.provider}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Sync: {FREQ_LABEL[c.frequenciaSync]}</span>
                        {c.ultimaSincronizacao && (
                          <span>
                            • Última: {formatDateBR(c.ultimaSincronizacao)}
                          </span>
                        )}
                        <span>• {c._count.bankAccounts} conta(s)</span>
                        <span>• {c._count.cardAccounts} cartão(ões)</span>
                        <span>• {c._count.investmentPositions} invest.</span>
                      </div>
                      {c.consentRecord?.dataExpiracao && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Consentimento expira em{" "}
                          {formatDateBR(c.consentRecord.dataExpiracao)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(c.id)}
                      disabled={busy}
                    >
                      <RefreshCcw className="h-3.5 w-3.5" /> Sincronizar
                    </Button>
                    {c.status === "conectado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDisc(c.id)}
                      >
                        <CircleSlash className="h-3.5 w-3.5" /> Desconectar
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de sincronização</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{l.tipo}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateBR(l.iniciadoEm)}
                      {l.mensagem && ` • ${l.mensagem}`}
                    </div>
                  </div>
                  <Badge
                    variant={
                      l.status === "sucesso"
                        ? "success"
                        : l.status === "parcial"
                          ? "warning"
                          : "destructive"
                    }
                  >
                    {l.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={openConn} onOpenChange={setOpenConn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar banco</DialogTitle>
            <DialogDescription>
              Você será redirecionado ao ambiente seguro do banco para autorizar
              o compartilhamento via Open Finance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConectar} className="space-y-4">
            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={bancoNome}
                onChange={(e) => setBancoNome(e.target.value)}
                placeholder="Ex: Nubank, Itaú, Bradesco"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Frequência de sincronização</Label>
              <Select
                value={freq}
                onChange={(e) => setFreq(e.target.value as typeof freq)}
              >
                <option value="manual">Manual</option>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs text-warning">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Nenhum provider Open Finance está ativo no momento. A estrutura
                está pronta — quando um provider for ligado (Pluggy, Belvo etc.),
                este botão te levará ao fluxo de consentimento.
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenConn(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                <ExternalLink className="h-4 w-4" />
                {busy ? "Conectando..." : "Iniciar conexão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
