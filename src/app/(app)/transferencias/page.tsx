import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { TransferenciasClient } from "./transferencias-client";

export default async function TransferenciasPage() {
  const user = await requireUser();
  const [transferencias, contas] = await Promise.all([
    prisma.transferencia.findMany({
      where: { userId: user.id },
      include: { origemConta: true, destinoConta: true },
      orderBy: { data: "desc" },
      take: 200,
    }),
    prisma.conta.findMany({
      where: { userId: user.id, ativa: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return <TransferenciasClient transferencias={transferencias} contas={contas} />;
}
