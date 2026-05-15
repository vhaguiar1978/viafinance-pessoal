"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { criarDespesaFixa } from "./despesas-fixas";
import { criarCompraCartao } from "./card-purchases";
import { aprenderCategoria } from "../categorization";

const baseSchema = z.object({
  descricao: z.string().min(1, "Informe a descrição"),
  valor: z.number().min(0),
  data: z.string(), // ISO YYYY-MM-DD
  tipo: z.enum(["despesa", "receita"]),
  status: z
    .enum(["prevista", "confirmada", "paga", "atrasada", "cancelada"])
    .default("paga"),
  formaPagamento: z.enum(["conta", "cartao", "dinheiro", "pix"]).nullable().optional(),
  categoriaId: z.string().nullable().optional(),
  contaId: z.string().nullable().optional(),
  cartaoId: z.string().nullable().optional(),
  ehAssinatura: z.boolean().default(false),
  totalParcelas: z.number().int().min(1).max(120).optional(),
  observacoes: z.string().nullable().optional(),
});

const fixaSchema = z.object({
  ehDespesaFixaMensal: z.boolean(),
  tipoValorFixa: z.enum(["fixo", "variavel"]).optional(),
  diaVencimentoFixa: z.number().int().min(1).max(31).optional(),
  dataInicioFixa: z.string().optional(),
  dataFimFixa: z.string().nullable().optional(),
});

const schema = baseSchema.merge(fixaSchema);

export type LancamentoInput = z.infer<typeof schema>;

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export async function criarLancamento(input: LancamentoInput) {
  const user = await requireUser();
  const data = schema.parse(input);

  // Caminho 1: marcado como Despesa fixa mensal — vira um template em
  // DespesaFixa (não vira lançamento comum). A geração mensal preencherá o
  // demonstrativo (item 2/3 da especificação).
  if (data.ehDespesaFixaMensal && data.tipo === "despesa") {
    if (!data.tipoValorFixa) throw new Error("Tipo de valor é obrigatório");
    await criarDespesaFixa({
      descricao: data.descricao,
      tipoValor: data.tipoValorFixa,
      valor: data.valor,
      categoriaId: data.categoriaId ?? null,
      contaId: data.contaId ?? null,
      cartaoId: data.cartaoId ?? null,
      diaVencimento:
        data.diaVencimentoFixa ?? toDate(data.data).getDate(),
      dataInicio: data.dataInicioFixa ?? data.data,
      dataFim: data.dataFimFixa ?? null,
      ativa: true,
    });
    return { tipo: "despesa-fixa" as const };
  }

  // Caminho 2: despesa no CARTÃO (à vista, parcelada ou assinatura).
  // Regra prioritária #1: parcelamento abate o limite UMA VEZ no mês da
  // primeira parcela. Por isso usamos CardPurchase + CardInstallment.
  if (data.tipo === "despesa" && data.cartaoId) {
    const total = data.totalParcelas ?? 1;
    // Para parcelado, o `valor` informado é o VALOR DA PARCELA (compatibilidade
    // com o form atual). O valor total é parcela * total.
    const valorTotal = total > 1 ? data.valor * total : data.valor;
    await criarCompraCartao({
      cartaoId: data.cartaoId,
      descricao: data.descricao,
      valorTotal,
      totalParcelas: total,
      dataCompra: data.data,
      categoriaId: data.categoriaId ?? null,
      ehAssinatura: data.ehAssinatura ?? false,
      observacoes: data.observacoes ?? null,
    });
    return total > 1
      ? ({ tipo: "parcelado" as const, total } as const)
      : ({ tipo: "cartao" as const } as const);
  }

  // Caminho 3: parcelamento sem cartão (legado / parcela em conta) — pouco comum
  if (data.tipo === "despesa" && (data.totalParcelas ?? 1) > 1) {
    const total = data.totalParcelas!;
    const dataBase = toDate(data.data);
    const grupoId = crypto.randomUUID();
    const valorParcela = data.valor;
    for (let i = 0; i < total; i++) {
      const d = new Date(
        dataBase.getFullYear(),
        dataBase.getMonth() + i,
        Math.min(dataBase.getDate(), new Date(dataBase.getFullYear(), dataBase.getMonth() + i + 1, 0).getDate()),
      );
      await prisma.lancamento.create({
        data: {
          userId: user.id,
          descricao: `${data.descricao} (${i + 1}/${total})`,
          valor: valorParcela,
          data: d,
          tipo: data.tipo,
          status: i === 0 ? data.status : "prevista",
          formaPagamento: data.formaPagamento ?? null,
          categoriaId: data.categoriaId || null,
          contaId: data.contaId || null,
          cartaoId: null,
          parcelaAtual: i + 1,
          totalParcelas: total,
          parcelaGrupoId: grupoId,
          ehAssinatura: false,
          observacoes: data.observacoes ?? null,
        },
      });
    }
    revalidatePath("/lancamentos");
    revalidatePath("/demonstrativo");
    return { tipo: "parcelado" as const, total };
  }

  // Caminho 4: lançamento simples (receita ou despesa em conta/dinheiro)
  if (data.categoriaId) {
    await aprenderCategoria(user.id, data.descricao, data.categoriaId);
  }
  await prisma.lancamento.create({
    data: {
      userId: user.id,
      descricao: data.descricao,
      valor: data.valor,
      data: toDate(data.data),
      tipo: data.tipo,
      status: data.status,
      formaPagamento: data.formaPagamento ?? null,
      categoriaId: data.categoriaId || null,
      contaId: data.contaId || null,
      cartaoId: data.cartaoId || null,
      ehAssinatura: data.ehAssinatura,
      observacoes: data.observacoes ?? null,
    },
  });
  revalidatePath("/lancamentos");
  revalidatePath("/demonstrativo");
  return { tipo: "simples" as const };
}

export async function atualizarLancamento(id: string, input: LancamentoInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const own = await prisma.lancamento.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Lançamento não encontrado");
  await prisma.lancamento.update({
    where: { id },
    data: {
      descricao: data.descricao,
      valor: data.valor,
      data: toDate(data.data),
      tipo: data.tipo,
      status: data.status,
      formaPagamento: data.formaPagamento ?? null,
      categoriaId: data.categoriaId || null,
      contaId: data.contaId || null,
      cartaoId: data.cartaoId || null,
      ehAssinatura: data.ehAssinatura,
      observacoes: data.observacoes ?? null,
    },
  });
  revalidatePath("/lancamentos");
  revalidatePath("/demonstrativo");
}

export async function marcarLancamentoPago(id: string) {
  const user = await requireUser();
  const own = await prisma.lancamento.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Lançamento não encontrado");
  await prisma.lancamento.update({
    where: { id },
    data: { status: "paga" },
  });
  revalidatePath("/lancamentos");
  revalidatePath("/demonstrativo");
}

export async function excluirLancamento(id: string) {
  const user = await requireUser();
  const own = await prisma.lancamento.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Lançamento não encontrado");
  await prisma.lancamento.delete({ where: { id } });
  revalidatePath("/lancamentos");
  revalidatePath("/demonstrativo");
}
