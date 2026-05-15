import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { DespesasFixasClient } from "./despesas-fixas-client";

export default async function DespesasFixasPage() {
  const user = await requireUser();
  const [despesas, categorias, contas, cartoes] = await Promise.all([
    prisma.despesaFixa.findMany({
      where: { userId: user.id },
      include: { categoria: true, conta: true, cartao: true },
      orderBy: [{ ativa: "desc" }, { descricao: "asc" }],
    }),
    prisma.categoria.findMany({
      where: { userId: user.id, tipo: "despesa" },
      orderBy: { nome: "asc" },
    }),
    prisma.conta.findMany({
      where: { userId: user.id, ativa: true },
      orderBy: { nome: "asc" },
    }),
    prisma.cartao.findMany({
      where: { userId: user.id, ativo: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <DespesasFixasClient
      despesas={despesas}
      categorias={categorias}
      contas={contas}
      cartoes={cartoes}
    />
  );
}
