import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CartoesClient } from "./cartoes-client";
import { calcularLimiteUsado } from "@/server/actions/card-purchases";

export default async function CartoesPage() {
  const user = await requireUser();
  const cartoes = await prisma.cartao.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const comUso = await Promise.all(
    cartoes.map(async (c) => ({
      ...c,
      limiteUsado: await calcularLimiteUsado(c.id),
    })),
  );
  return <CartoesClient cartoes={comUso} />;
}
