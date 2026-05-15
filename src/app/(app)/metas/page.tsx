import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { MetasClient } from "./metas-client";

export default async function MetasPage() {
  const user = await requireUser();
  const metas = await prisma.financialGoal.findMany({
    where: { userId: user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return <MetasClient metas={metas} />;
}
