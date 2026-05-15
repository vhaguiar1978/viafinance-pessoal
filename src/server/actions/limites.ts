"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const monthlySchema = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int(),
  valor: z.number().min(0),
  incluiInvestimentos: z.boolean().default(false),
  incluiCartao: z.boolean().default(true),
  observacao: z.string().nullable().optional(),
});

const categorySchema = z.object({
  categoriaId: z.string().min(1),
  mes: z.number().int().min(1).max(12),
  ano: z.number().int(),
  valor: z.number().min(0),
});

export type MonthlyLimitInput = z.infer<typeof monthlySchema>;
export type CategoryLimitInput = z.infer<typeof categorySchema>;

export async function definirLimiteMensal(input: MonthlyLimitInput) {
  const user = await requireUser();
  const data = monthlySchema.parse(input);

  const result = await prisma.monthlyLimit.upsert({
    where: {
      userId_mes_ano: { userId: user.id, mes: data.mes, ano: data.ano },
    },
    update: {
      valor: data.valor,
      incluiInvestimentos: data.incluiInvestimentos,
      incluiCartao: data.incluiCartao,
      observacao: data.observacao || null,
    },
    create: {
      userId: user.id,
      mes: data.mes,
      ano: data.ano,
      valor: data.valor,
      incluiInvestimentos: data.incluiInvestimentos,
      incluiCartao: data.incluiCartao,
      observacao: data.observacao || null,
    },
  });
  revalidatePath("/limites");
  revalidatePath("/demonstrativo");
  revalidatePath("/dashboard");
  return result;
}

export async function excluirLimiteMensal(id: string) {
  const user = await requireUser();
  const own = await prisma.monthlyLimit.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Limite não encontrado");
  await prisma.monthlyLimit.delete({ where: { id } });
  revalidatePath("/limites");
  revalidatePath("/demonstrativo");
}

export async function definirLimiteCategoria(input: CategoryLimitInput) {
  const user = await requireUser();
  const data = categorySchema.parse(input);

  // Garante que a categoria é do usuário
  const cat = await prisma.categoria.findFirst({
    where: { id: data.categoriaId, userId: user.id },
    select: { id: true },
  });
  if (!cat) throw new Error("Categoria não encontrada");

  return prisma.categoryLimit.upsert({
    where: {
      userId_categoriaId_mes_ano: {
        userId: user.id,
        categoriaId: data.categoriaId,
        mes: data.mes,
        ano: data.ano,
      },
    },
    update: { valor: data.valor },
    create: {
      userId: user.id,
      categoriaId: data.categoriaId,
      mes: data.mes,
      ano: data.ano,
      valor: data.valor,
    },
  });
}

export async function excluirLimiteCategoria(id: string) {
  const user = await requireUser();
  const own = await prisma.categoryLimit.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Limite não encontrado");
  await prisma.categoryLimit.delete({ where: { id } });
  revalidatePath("/limites");
  revalidatePath("/demonstrativo");
}
