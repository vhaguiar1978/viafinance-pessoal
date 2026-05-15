import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { LancamentosClient } from "./lancamentos-client";

export default async function LancamentosPage() {
  const user = await requireUser();
  const [lancamentos, categorias, contas, cartoes] = await Promise.all([
    prisma.lancamento.findMany({
      where: { userId: user.id },
      include: { categoria: true, conta: true, cartao: true },
      orderBy: { data: "desc" },
      take: 200,
    }),
    prisma.categoria.findMany({
      where: { userId: user.id },
      orderBy: [{ tipo: "asc" }, { nome: "asc" }],
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
    <LancamentosClient
      lancamentos={lancamentos}
      categorias={categorias}
      contas={contas}
      cartoes={cartoes}
    />
  );
}
