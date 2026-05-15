"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { safeDate } from "@/lib/utils";

const templateSchema = z.object({
  descricao: z.string().min(1, "Informe a descrição"),
  tipoValor: z.enum(["fixo", "variavel"]),
  valor: z.number().min(0),
  categoriaId: z.string().nullable().optional(),
  contaId: z.string().nullable().optional(),
  cartaoId: z.string().nullable().optional(),
  diaVencimento: z.number().int().min(1).max(31),
  dataInicio: z.string(), // ISO YYYY-MM-DD
  dataFim: z.string().nullable().optional(),
  ativa: z.boolean().default(true),
});

export type DespesaFixaInput = z.infer<typeof templateSchema>;

function toDate(iso: string): Date {
  // Garante que dia é interpretado em local (ignorar TZ)
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export async function criarDespesaFixa(input: DespesaFixaInput) {
  const user = await requireUser();
  const data = templateSchema.parse(input);
  const created = await prisma.despesaFixa.create({
    data: {
      userId: user.id,
      descricao: data.descricao,
      tipoValor: data.tipoValor,
      valor: data.valor,
      categoriaId: data.categoriaId || null,
      contaId: data.contaId || null,
      cartaoId: data.cartaoId || null,
      diaVencimento: data.diaVencimento,
      dataInicio: toDate(data.dataInicio),
      dataFim: data.dataFim ? toDate(data.dataFim) : null,
      ativa: data.ativa,
    },
  });
  revalidatePath("/despesas-fixas");
  revalidatePath("/demonstrativo");
  return created;
}

/**
 * Escopo de atualização do template (regra do item 3):
 *  - "este-mes": cria/atualiza apenas a ocorrência do mês de competência informado,
 *    sem mexer no template; será uma override "só deste mês".
 *  - "todos-proximos": altera o template (afeta meses futuros ainda não gerados).
 *    Atualizamos também as ocorrências FUTURAS que estejam em status "prevista"
 *    e ainda não tenham valorReal, para refletir a mudança imediatamente.
 *    Ocorrências passadas ficam intactas.
 */
export type EscopoEdicao = "este-mes" | "todos-proximos";

export async function atualizarDespesaFixa(
  id: string,
  input: DespesaFixaInput,
  escopo: EscopoEdicao,
  competencia?: { mes: number; ano: number },
) {
  const user = await requireUser();
  const data = templateSchema.parse(input);
  const own = await prisma.despesaFixa.findFirst({
    where: { id, userId: user.id },
  });
  if (!own) throw new Error("Despesa fixa não encontrada");

  if (escopo === "este-mes") {
    if (!competencia) throw new Error("Competência necessária");
    const { mes, ano } = competencia;
    const dataVencimento = safeDate(ano, mes, data.diaVencimento);
    const existing = await prisma.despesaFixaMensal.findUnique({
      where: { despesaFixaId_mes_ano: { despesaFixaId: id, mes, ano } },
    });
    if (existing) {
      await prisma.despesaFixaMensal.update({
        where: { id: existing.id },
        data: {
          valorPrevisto: data.valor,
          diaVencimento: data.diaVencimento,
          dataVencimento,
          descricaoOverride:
            data.descricao !== own.descricao ? data.descricao : null,
          categoriaIdOverride:
            data.categoriaId !== own.categoriaId ? data.categoriaId : null,
          contaIdOverride: data.contaId !== own.contaId ? data.contaId : null,
          cartaoIdOverride:
            data.cartaoId !== own.cartaoId ? data.cartaoId : null,
        },
      });
    } else {
      await prisma.despesaFixaMensal.create({
        data: {
          userId: user.id,
          despesaFixaId: id,
          mes,
          ano,
          valorPrevisto: data.valor,
          diaVencimento: data.diaVencimento,
          dataVencimento,
          descricaoOverride:
            data.descricao !== own.descricao ? data.descricao : null,
          categoriaIdOverride:
            data.categoriaId !== own.categoriaId ? data.categoriaId : null,
          contaIdOverride: data.contaId !== own.contaId ? data.contaId : null,
          cartaoIdOverride:
            data.cartaoId !== own.cartaoId ? data.cartaoId : null,
          status: "prevista",
        },
      });
    }
    revalidatePath("/despesas-fixas");
    revalidatePath("/demonstrativo");
    return;
  }

  // Escopo: todos os próximos meses — atualiza o template
  await prisma.despesaFixa.update({
    where: { id },
    data: {
      descricao: data.descricao,
      tipoValor: data.tipoValor,
      valor: data.valor,
      categoriaId: data.categoriaId || null,
      contaId: data.contaId || null,
      cartaoId: data.cartaoId || null,
      diaVencimento: data.diaVencimento,
      dataInicio: toDate(data.dataInicio),
      dataFim: data.dataFim ? toDate(data.dataFim) : null,
      ativa: data.ativa,
    },
  });

  // Atualiza ocorrências futuras (>= competência informada) que ainda estão
  // previstas/sem valor real, para refletir a alteração.
  if (competencia) {
    const { mes, ano } = competencia;
    const futuras = await prisma.despesaFixaMensal.findMany({
      where: {
        despesaFixaId: id,
        valorReal: null,
        status: { in: ["prevista", "atrasada"] },
        OR: [{ ano: { gt: ano } }, { ano, mes: { gte: mes } }],
      },
    });
    for (const f of futuras) {
      const dataVencimento = safeDate(f.ano, f.mes, data.diaVencimento);
      await prisma.despesaFixaMensal.update({
        where: { id: f.id },
        data: {
          valorPrevisto: data.valor,
          diaVencimento: data.diaVencimento,
          dataVencimento,
        },
      });
    }
  }

  revalidatePath("/despesas-fixas");
  revalidatePath("/demonstrativo");
}

export async function alternarStatusDespesaFixa(id: string, ativa: boolean) {
  const user = await requireUser();
  const own = await prisma.despesaFixa.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Despesa fixa não encontrada");
  await prisma.despesaFixa.update({ where: { id }, data: { ativa } });
  revalidatePath("/despesas-fixas");
}

export async function excluirDespesaFixa(id: string) {
  const user = await requireUser();
  const own = await prisma.despesaFixa.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Despesa fixa não encontrada");
  await prisma.despesaFixa.delete({ where: { id } });
  revalidatePath("/despesas-fixas");
  revalidatePath("/demonstrativo");
}

/**
 * Informa o VALOR REAL daquele mês para uma ocorrência. Não altera o template
 * nem os próximos meses (item 3).
 */
export async function informarValorReal(
  ocorrenciaId: string,
  valorReal: number | null,
) {
  const user = await requireUser();
  const own = await prisma.despesaFixaMensal.findFirst({
    where: { id: ocorrenciaId, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Ocorrência não encontrada");
  await prisma.despesaFixaMensal.update({
    where: { id: ocorrenciaId },
    data: { valorReal },
  });
  revalidatePath("/demonstrativo");
  revalidatePath("/despesas-fixas");
}

export async function alterarStatusOcorrencia(
  ocorrenciaId: string,
  status: string,
  valorReal?: number,
) {
  const user = await requireUser();
  const own = await prisma.despesaFixaMensal.findFirst({
    where: { id: ocorrenciaId, userId: user.id },
  });
  if (!own) throw new Error("Ocorrência não encontrada");
  await prisma.despesaFixaMensal.update({
    where: { id: ocorrenciaId },
    data: {
      status,
      dataPagamento: status === "paga" ? new Date() : null,
      valorReal:
        valorReal !== undefined
          ? valorReal
          : status === "paga" && own.valorReal === null
            ? own.valorPrevisto
            : own.valorReal,
    },
  });
  revalidatePath("/demonstrativo");
  revalidatePath("/despesas-fixas");
}

export async function excluirOcorrencia(id: string) {
  const user = await requireUser();
  const own = await prisma.despesaFixaMensal.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Ocorrência não encontrada");
  await prisma.despesaFixaMensal.update({
    where: { id },
    data: { status: "cancelada" },
  });
  revalidatePath("/demonstrativo");
}
