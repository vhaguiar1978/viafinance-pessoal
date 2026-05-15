import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { InvestimentosClient } from "./investimentos-client";

export default async function InvestimentosPage() {
  const user = await requireUser();
  const [assets, movimentacoes, contas] = await Promise.all([
    prisma.investmentAsset.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { tipo: "asc" }, { nome: "asc" }],
    }),
    prisma.investimento.findMany({
      where: { userId: user.id },
      include: { conta: true, asset: true },
      orderBy: { data: "desc" },
      take: 100,
    }),
    prisma.conta.findMany({
      where: { userId: user.id, ativa: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <InvestimentosClient
      assets={assets}
      movimentacoes={movimentacoes}
      contas={contas}
    />
  );
}
