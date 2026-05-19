import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  gerarRelatorio,
  type FiltroAvancado,
  type TipoRelatorio,
} from "@/server/relatorios";
import { RelatoriosClient } from "./relatorios-client";

interface Props {
  searchParams: Promise<{
    tipo?: string;
    mes?: string;
    ano?: string;
    inicio?: string;
    fim?: string;
    categoriaId?: string | string[];
    busca?: string;
  }>;
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export default async function RelatoriosPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;
  const tipo = (sp.tipo as TipoRelatorio) ?? "demonstrativo";
  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();
  const inicio = parseDate(sp.inicio);
  const fimRaw = parseDate(sp.fim);
  const fim = fimRaw
    ? new Date(
        fimRaw.getFullYear(),
        fimRaw.getMonth(),
        fimRaw.getDate(),
        23,
        59,
        59,
        999,
      )
    : undefined;
  const categoriaIdsRaw = Array.isArray(sp.categoriaId)
    ? sp.categoriaId
    : sp.categoriaId
      ? [sp.categoriaId]
      : [];
  const categoriaIds = categoriaIdsRaw.length > 0 ? categoriaIdsRaw : undefined;
  const busca = sp.busca || undefined;

  const filtro: FiltroAvancado | undefined =
    inicio || fim || categoriaIds || busca
      ? { inicio, fim, categoriaIds, busca }
      : undefined;

  const [rel, categorias] = await Promise.all([
    gerarRelatorio(user.id, tipo, mes, ano, filtro),
    prisma.categoria.findMany({
      where: { userId: user.id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, tipo: true },
    }),
  ]);

  return (
    <RelatoriosClient
      tipo={tipo}
      mes={mes}
      ano={ano}
      inicio={sp.inicio}
      fim={sp.fim}
      categoriaIds={categoriaIdsRaw}
      busca={busca ?? ""}
      categorias={categorias}
      relatorio={rel}
    />
  );
}
