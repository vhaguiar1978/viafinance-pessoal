"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { safeDate } from "@/lib/utils";
import { ensureInvoice, recomputarTotalFatura } from "./card-invoices";

const schema = z.object({
  cartaoId: z.string().min(1),
  descricao: z.string().min(1),
  valorTotal: z.number().min(0),
  totalParcelas: z.number().int().min(1).max(120),
  dataCompra: z.string(), // ISO YYYY-MM-DD
  categoriaId: z.string().nullable().optional(),
  ehAssinatura: z.boolean().default(false),
  observacoes: z.string().nullable().optional(),
});

export type CardPurchaseInput = z.infer<typeof schema>;

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/**
 * Cria uma compra no cartão. Três modos:
 *  - À vista: totalParcelas = 1
 *  - Parcelada: totalParcelas > 1
 *  - Assinatura: ehAssinatura = true (totalParcelas pode ser 1; gera mensalmente sob demanda)
 *
 * Regra prioritária (item 8): o valor TOTAL é registrado em CardPurchase. As
 * parcelas filhas são CardInstallment e NÃO afetam novamente o limite — o
 * cálculo de limite usado considera apenas CardPurchase.valorTotal das compras
 * não-canceladas.
 */
export async function criarCompraCartao(input: CardPurchaseInput) {
  const user = await requireUser();
  const data = schema.parse(input);

  const cartao = await prisma.cartao.findFirst({
    where: { id: data.cartaoId, userId: user.id },
  });
  if (!cartao) throw new Error("Cartão não encontrado");

  const dataCompra = toDate(data.dataCompra);

  // A primeira parcela vai para a fatura cujo fechamento >= dataCompra.
  // Se dataCompra > fechamento daquele mês, vai para a fatura do mês seguinte.
  const fechamentoMesCompra = safeDate(
    dataCompra.getFullYear(),
    dataCompra.getMonth() + 1,
    cartao.diaFechamento,
  );
  let primeiraMes = dataCompra.getMonth() + 1;
  let primeiraAno = dataCompra.getFullYear();
  if (dataCompra > fechamentoMesCompra) {
    primeiraMes += 1;
    if (primeiraMes > 12) {
      primeiraMes = 1;
      primeiraAno += 1;
    }
  }

  const valorParcela =
    Math.round((data.valorTotal / data.totalParcelas) * 100) / 100;

  // Ajuste de centavos: a última parcela absorve o resto
  const somaArredondada = valorParcela * data.totalParcelas;
  const ajusteUltima =
    Math.round((data.valorTotal - somaArredondada) * 100) / 100;

  const purchase = await prisma.cardPurchase.create({
    data: {
      userId: user.id,
      cartaoId: data.cartaoId,
      descricao: data.descricao,
      valorTotal: data.valorTotal,
      totalParcelas: data.totalParcelas,
      dataCompra,
      primeiraCompetenciaMes: primeiraMes,
      primeiraCompetenciaAno: primeiraAno,
      categoriaId: data.categoriaId || null,
      ehAssinatura: data.ehAssinatura,
      observacoes: data.observacoes || null,
    },
  });

  // Gera as N parcelas filhas
  for (let i = 0; i < data.totalParcelas; i++) {
    let m = primeiraMes + i;
    let a = primeiraAno;
    while (m > 12) {
      m -= 12;
      a += 1;
    }
    const vencimento = safeDate(a, m, cartao.diaVencimento);
    const valor =
      i === data.totalParcelas - 1 ? valorParcela + ajusteUltima : valorParcela;

    const invoice = await ensureInvoice(user.id, cartao.id, m, a);

    await prisma.cardInstallment.create({
      data: {
        userId: user.id,
        purchaseId: purchase.id,
        invoiceId: invoice.id,
        numero: i + 1,
        valor,
        mes: m,
        ano: a,
        dataVencimento: vencimento,
        status: "prevista",
      },
    });

    await recomputarTotalFatura(invoice.id);
  }

  revalidatePath("/cartoes");
  revalidatePath("/lancamentos");
  revalidatePath("/demonstrativo");
  revalidatePath(`/cartoes/${cartao.id}`);

  return purchase;
}

export async function cancelarCompraCartao(id: string) {
  const user = await requireUser();
  const own = await prisma.cardPurchase.findFirst({
    where: { id, userId: user.id },
    include: { installments: true },
  });
  if (!own) throw new Error("Compra não encontrada");

  await prisma.cardPurchase.update({
    where: { id },
    data: { status: "cancelada" },
  });
  await prisma.cardInstallment.updateMany({
    where: { purchaseId: id, status: { in: ["prevista", "atrasada"] } },
    data: { status: "cancelada" },
  });

  // Recalcula faturas afetadas
  const invoiceIds = new Set<string>(
    own.installments.map((i) => i.invoiceId).filter((v): v is string => !!v),
  );
  for (const iv of invoiceIds) await recomputarTotalFatura(iv);

  revalidatePath("/cartoes");
  revalidatePath(`/cartoes/${own.cartaoId}`);
  revalidatePath("/demonstrativo");
}

export async function excluirCompraCartao(id: string) {
  const user = await requireUser();
  const own = await prisma.cardPurchase.findFirst({
    where: { id, userId: user.id },
    include: { installments: true },
  });
  if (!own) throw new Error("Compra não encontrada");

  const invoiceIds = new Set<string>(
    own.installments.map((i) => i.invoiceId).filter((v): v is string => !!v),
  );

  await prisma.cardPurchase.delete({ where: { id } });

  for (const iv of invoiceIds) await recomputarTotalFatura(iv);

  revalidatePath("/cartoes");
  revalidatePath(`/cartoes/${own.cartaoId}`);
  revalidatePath("/demonstrativo");
}

export async function marcarParcelaPaga(installmentId: string) {
  const user = await requireUser();
  const inst = await prisma.cardInstallment.findFirst({
    where: { id: installmentId, userId: user.id },
  });
  if (!inst) throw new Error("Parcela não encontrada");

  await prisma.cardInstallment.update({
    where: { id: installmentId },
    data: { status: "paga", dataPagamento: new Date() },
  });

  if (inst.invoiceId) await recomputarTotalFatura(inst.invoiceId);

  revalidatePath("/demonstrativo");
  revalidatePath("/cartoes");
}

/**
 * Calcula limite usado de UM cartão.
 * Regra: soma dos valorTotal de purchases ativas, MENOS o que já foi pago das
 * parcelas. À medida que parcelas são pagas, o limite vai sendo liberado.
 */
export async function calcularLimiteUsado(cartaoId: string): Promise<number> {
  const purchases = await prisma.cardPurchase.findMany({
    where: { cartaoId, status: "ativa" },
    include: { installments: true },
  });

  let comprometido = 0;
  for (const p of purchases) {
    const pago = p.installments
      .filter((i) => i.status === "paga")
      .reduce((acc, i) => acc + i.valor, 0);
    comprometido += Math.max(0, p.valorTotal - pago);
  }
  return comprometido;
}
