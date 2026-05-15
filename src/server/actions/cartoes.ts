"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  banco: z.string().optional().nullable(),
  limite: z.number().min(0).default(0),
  diaFechamento: z.number().int().min(1).max(31),
  diaVencimento: z.number().int().min(1).max(31),
  cor: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

export type CartaoInput = z.infer<typeof schema>;

export async function criarCartao(input: CartaoInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const c = await prisma.cartao.create({ data: { ...data, userId: user.id } });
  revalidatePath("/cartoes");
  return c;
}

export async function atualizarCartao(id: string, input: CartaoInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const own = await prisma.cartao.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Cartão não encontrado");
  const c = await prisma.cartao.update({ where: { id }, data });
  revalidatePath("/cartoes");
  return c;
}

export async function excluirCartao(id: string) {
  const user = await requireUser();
  const own = await prisma.cartao.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Cartão não encontrado");
  await prisma.cartao.delete({ where: { id } });
  revalidatePath("/cartoes");
}
