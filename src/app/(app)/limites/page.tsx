import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { totaisDoMes } from "@/server/competencia";
import { LimitesClient } from "./limites-client";

interface Props {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function LimitesPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;

  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();

  const [limiteMensal, categorias, limitesCategoria, totais] = await Promise.all([
    prisma.monthlyLimit.findUnique({
      where: { userId_mes_ano: { userId: user.id, mes, ano } },
    }),
    prisma.categoria.findMany({
      where: { userId: user.id, tipo: "despesa" },
      orderBy: { nome: "asc" },
    }),
    prisma.categoryLimit.findMany({
      where: { userId: user.id, mes, ano },
      include: { categoria: true },
    }),
    totaisDoMes(user.id, mes, ano),
  ]);

  return (
    <LimitesClient
      mes={mes}
      ano={ano}
      limiteMensal={limiteMensal}
      categorias={categorias}
      limitesCategoria={limitesCategoria}
      totais={totais}
    />
  );
}
