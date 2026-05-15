"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Cartao,
  CardInstallment,
  CardInvoice,
  CardPurchase,
  Categoria,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Layers,
  CheckCircle2,
  Trash2,
  Repeat,
  Ban,
} from "lucide-react";
import { formatBRL, formatDateBR, nomeMes } from "@/lib/utils";
import { useToast } from "@/components/toast-provider";
import { pagarFatura } from "@/server/actions/card-invoices";
import {
  marcarParcelaPaga,
  cancelarCompraCartao,
  excluirCompraCartao,
} from "@/server/actions/card-purchases";
import { ExportButton } from "@/components/export-button";

type PurchaseFull = CardPurchase & {
  categoria: Categoria | null;
  installments: CardInstallment[];
};
type InstallmentFull = CardInstallment & {
  purchase: CardPurchase & { categoria: Categoria | null };
};

interface Props {
  cartao: Cartao;
  mes: number;
  ano: number;
  limiteUsado: number;
  installmentsMes: InstallmentFull[];
  invoice: CardInvoice | null;
  purchasesAtivas: PurchaseFull[];
}

const ANOS = Array.from({ length: 10 }, (_, i) => 2023 + i);

export function CartaoDetalheClient({
  cartao,
  mes,
  ano,
  limiteUsado,
  installmentsMes,
  invoice,
  purchasesAtivas,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

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
    router.push(`/cartoes/${cartao.id}?mes=${nm}&ano=${na}`);
  }
  function escolher(m: number, a: number) {
    router.push(`/cartoes/${cartao.id}?mes=${m}&ano=${a}`);
  }

  const disponivel = Math.max(0, cartao.limite - limiteUsado);
  const pctUsado = cartao.limite > 0 ? (limiteUsado / cartao.limite) * 100 : 0;

  const totalFatura = installmentsMes
    .filter((i) => i.status !== "cancelada")
    .reduce((acc, i) => acc + i.valor, 0);
  const totalPagoFatura = installmentsMes
    .filter((i) => i.status === "paga")
    .reduce((acc, i) => acc + i.valor, 0);

  // Total a parcelar no futuro (parcelas pendentes em meses > este mês)
  const totalFuturo = purchasesAtivas.reduce((acc, p) => {
    const futuras = p.installments.filter(
      (i) =>
        i.status !== "cancelada" &&
        i.status !== "paga" &&
        (i.ano > ano || (i.ano === ano && i.mes > mes)),
    );
    return acc + futuras.reduce((a, x) => a + x.valor, 0);
  }, 0);

  async function handlePagarFatura() {
    if (!invoice) return;
    if (!confirm("Marcar TODAS as parcelas desta fatura como pagas?")) return;
    setBusy(true);
    try {
      await pagarFatura(invoice.id);
      toast.success("Fatura paga");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function handlePagarParcela(id: string) {
    try {
      await marcarParcelaPaga(id);
      toast.success("Parcela paga");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }
  async function handleCancelar(id: string) {
    if (!confirm("Cancelar esta compra? Todas as parcelas futuras serão canceladas.")) return;
    try {
      await cancelarCompraCartao(id);
      toast.success("Compra cancelada");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }
  async function handleExcluir(id: string) {
    if (!confirm("EXCLUIR compra (incluindo todas as parcelas)? Esta ação não pode ser desfeita.")) return;
    try {
      await excluirCompraCartao(id);
      toast.success("Compra excluída");
      router.refresh();
    } catch (err) {
      toast.error("Erro", err instanceof Error ? err.message : "Falha");
    }
  }

  // Agrupar parcelas do mês por tipo
  const parcelas1de1 = installmentsMes.filter(
    (i) => i.purchase.totalParcelas === 1 && !i.purchase.ehAssinatura,
  );
  const parcelasParceladas = installmentsMes.filter(
    (i) => i.purchase.totalParcelas > 1,
  );
  const parcelasAssinaturas = installmentsMes.filter(
    (i) => i.purchase.ehAssinatura,
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Cabeçalho com cartão visual */}
      <Card className="overflow-hidden">
        <div
          className="flex flex-col gap-1 p-6 text-white"
          style={{
            background: `linear-gradient(135deg, ${cartao.cor ?? "#6366f1"}, ${cartao.cor ?? "#6366f1"}dd)`,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-6 w-6" />
              <span className="text-xs uppercase opacity-80">
                {cartao.banco ?? "Cartão"}
              </span>
            </div>
            <Link
              href="/cartoes"
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              ← Cartões
            </Link>
          </div>
          <div className="mt-1 text-2xl font-bold">{cartao.nome}</div>
          <div className="mt-1 text-xs opacity-80">
            Fechamento dia {cartao.diaFechamento} • Vencimento dia{" "}
            {cartao.diaVencimento}
          </div>
        </div>

        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <Kpi label="Limite total" value={formatBRL(cartao.limite)} />
          <Kpi label="Limite usado" value={formatBRL(limiteUsado)} tone="warning" />
          <Kpi label="Disponível" value={formatBRL(disponivel)} tone="success" />
          <div className="sm:col-span-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uso do limite</span>
              <span className="font-medium">
                {pctUsado.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  pctUsado > 90
                    ? "bg-destructive"
                    : pctUsado > 70
                      ? "bg-warning"
                      : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, pctUsado)}%` }}
              />
            </div>
            {totalFuturo > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                + {formatBRL(totalFuturo)} em parcelas futuras (não abatem o
                limite novamente)
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navegação de mês da fatura */}
      <Card className="bg-gradient-to-br from-primary/5 to-info/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => navegar(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-1">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Fatura
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

      {/* Resumo da fatura */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total da fatura" value={formatBRL(totalFatura)} highlight />
        <Kpi label="Pago" value={formatBRL(totalPagoFatura)} tone="success" />
        <Kpi
          label="A pagar"
          value={formatBRL(totalFatura - totalPagoFatura)}
          tone="warning"
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <ExportButton tipo="cartao" mes={mes} ano={ano} label="Exportar fatura" showPrint />
        {invoice && totalFatura > totalPagoFatura && (
          <Button onClick={handlePagarFatura} disabled={busy} variant="success">
            <CheckCircle2 className="h-4 w-4" /> Pagar fatura inteira
          </Button>
        )}
      </div>

      {/* Compras à vista */}
      <SecaoFatura
        titulo="Compras à vista"
        icone={CreditCard}
        installments={parcelas1de1}
        onPagar={handlePagarParcela}
      />
      {/* Parceladas */}
      <SecaoFatura
        titulo="Parcelas"
        icone={Layers}
        installments={parcelasParceladas}
        onPagar={handlePagarParcela}
        mostrarParcela
      />
      {/* Assinaturas */}
      <SecaoFatura
        titulo="Assinaturas"
        icone={Repeat}
        installments={parcelasAssinaturas}
        onPagar={handlePagarParcela}
      />

      {/* Compras ativas (todas) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compras ativas neste cartão</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {purchasesAtivas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma compra ativa
            </div>
          ) : (
            <ul className="divide-y">
              {purchasesAtivas.map((p) => {
                const pagasCount = p.installments.filter(
                  (i) => i.status === "paga",
                ).length;
                const totalCount = p.installments.filter(
                  (i) => i.status !== "cancelada",
                ).length;
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.descricao}</span>
                        {p.ehAssinatura && (
                          <Badge variant="info">Assinatura</Badge>
                        )}
                        {p.totalParcelas > 1 && !p.ehAssinatura && (
                          <Badge variant="secondary">
                            {pagasCount}/{totalCount} pagas
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Comprado em {formatDateBR(p.dataCompra)}
                        {p.categoria && <> • {p.categoria.nome}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          Total
                        </div>
                        <div className="font-bold">
                          {formatBRL(p.valorTotal)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleCancelar(p.id)}
                        title="Cancelar compra (cancela parcelas futuras)"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleExcluir(p.id)}
                        title="Excluir compra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
  highlight?: boolean;
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
    <div
      className={`rounded-lg border p-4 ${highlight ? "border-primary/50 bg-primary/5" : ""}`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function SecaoFatura({
  titulo,
  icone: Icon,
  installments,
  onPagar,
  mostrarParcela,
}: {
  titulo: string;
  icone: React.ElementType;
  installments: InstallmentFull[];
  onPagar: (id: string) => void;
  mostrarParcela?: boolean;
}) {
  if (installments.length === 0) return null;
  const total = installments.reduce(
    (acc, i) => (i.status !== "cancelada" ? acc + i.valor : acc),
    0,
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-muted p-1.5 text-info">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{titulo}</CardTitle>
          <Badge variant="muted">{installments.length}</Badge>
        </div>
        <div className="text-sm font-semibold">{formatBRL(total)}</div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {installments.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i.purchase.descricao}</span>
                  {mostrarParcela && (
                    <Badge variant="secondary" className="text-[10px]">
                      {i.numero}/{i.purchase.totalParcelas}
                    </Badge>
                  )}
                  <StatusBadge status={i.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Vence {formatDateBR(i.dataVencimento)}
                  {i.purchase.categoria && <> • {i.purchase.categoria.nome}</>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right text-base font-bold">
                  {formatBRL(i.valor)}
                </div>
                {i.status !== "paga" && i.status !== "cancelada" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onPagar(i.id)}
                    title="Marcar como paga"
                  >
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
