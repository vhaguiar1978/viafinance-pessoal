import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { BancosClient } from "./bancos-client";

export default async function BancosConectadosPage() {
  const user = await requireUser();
  const conexoes = await prisma.bankConnection.findMany({
    where: { userId: user.id },
    include: {
      consentRecord: true,
      _count: {
        select: {
          bankAccounts: true,
          cardAccounts: true,
          investmentPositions: true,
          syncLogs: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const logs = await prisma.syncLog.findMany({
    where: { userId: user.id },
    orderBy: { iniciadoEm: "desc" },
    take: 10,
  });
  return <BancosClient conexoes={conexoes} logs={logs} />;
}
