import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContasClient } from "./contas-client";

export default async function ContasPage() {
  const user = await requireUser();
  const contas = await prisma.conta.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  return <ContasClient contas={contas} />;
}
