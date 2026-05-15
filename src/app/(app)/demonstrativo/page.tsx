import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  gerarDespesasFixasDoMes,
  obterCompetencia,
  totaisDoMes,
} from "@/server/competencia";
import { DemonstrativoClient } from "./demonstrativo-client";

interface Props {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}

export default async function DemonstrativoPage({ searchParams }: Props) {
  const user = await requireUser();
  const sp = await searchParams;

  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();

  // Sob demanda: garante que as ocorrências do mês estão geradas
  await gerarDespesasFixasDoMes(user.id, mes, ano);

  const comp = obterCompetencia(mes, ano);

  const [
    lancamentos,
    ocorrencias,
    investimentos,
    cardInstallments,
    transferencias,
    categorias,
    contas,
    cartoes,
    totais,
  ] = await Promise.all([
    prisma.lancamento.findMany({
      where: { userId: user.id, data: { gte: comp.inicio, lte: comp.fim } },
      include: { categoria: true, conta: true, cartao: true },
      orderBy: { data: "asc" },
    }),
    prisma.despesaFixaMensal.findMany({
      where: { userId: user.id, mes, ano },
      include: {
        despesaFixa: {
          include: { categoria: true, conta: true, cartao: true },
        },
      },
      orderBy: { diaVencimento: "asc" },
    }),
    prisma.investimento.findMany({
      where: { userId: user.id, data: { gte: comp.inicio, lte: comp.fim } },
      include: { conta: true },
      orderBy: { data: "asc" },
    }),
    prisma.cardInstallment.findMany({
      where: { userId: user.id, mes, ano },
      include: {
        purchase: {
          include: { categoria: true, cartao: true },
        },
      },
      orderBy: { dataVencimento: "asc" },
    }),
    prisma.transferencia.findMany({
      where: { userId: user.id, data: { gte: comp.inicio, lte: comp.fim } },
      include: { origemConta: true, destinoConta: true },
      orderBy: { data: "asc" },
    }),
    prisma.categoria.findMany({
      where: { userId: user.id },
      orderBy: { nome: "asc" },
    }),
    prisma.conta.findMany({
      where: { userId: user.id },
      orderBy: { nome: "asc" },
    }),
    prisma.cartao.findMany({
      where: { userId: user.id },
      orderBy: { nome: "asc" },
    }),
    totaisDoMes(user.id, mes, ano),
  ]);

  return (
    <DemonstrativoClient
      mes={mes}
      ano={ano}
      nomeMes={comp.nome}
      totais={totais}
      lancamentos={lancamentos}
      ocorrencias={ocorrencias}
      investimentos={investimentos}
      cardInstallments={cardInstallments}
      transferencias={transferencias}
      categorias={categorias}
      contas={contas}
      cartoes={cartoes}
    />
  );
}
