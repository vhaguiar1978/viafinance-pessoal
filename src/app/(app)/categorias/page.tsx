import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { CategoriasClient } from "./categorias-client";

export default async function CategoriasPage() {
  const user = await requireUser();
  const categorias = await prisma.categoria.findMany({
    where: { userId: user.id },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });
  return <CategoriasClient categorias={categorias} />;
}
