"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseCSV } from "../csv-parser";
import { sugerirCategoria } from "../categorization";

const criarBatchSchema = z.object({
  nome: z.string().min(1),
  csv: z.string().min(1),
  contaId: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
});

export async function criarImportBatch(input: z.infer<typeof criarBatchSchema>) {
  const user = await requireUser();
  const data = criarBatchSchema.parse(input);
  const parsed = parseCSV(data.csv);

  if (parsed.erros.length > 0 && parsed.rows.length === 0) {
    throw new Error(parsed.erros[0]);
  }

  // Cria batch
  const batch = await prisma.importBatch.create({
    data: {
      userId: user.id,
      nome: data.nome,
      formato: "csv",
      origem: data.origem || null,
      contaId: data.contaId || null,
      status: "rascunho",
      totalLinhas: parsed.totalLinhas,
    },
  });

  // Detecta duplicatas comparando com lançamentos existentes (mesma data ± 1 dia, valor igual, descrição similar)
  let totalDup = 0;
  for (const row of parsed.rows) {
    const inicio = new Date(row.data);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 1);
    const fim = new Date(row.data);
    fim.setHours(23, 59, 59, 999);
    fim.setDate(fim.getDate() + 1);

    const possivelDup = await prisma.lancamento.findFirst({
      where: {
        userId: user.id,
        valor: row.valor,
        tipo: row.tipo,
        data: { gte: inicio, lte: fim },
      },
    });

    const ehDup = !!possivelDup;
    if (ehDup) totalDup++;

    const categoriaId = await sugerirCategoria(user.id, row.descricao, row.tipo);

    await prisma.importedTransaction.create({
      data: {
        batchId: batch.id,
        dataOriginal: row.data,
        descricaoOriginal: row.descricao,
        valorOriginal: row.valor,
        data: row.data,
        descricao: row.descricao,
        valor: row.valor,
        tipo: row.tipo,
        categoriaId: categoriaId,
        duplicaDeLancamentoId: possivelDup?.id ?? null,
        status: ehDup ? "duplicada" : "pendente",
        selecionado: !ehDup,
      },
    });
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { totalDuplicadas: totalDup },
  });

  revalidatePath("/importar");
  return batch.id;
}

const atualizarTxSchema = z.object({
  id: z.string(),
  selecionado: z.boolean().optional(),
  categoriaId: z.string().nullable().optional(),
  data: z.string().optional(),
  descricao: z.string().optional(),
  valor: z.number().optional(),
  tipo: z.enum(["despesa", "receita"]).optional(),
});

export async function atualizarTransacaoImportada(
  input: z.infer<typeof atualizarTxSchema>,
) {
  const user = await requireUser();
  const data = atualizarTxSchema.parse(input);
  const own = await prisma.importedTransaction.findFirst({
    where: { id: data.id, batch: { userId: user.id } },
    select: { id: true, batchId: true, descricao: true, tipo: true },
  });
  if (!own) throw new Error("Transação não encontrada");

  await prisma.importedTransaction.update({
    where: { id: data.id },
    data: {
      ...(data.selecionado !== undefined ? { selecionado: data.selecionado } : {}),
      ...(data.categoriaId !== undefined
        ? { categoriaId: data.categoriaId || null }
        : {}),
      ...(data.data ? { data: new Date(data.data) } : {}),
      ...(data.descricao ? { descricao: data.descricao } : {}),
      ...(data.valor !== undefined ? { valor: data.valor } : {}),
      ...(data.tipo ? { tipo: data.tipo } : {}),
    },
  });

  // Propagação em lote: quando o usuário define a categoria de UMA transação,
  // aplica a mesma categoria a todas as outras OUTRAS transações do MESMO
  // batch que tenham a MESMA descrição (case-insensitive) e ainda estejam sem
  // categoria. Isso reduz drasticamente o trabalho manual em extratos com
  // muitas linhas iguais (Pix para o mesmo destinatário, débitos recorrentes
  // etc.). Não sobrescreve categorias já definidas pelo usuário.
  let propagadas = 0;
  if (data.categoriaId !== undefined && data.categoriaId) {
    const r = await prisma.importedTransaction.updateMany({
      where: {
        batchId: own.batchId,
        id: { not: own.id },
        categoriaId: null,
        descricao: { equals: own.descricao, mode: "insensitive" },
      },
      data: { categoriaId: data.categoriaId },
    });
    propagadas = r.count;
  }

  revalidatePath("/importar");
  return { propagadas };
}

export async function confirmarImportBatch(batchId: string) {
  const user = await requireUser();
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: user.id },
    include: { transactions: true },
  });
  if (!batch) throw new Error("Importação não encontrada");
  if (batch.status === "confirmado") {
    return { ok: true, importadas: batch.totalImportadas };
  }

  let importadas = 0;
  for (const t of batch.transactions) {
    if (!t.selecionado || t.status === "duplicada") continue;
    await prisma.lancamento.create({
      data: {
        userId: user.id,
        descricao: t.descricao,
        valor: t.valor,
        data: t.data,
        tipo: t.tipo,
        status: "paga",
        formaPagamento: "conta",
        categoriaId: t.categoriaId || null,
        contaId: batch.contaId || null,
        observacoes: `Importado em ${new Date().toLocaleDateString("pt-BR")}`,
      },
    });
    importadas++;
    await prisma.importedTransaction.update({
      where: { id: t.id },
      data: { status: "importado" },
    });
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "confirmado",
      confirmedAt: new Date(),
      totalImportadas: importadas,
    },
  });

  revalidatePath("/importar");
  revalidatePath("/demonstrativo");
  revalidatePath("/lancamentos");
  return { ok: true, importadas };
}

/**
 * Importação 1-shot: cria o batch e já confirma de uma vez, importando todas
 * as linhas não-duplicadas. Não cria histórico de "rascunho" — direto pra
 * lançamentos. Use quando o usuário escolhe "Importar tudo de uma vez".
 *
 * Retorna { importadas, duplicadas, total }.
 */
export async function importarDireto(input: z.infer<typeof criarBatchSchema>) {
  const user = await requireUser();
  const batchId = await criarImportBatch(input);
  const r = await confirmarImportBatch(batchId);
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: user.id },
  });
  return {
    importadas: r.importadas,
    duplicadas: batch?.totalDuplicadas ?? 0,
    total: batch?.totalLinhas ?? 0,
  };
}

export async function cancelarImportBatch(batchId: string) {
  const user = await requireUser();
  const own = await prisma.importBatch.findFirst({
    where: { id: batchId, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Importação não encontrada");
  await prisma.importBatch.delete({ where: { id: batchId } });
  revalidatePath("/importar");
}
