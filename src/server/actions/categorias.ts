"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  tipo: z.enum(["despesa", "receita"]),
  cor: z.string().optional().nullable(),
  icone: z.string().optional().nullable(),
});

export type CategoriaInput = z.infer<typeof schema>;

export async function criarCategoria(input: CategoriaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const c = await prisma.categoria.create({ data: { ...data, userId: user.id } });
  revalidatePath("/categorias");
  return c;
}

export async function atualizarCategoria(id: string, input: CategoriaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const own = await prisma.categoria.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Categoria não encontrada");
  const c = await prisma.categoria.update({ where: { id }, data });
  revalidatePath("/categorias");
  return c;
}

export async function excluirCategoria(id: string) {
  const user = await requireUser();
  const own = await prisma.categoria.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Categoria não encontrada");
  await prisma.categoria.delete({ where: { id } });
  revalidatePath("/categorias");
}
