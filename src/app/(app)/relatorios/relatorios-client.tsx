"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Printer } from "lucide-react";
import { formatBRL, nomeMes } from "@/lib/utils";
import type { Relatorio, TipoRelatorio } from "@/server/relatorios";

const ANOS = Array.from({ length: 10 }, (_, i) => 2023 + i);

const TIPOS: { value: TipoRelatorio; label: string }[] = [
  { value: "demonstrativo", label: "Demonstrativo mensal" },
  { value: "categorias", label: "Gastos por categoria" },
  { value: "entradas-saidas", label: "Entradas × Saídas" },
  { value: "fixas", label: "Despesas fixas" },
  { value: "variaveis", label: "Despesas variáveis" },
  { value: "cartao", label: "Cartão de crédito" },
  { value: "parcelas", label: "Parcelas futuras" },
  { value: "assinaturas", label: "Assinaturas" },
  { value: "investimentos", label: "Investimentos" },
  { value: "metas", label: "Metas" },
];

interface Props {
  tipo: TipoRelatorio;
  mes: number;
  ano: number;
  relatorio: Relatorio;
}

export function RelatoriosClient({ tipo, mes, ano, relatorio }: Props) {
  const router = useRouter();

  function trocar(novoTipo?: TipoRelatorio, novoMes?: number, novoAno?: number) {
    const t = novoTipo ?? tipo;
    const m = novoMes ?? mes;
    const a = novoAno ?? ano;
    router.push(`/relatorios?tipo=${t}&mes=${m}&ano=${a}`);
  }

  function baixarCSV() {
    window.location.href = `/api/relatorios?tipo=${tipo}&mes=${mes}&ano=${ano}&formato=csv`;
  }

  function imprimir() {
    window.print();
  }

  function formatValor(v: unknown, col: string) {
    if (typeof v === "number") return formatBRL(v);
    return String(v ?? "");
  }

  const colunasNumericas = relatorio.colunas.filter((c) =>
    relatorio.linhas.some((l) => typeof l[c] === "number"),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Gere e exporte relatórios financeiros
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
          <Button onClick={baixarCSV}>
            <Download className="h-4 w-4" /> Baixar CSV
          </Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Relatório
            </label>
            <Select
              value={tipo}
              onChange={(e) => trocar(e.target.value as TipoRelatorio)}
              className="w-60"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mês
            </label>
            <Select
              value={mes}
              onChange={(e) => trocar(undefined, Number(e.target.value))}
              className="w-36"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {nomeMes(m)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Ano
            </label>
            <Select
              value={ano}
              onChange={(e) => trocar(undefined, undefined, Number(e.target.value))}
              className="w-24"
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

      <Card>
        <CardHeader className="print:pb-2">
          <CardTitle>{relatorio.titulo}</CardTitle>
          <div className="text-xs text-muted-foreground">
            Gerado em {new Date().toLocaleString("pt-BR")}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {relatorio.linhas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sem dados neste período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    {relatorio.colunas.map((c) => (
                      <th
                        key={c}
                        className={`px-4 py-2 ${
                          colunasNumericas.includes(c) ? "text-right" : "text-left"
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorio.linhas.map((l, i) => (
                    <tr key={i} className="border-t">
                      {relatorio.colunas.map((c) => (
                        <td
                          key={c}
                          className={`px-4 py-2 ${
                            colunasNumericas.includes(c) ? "text-right font-mono" : ""
                          }`}
                        >
                          {formatValor(l[c], c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {relatorio.totais && (
                    <tr className="border-t bg-muted/40 font-semibold">
                      {relatorio.colunas.map((c, idx) => (
                        <td
                          key={c}
                          className={`px-4 py-2 ${
                            colunasNumericas.includes(c) ? "text-right font-mono" : ""
                          }`}
                        >
                          {idx === 0
                            ? "TOTAL"
                            : relatorio.totais![c] !== undefined
                              ? formatBRL(relatorio.totais![c])
                              : ""}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground print:hidden">
        Para gerar PDF, use <b>Imprimir / PDF</b> e escolha &quot;Salvar como
        PDF&quot; no diálogo de impressão do navegador.
      </div>
    </div>
  );
}
