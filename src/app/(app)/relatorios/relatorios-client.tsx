"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Printer, Search, Filter, X } from "lucide-react";
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

/**
 * Tipos de relatório que aceitam os filtros avançados (data inicial/final,
 * categoria, busca). Os outros são por estrutura mes/ano e ignoram esses
 * filtros — não mostramos a UI deles pra evitar confusão.
 */
const TIPOS_COM_FILTROS_AVANCADOS = new Set<TipoRelatorio>([
  "categorias",
  "variaveis",
]);

interface CategoriaOpt {
  id: string;
  nome: string;
  tipo: string;
}

interface Props {
  tipo: TipoRelatorio;
  mes: number;
  ano: number;
  inicio?: string;
  fim?: string;
  categoriaIds: string[];
  busca: string;
  categorias: CategoriaOpt[];
  relatorio: Relatorio;
}

export function RelatoriosClient({
  tipo,
  mes,
  ano,
  inicio,
  fim,
  categoriaIds,
  busca,
  categorias,
  relatorio,
}: Props) {
  const router = useRouter();
  const aceitaFiltros = TIPOS_COM_FILTROS_AVANCADOS.has(tipo);

  const [periodoCustom, setPeriodoCustom] = useState<boolean>(
    !!(inicio || fim),
  );
  const [draftInicio, setDraftInicio] = useState<string>(inicio ?? "");
  const [draftFim, setDraftFim] = useState<string>(fim ?? "");
  const [draftBusca, setDraftBusca] = useState<string>(busca);
  const [draftCats, setDraftCats] = useState<string[]>(categoriaIds);

  function buildUrl(overrides: Record<string, string | string[] | undefined>) {
    const params = new URLSearchParams();
    const final = {
      tipo,
      mes: String(mes),
      ano: String(ano),
      inicio: periodoCustom ? draftInicio || undefined : undefined,
      fim: periodoCustom ? draftFim || undefined : undefined,
      busca: draftBusca || undefined,
      categoriaId: draftCats,
      ...overrides,
    };
    for (const [k, v] of Object.entries(final)) {
      if (v === undefined || v === "") continue;
      if (Array.isArray(v)) {
        for (const x of v) if (x) params.append(k, x);
      } else {
        params.set(k, v);
      }
    }
    return `/relatorios?${params.toString()}`;
  }

  function navegar(overrides: Record<string, string | string[] | undefined> = {}) {
    router.push(buildUrl(overrides));
  }

  function aplicarFiltros() {
    navegar();
  }

  function limparFiltros() {
    setPeriodoCustom(false);
    setDraftInicio("");
    setDraftFim("");
    setDraftBusca("");
    setDraftCats([]);
    router.push(`/relatorios?tipo=${tipo}&mes=${mes}&ano=${ano}`);
  }

  function trocarTipo(novoTipo: TipoRelatorio) {
    navegar({ tipo: novoTipo });
  }

  function baixarCSV() {
    // monta URL no mesmo formato do CSV (que aceita os mesmos params)
    const params = new URLSearchParams();
    params.set("tipo", tipo);
    params.set("mes", String(mes));
    params.set("ano", String(ano));
    params.set("formato", "csv");
    if (periodoCustom && draftInicio) params.set("inicio", draftInicio);
    if (periodoCustom && draftFim) params.set("fim", draftFim);
    if (draftBusca) params.set("busca", draftBusca);
    for (const c of draftCats) params.append("categoriaId", c);
    window.location.href = `/api/relatorios?${params.toString()}`;
  }

  function imprimir() {
    window.print();
  }

  function formatValor(v: unknown) {
    if (typeof v === "number") return formatBRL(v);
    return String(v ?? "");
  }

  const colunasNumericas = relatorio.colunas.filter((c) =>
    relatorio.linhas.some((l) => typeof l[c] === "number"),
  );

  const categoriasFiltradas = useMemo(() => {
    // Pro relatório "categorias"/"variaveis" só mostra categorias de DESPESA
    if (tipo === "categorias" || tipo === "variaveis") {
      return categorias.filter((c) => c.tipo === "despesa");
    }
    return categorias;
  }, [categorias, tipo]);

  function toggleCat(id: string) {
    setDraftCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const temFiltrosAtivos =
    periodoCustom || !!busca || categoriaIds.length > 0;

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
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Relatório
              </label>
              <Select
                value={tipo}
                onChange={(e) => trocarTipo(e.target.value as TipoRelatorio)}
                className="w-60"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>

            {!periodoCustom && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mês
                  </label>
                  <Select
                    value={mes}
                    onChange={(e) =>
                      navegar({ mes: e.target.value })
                    }
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
                    onChange={(e) =>
                      navegar({ ano: e.target.value })
                    }
                    className="w-24"
                  >
                    {ANOS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {aceitaFiltros && (
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Período
                </label>
                <Select
                  value={periodoCustom ? "custom" : "mes"}
                  onChange={(e) => setPeriodoCustom(e.target.value === "custom")}
                  className="w-44"
                >
                  <option value="mes">Mês inteiro</option>
                  <option value="custom">Período personalizado</option>
                </Select>
              </div>
            )}

            {aceitaFiltros && periodoCustom && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Data inicial
                  </label>
                  <Input
                    type="date"
                    value={draftInicio}
                    onChange={(e) => setDraftInicio(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Data final
                  </label>
                  <Input
                    type="date"
                    value={draftFim}
                    onChange={(e) => setDraftFim(e.target.value)}
                    className="w-40"
                  />
                </div>
              </>
            )}
          </div>

          {aceitaFiltros && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 space-y-1 min-w-[200px]">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Buscar na descrição
                  </label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder='ex: "Oig Gaming", "iFood", "Posto"'
                      value={draftBusca}
                      onChange={(e) => setDraftBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") aplicarFiltros();
                      }}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Button onClick={aplicarFiltros}>
                  <Filter className="h-4 w-4" /> Aplicar
                </Button>
                {temFiltrosAtivos && (
                  <Button variant="outline" onClick={limparFiltros}>
                    <X className="h-4 w-4" /> Limpar
                  </Button>
                )}
              </div>

              {categoriasFiltradas.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Filtrar por categoria{" "}
                    {draftCats.length > 0 && (
                      <span className="text-primary">
                        ({draftCats.length} selecionada{draftCats.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {categoriasFiltradas.map((c) => {
                      const active = draftCats.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCat(c.id)}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          {c.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {relatorio.totalGeral !== undefined && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total no período selecionado
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-primary">
                {formatBRL(relatorio.totalGeral)}
              </div>
              {relatorio.subtitulo && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {relatorio.subtitulo}
                </div>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>
                <b className="font-semibold tabular-nums text-foreground">
                  {relatorio.linhas.length}
                </b>{" "}
                {tipo === "categorias" ? "categoria(s)" : "lançamento(s)"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                          {formatValor(l[c])}
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
