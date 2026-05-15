import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ImportarClient } from "./importar-client";

export default async function ImportarPage() {
  const user = await requireUser();
  const [contas, categorias, batches] = await Promise.all([
    prisma.conta.findMany({
      where: { userId: user.id, ativa: true },
      orderBy: { nome: "asc" },
    }),
    prisma.categoria.findMany({
      where: { userId: user.id },
      orderBy: { nome: "asc" },
    }),
    prisma.importBatch.findMany({
      where: { userId: user.id },
      include: {
        conta: true,
        transactions: { include: { categoria: true }, orderBy: { data: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <ImportarClient contas={contas} categorias={categorias} batches={batches} />
  );
}
