import { prisma } from "@/lib/prisma";
import { safeDate, nomeMes } from "@/lib/utils";

export interface CompetenciaInfo {
  mes: number;
  ano: number;
  nome: string;
  inicio: Date;
  fim: Date;
}

export function obterCompetencia(mes: number, ano: number): CompetenciaInfo {
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
  return { mes, ano, nome: nomeMes(mes), inicio, fim };
}

export function competenciaAnterior(mes: number, ano: number) {
  return mes === 1
    ? { mes: 12, ano: ano - 1 }
    : { mes: mes - 1, ano };
}

export function competenciaProxima(mes: number, ano: number) {
  return mes === 12
    ? { mes: 1, ano: ano + 1 }
    : { mes: mes + 1, ano };
}

/**
 * Gera (ou atualiza) as ocorrências mensais de TODAS as despesas fixas ativas
 * do usuário para o mês/ano dado. Idempotente: se já existir, não duplica.
 *
 * Regra (item 3 e 5 da especificação):
 *  - O template (DespesaFixa) é a fonte da verdade para previsão.
 *  - A ocorrência (DespesaFixaMensal) carrega o valor previsto naquele mês
 *    e, opcionalmente, o valor real.
 *  - Editar o template afeta meses futuros não-gerados; o valor real do mês
 *    NÃO altera os próximos meses.
 */
export async function gerarDespesasFixasDoMes(
  userId: string,
  mes: number,
  ano: number,
) {
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

  const templates = await prisma.despesaFixa.findMany({
    where: {
      userId,
      ativa: true,
      dataInicio: { lte: fimMes },
      OR: [{ dataFim: null }, { dataFim: { gte: inicioMes } }],
    },
  });

  for (const t of templates) {
    const existe = await prisma.despesaFixaMensal.findUnique({
      where: {
        despesaFixaId_mes_ano: {
          despesaFixaId: t.id,
          mes,
          ano,
        },
      },
    });

    if (existe) continue;

    const dataVencimento = safeDate(ano, mes, t.diaVencimento);
    const hojeMidnight = new Date();
    hojeMidnight.setHours(0, 0, 0, 0);
    const status = dataVencimento < hojeMidnight ? "atrasada" : "prevista";

    await prisma.despesaFixaMensal.create({
      data: {
        userId,
        despesaFixaId: t.id,
        mes,
        ano,
        valorPrevisto: t.valor,
        diaVencimento: t.diaVencimento,
        dataVencimento,
        status,
      },
    });
  }
}

/** Valor "efetivo" da ocorrência: real se houver, previsto caso contrário. */
export function valorEfetivo(o: { valorReal: number | null; valorPrevisto: number }) {
  return o.valorReal ?? o.valorPrevisto;
}

/**
 * Calcula os totais do mês filtrados por UMA conta específica.
 * Considera apenas lançamentos vinculados àquela conta (despesas e receitas
 * pagas pela conta, não pelo cartão).
 */
export interface TotaisContaMes {
  entradas: number;
  despesasPagas: number;
  despesasAbertas: number;
  despesasPrevistas: number;
  saldoMes: number; // entradas - despesas (pagas + abertas)
}

export async function totaisDoMesPorConta(
  userId: string,
  contaId: string,
  mes: number,
  ano: number,
): Promise<TotaisContaMes> {
  const { inicio, fim } = obterCompetencia(mes, ano);
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      userId,
      contaId,
      data: { gte: inicio, lte: fim },
      status: { not: "cancelada" },
    },
  });
  let entradas = 0;
  let despesasPagas = 0;
  let despesasAbertas = 0;
  let despesasPrevistas = 0;
  for (const l of lancamentos) {
    if (l.tipo === "receita") {
      if (l.status === "paga" || l.status === "confirmada")
        entradas += l.valor;
    } else {
      if (l.status === "paga") {
        despesasPagas += l.valor;
      } else if (l.status === "prevista") {
        despesasPrevistas += l.valor;
        despesasAbertas += l.valor;
      } else {
        despesasAbertas += l.valor;
      }
    }
  }
  const saldoMes = entradas - despesasPagas - despesasAbertas;
  return { entradas, despesasPagas, despesasAbertas, despesasPrevistas, saldoMes };
}

/**
 * Totais ACUMULADOS de uma conta (todas as movimentações de sempre, não
 * apenas do mês). Útil pra mostrar "quanto entrou/saiu na vida dessa conta"
 * quando o usuário clica nela no Dashboard.
 */
export async function totaisAcumuladosConta(
  userId: string,
  contaId: string,
): Promise<TotaisContaMes> {
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      userId,
      contaId,
      status: { not: "cancelada" },
    },
  });
  const transfsIn = await prisma.transferencia.findMany({
    where: { userId, destinoContaId: contaId },
  });
  const transfsOut = await prisma.transferencia.findMany({
    where: { userId, origemContaId: contaId },
  });

  let entradas = 0;
  let despesasPagas = 0;
  let despesasAbertas = 0;
  let despesasPrevistas = 0;
  for (const l of lancamentos) {
    if (l.tipo === "receita") {
      if (l.status === "paga" || l.status === "confirmada")
        entradas += l.valor;
    } else {
      if (l.status === "paga") despesasPagas += l.valor;
      else if (l.status === "prevista") {
        despesasPrevistas += l.valor;
        despesasAbertas += l.valor;
      } else despesasAbertas += l.valor;
    }
  }
  // Transferências também contam como entradas/saídas pra essa conta
  for (const t of transfsIn) entradas += t.valor;
  for (const t of transfsOut) despesasPagas += t.valor;

  const saldoMes = entradas - despesasPagas - despesasAbertas;
  return {
    entradas,
    despesasPagas,
    despesasAbertas,
    despesasPrevistas,
    saldoMes,
  };
}

/**
 * Calcula o saldo atual de uma conta:
 * saldo inicial + receitas pagas - despesas pagas + transferências recebidas - enviadas.
 * Considera apenas lançamentos com status != cancelada.
 */
export async function calcularSaldoConta(
  userId: string,
  contaId: string,
): Promise<number> {
  const conta = await prisma.conta.findFirst({
    where: { id: contaId, userId },
  });
  if (!conta) return 0;

  const [lancamentos, transfOut, transfIn] = await Promise.all([
    prisma.lancamento.findMany({
      where: { userId, contaId, status: { not: "cancelada" } },
    }),
    prisma.transferencia.findMany({ where: { userId, origemContaId: contaId } }),
    prisma.transferencia.findMany({ where: { userId, destinoContaId: contaId } }),
  ]);

  let saldo = conta.saldoInicial;
  for (const l of lancamentos) {
    saldo += l.tipo === "receita" ? l.valor : -l.valor;
  }
  for (const t of transfOut) saldo -= t.valor;
  for (const t of transfIn) saldo += t.valor;
  return saldo;
}

export interface TotaisMes {
  entradas: number;
  despesasPagas: number;
  despesasAbertas: number; // prevista/confirmada/atrasada (não pagas, não canceladas)
  despesasPrevistas: number; // só status "prevista"
  gastosCartao: number;
  investimentos: number;
  saldoFinal: number;
  // Limite mensal
  limiteMensal: number | null;
  limiteUsado: number;
  limiteDisponivel: number | null;
  limitePercentual: number | null; // 0..1+
  limiteIncluiCartao: boolean;
  limiteIncluiInvestimentos: boolean;
}

/**
 * Totaliza o mês respeitando o conceito de competência (item 10):
 *  - Lançamentos por sua `data` no intervalo do mês.
 *  - Despesas fixas pela ocorrência daquele mês.
 */
export async function totaisDoMes(
  userId: string,
  mes: number,
  ano: number,
): Promise<TotaisMes> {
  const { inicio, fim } = obterCompetencia(mes, ano);

  const [lancamentos, ocorrencias, investimentosMes, parcelasCartao, limiteMensal] =
    await Promise.all([
      prisma.lancamento.findMany({
        where: { userId, data: { gte: inicio, lte: fim } },
      }),
      prisma.despesaFixaMensal.findMany({
        where: { userId, mes, ano },
      }),
      prisma.investimento.findMany({
        where: { userId, data: { gte: inicio, lte: fim } },
      }),
      prisma.cardInstallment.findMany({
        where: { userId, mes, ano, status: { not: "cancelada" } },
      }),
      prisma.monthlyLimit.findUnique({
        where: { userId_mes_ano: { userId, mes, ano } },
      }),
    ]);

  let entradas = 0;
  let despesasPagas = 0;
  let despesasAbertas = 0;
  let despesasPrevistas = 0;
  let gastosCartao = 0;

  for (const l of lancamentos) {
    if (l.tipo === "receita") {
      if (l.status === "paga" || l.status === "confirmada") entradas += l.valor;
      continue;
    }
    if (l.status === "cancelada") continue;
    if (l.cartaoId) gastosCartao += l.valor;
    if (l.status === "paga") {
      despesasPagas += l.valor;
    } else if (l.status === "prevista") {
      despesasPrevistas += l.valor;
      despesasAbertas += l.valor;
    } else {
      despesasAbertas += l.valor;
    }
  }

  for (const o of ocorrencias) {
    if (o.status === "cancelada") continue;
    const v = valorEfetivo(o);
    if (o.status === "paga") {
      despesasPagas += v;
    } else if (o.status === "prevista") {
      despesasPrevistas += v;
      despesasAbertas += v;
    } else {
      despesasAbertas += v;
    }
  }

  // Parcelas de cartão do mês (CardInstallment)
  for (const p of parcelasCartao) {
    gastosCartao += p.valor;
    if (p.status === "paga") {
      despesasPagas += p.valor;
    } else if (p.status === "prevista") {
      despesasPrevistas += p.valor;
      despesasAbertas += p.valor;
    } else {
      despesasAbertas += p.valor;
    }
  }

  let investimentos = 0;
  for (const i of investimentosMes) {
    if (i.tipo === "aporte") investimentos += i.valor;
    else if (i.tipo === "resgate") investimentos -= i.valor;
  }

  const saldoFinal = entradas - despesasPagas - despesasAbertas - investimentos;

  // Limite mensal de gastos
  let limiteUsado = despesasPagas + despesasAbertas;
  if (limiteMensal && !limiteMensal.incluiCartao) {
    limiteUsado -= gastosCartao;
    if (limiteUsado < 0) limiteUsado = 0;
  }
  if (limiteMensal?.incluiInvestimentos) {
    limiteUsado += Math.max(0, investimentos);
  }

  const limiteValor = limiteMensal?.valor ?? null;
  const limiteDisponivel = limiteValor === null ? null : limiteValor - limiteUsado;
  const limitePercentual =
    limiteValor === null || limiteValor === 0 ? null : limiteUsado / limiteValor;

  return {
    entradas,
    despesasPagas,
    despesasAbertas,
    despesasPrevistas,
    gastosCartao,
    investimentos,
    saldoFinal,
    limiteMensal: limiteValor,
    limiteUsado,
    limiteDisponivel,
    limitePercentual,
    limiteIncluiCartao: limiteMensal?.incluiCartao ?? true,
    limiteIncluiInvestimentos: limiteMensal?.incluiInvestimentos ?? false,
  };
}
