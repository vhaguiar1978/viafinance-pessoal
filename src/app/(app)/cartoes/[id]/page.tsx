import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { calcularLimiteUsado } from "@/server/actions/card-purchases";
import { CartaoDetalheClient } from "./cartao-detalhe-client";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function CartaoDetalhePage({ params, searchParams }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const cartao = await prisma.cartao.findFirst({
    where: { id, userId: user.id },
  });
  if (!cartao) notFound();

  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();

  const [installmentsMes, invoice, purchasesAtivas] = await Promise.all([
    prisma.cardInstallment.findMany({
      where: { userId: user.id, mes, ano, purchase: { cartaoId: id } },
      include: {
        purchase: { include: { categoria: true } },
      },
      orderBy: { dataVencimento: "asc" },
    }),
    prisma.cardInvoice.findUnique({
      where: { cartaoId_mes_ano: { cartaoId: id, mes, ano } },
    }),
    prisma.cardPurchase.findMany({
      where: { userId: user.id, cartaoId: id, status: "ativa" },
      include: {
        categoria: true,
        installments: { orderBy: { numero: "asc" } },
      },
      orderBy: { dataCompra: "desc" },
      take: 50,
    }),
  ]);

  const limiteUsado = await calcularLimiteUsado(id);

  return (
    <CartaoDetalheClient
      cartao={cartao}
      mes={mes}
      ano={ano}
      limiteUsado={limiteUsado}
      installmentsMes={installmentsMes}
      invoice={invoice}
      purchasesAtivas={purchasesAtivas}
    />
  );
}
