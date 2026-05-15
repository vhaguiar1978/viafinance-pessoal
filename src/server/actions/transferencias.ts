"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  origemContaId: z.string().min(1, "Conta de origem é obrigatória"),
  destinoContaId: z.string().min(1, "Conta de destino é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data: z.string(),
  descricao: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export type TransferenciaInput = z.infer<typeof schema>;

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export async function criarTransferencia(input: TransferenciaInput) {
  const user = await requireUser();
  const data = schema.parse(input);

  if (data.origemContaId === data.destinoContaId) {
    throw new Error("A conta de origem e destino devem ser diferentes");
  }

  // Garante que ambas as contas são do usuário
  const contas = await prisma.conta.findMany({
    where: {
      userId: user.id,
      id: { in: [data.origemContaId, data.destinoContaId] },
    },
    select: { id: true },
  });
  if (contas.length !== 2) throw new Error("Conta inválida");

  await prisma.transferencia.create({
    data: {
      userId: user.id,
      origemContaId: data.origemContaId,
      destinoContaId: data.destinoContaId,
      valor: data.valor,
      data: toDate(data.data),
      descricao: data.descricao || null,
      observacoes: data.observacoes || null,
    },
  });

  revalidatePath("/transferencias");
  revalidatePath("/demonstrativo");
  revalidatePath("/contas");
  revalidatePath("/dashboard");
}

export async function excluirTransferencia(id: string) {
  const user = await requireUser();
  const own = await prisma.transferencia.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Transferência não encontrada");
  await prisma.transferencia.delete({ where: { id } });
  revalidatePath("/transferencias");
  revalidatePath("/demonstrativo");
  revalidatePath("/contas");
}
