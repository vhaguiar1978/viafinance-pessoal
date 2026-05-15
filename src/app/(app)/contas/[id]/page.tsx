import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ContaDetalheClient } from "./conta-detalhe-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContaDetalhePage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const conta = await prisma.conta.findFirst({
    where: { id, userId: user.id },
  });
  if (!conta) notFound();

  const [lancamentos, transferenciasEnviadas, transferenciasRecebidas] =
    await Promise.all([
      prisma.lancamento.findMany({
        where: { userId: user.id, contaId: id },
        include: { categoria: true, cartao: true },
        orderBy: { data: "desc" },
        take: 500,
      }),
      prisma.transferencia.findMany({
        where: { userId: user.id, origemContaId: id },
        include: { destinoConta: true },
        orderBy: { data: "desc" },
        take: 500,
      }),
      prisma.transferencia.findMany({
        where: { userId: user.id, destinoContaId: id },
        include: { origemConta: true },
        orderBy: { data: "desc" },
        take: 500,
      }),
    ]);

  return (
    <ContaDetalheClient
      conta={conta}
      lancamentos={lancamentos}
      transferenciasEnviadas={transferenciasEnviadas}
      transferenciasRecebidas={transferenciasRecebidas}
    />
  );
}
