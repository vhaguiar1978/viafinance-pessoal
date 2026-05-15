"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { safeDate } from "@/lib/utils";

/**
 * Garante que a fatura para (cartao, mes, ano) existe. Não é necessário chamar
 * "use server" externamente para esta função (também é usada internamente).
 */
export async function ensureInvoice(
  userId: string,
  cartaoId: string,
  mes: number,
  ano: number,
) {
  const cartao = await prisma.cartao.findFirst({
    where: { id: cartaoId, userId },
  });
  if (!cartao) throw new Error("Cartão não encontrado");

  const existing = await prisma.cardInvoice.findUnique({
    where: { cartaoId_mes_ano: { cartaoId, mes, ano } },
  });
  if (existing) return existing;

  // dataFechamento = dia de fechamento do mês ANTERIOR ao mês da fatura
  // (fatura de junho fecha em maio, por convenção do cartão)
  // Mais simples: fechamento no mes-1, vencimento no mes
  let fechMes = mes - 1;
  let fechAno = ano;
  if (fechMes === 0) {
    fechMes = 12;
    fechAno -= 1;
  }
  const dataFechamento = safeDate(fechAno, fechMes, cartao.diaFechamento);
  const dataVencimento = safeDate(ano, mes, cartao.diaVencimento);

  return prisma.cardInvoice.create({
    data: {
      userId,
      cartaoId,
      mes,
      ano,
      dataFechamento,
      dataVencimento,
      total: 0,
      totalPago: 0,
      status: "aberta",
    },
  });
}

/**
 * Recalcula total/totalPago/status de uma fatura.
 */
export async function recomputarTotalFatura(invoiceId: string) {
  const installments = await prisma.cardInstallment.findMany({
    where: { invoiceId },
  });
  const total = installments
    .filter((i) => i.status !== "cancelada")
    .reduce((acc, i) => acc + i.valor, 0);
  const pago = installments
    .filter((i) => i.status === "paga")
    .reduce((acc, i) => acc + i.valor, 0);

  let status = "aberta";
  if (total > 0 && pago >= total) status = "paga";
  else if (pago > 0) status = "fechada";

  await prisma.cardInvoice.update({
    where: { id: invoiceId },
    data: { total, totalPago: pago, status },
  });
}

export async function pagarFatura(invoiceId: string) {
  const user = await requireUser();
  const inv = await prisma.cardInvoice.findFirst({
    where: { id: invoiceId, userId: user.id },
  });
  if (!inv) throw new Error("Fatura não encontrada");

  await prisma.cardInstallment.updateMany({
    where: { invoiceId, status: { in: ["prevista", "atrasada"] } },
    data: { status: "paga", dataPagamento: new Date() },
  });
  await recomputarTotalFatura(invoiceId);

  revalidatePath(`/cartoes/${inv.cartaoId}`);
  revalidatePath("/demonstrativo");
}
