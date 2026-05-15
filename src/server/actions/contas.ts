"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  nome: z.string().min(1, "Informe um nome"),
  banco: z.string().optional().nullable(),
  tipo: z.enum([
    "corrente",
    "poupanca",
    "dinheiro",
    "carteira",
    "corretora",
    "outra",
  ]),
  saldoInicial: z.number().default(0),
  cor: z.string().optional().nullable(),
  ativa: z.boolean().default(true),
});

export type ContaInput = z.infer<typeof schema>;

export async function criarConta(input: ContaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const c = await prisma.conta.create({ data: { ...data, userId: user.id } });
  revalidatePath("/contas");
  revalidatePath("/dashboard");
  return c;
}

export async function atualizarConta(id: string, input: ContaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const existing = await prisma.conta.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Conta não encontrada");
  const c = await prisma.conta.update({ where: { id }, data });
  revalidatePath("/contas");
  return c;
}

export async function excluirConta(id: string) {
  const user = await requireUser();
  const existing = await prisma.conta.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) throw new Error("Conta não encontrada");
  await prisma.conta.delete({ where: { id } });
  revalidatePath("/contas");
}
