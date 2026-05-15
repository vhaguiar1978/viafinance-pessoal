"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

// -------------------- ASSET (ativo) --------------------

const assetSchema = z.object({
  nome: z.string().min(1),
  instituicao: z.string().nullable().optional(),
  tipo: z.enum([
    "poupanca",
    "cdb",
    "lci",
    "lca",
    "tesouro",
    "fundo",
    "bolsa",
    "acoes",
    "fii",
    "etf",
    "bdr",
    "cripto",
    "previdencia",
    "conta_remunerada",
    "outros",
  ]),
  valorAplicado: z.number().min(0).default(0),
  valorAtual: z.number().min(0).default(0),
  dataAplicacao: z.string().nullable().optional(),
  vencimento: z.string().nullable().optional(),
  liquidez: z
    .enum(["diaria", "mensal", "trimestral", "anual", "sem_liquidez"])
    .nullable()
    .optional(),
  risco: z.enum(["baixo", "medio", "alto"]).nullable().optional(),
  objetivo: z.string().nullable().optional(),
  status: z.enum(["ativo", "resgatado", "vencido"]).default("ativo"),
  observacoes: z.string().nullable().optional(),
});

export type InvestmentAssetInput = z.infer<typeof assetSchema>;

function toDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export async function criarAsset(input: InvestmentAssetInput) {
  const user = await requireUser();
  const data = assetSchema.parse(input);
  const a = await prisma.investmentAsset.create({
    data: {
      userId: user.id,
      nome: data.nome,
      instituicao: data.instituicao || null,
      tipo: data.tipo,
      valorAplicado: data.valorAplicado,
      valorAtual: data.valorAtual || data.valorAplicado,
      dataAplicacao: toDate(data.dataAplicacao),
      vencimento: toDate(data.vencimento),
      liquidez: data.liquidez ?? null,
      risco: data.risco ?? null,
      objetivo: data.objetivo || null,
      status: data.status,
      observacoes: data.observacoes || null,
    },
  });
  revalidatePath("/investimentos");
  return a;
}

export async function atualizarAsset(id: string, input: InvestmentAssetInput) {
  const user = await requireUser();
  const data = assetSchema.parse(input);
  const own = await prisma.investmentAsset.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Ativo não encontrado");
  await prisma.investmentAsset.update({
    where: { id },
    data: {
      nome: data.nome,
      instituicao: data.instituicao || null,
      tipo: data.tipo,
      valorAplicado: data.valorAplicado,
      valorAtual: data.valorAtual,
      dataAplicacao: toDate(data.dataAplicacao),
      vencimento: toDate(data.vencimento),
      liquidez: data.liquidez ?? null,
      risco: data.risco ?? null,
      objetivo: data.objetivo || null,
      status: data.status,
      observacoes: data.observacoes || null,
    },
  });
  revalidatePath("/investimentos");
}

export async function excluirAsset(id: string) {
  const user = await requireUser();
  const own = await prisma.investmentAsset.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Ativo não encontrado");
  await prisma.investmentAsset.delete({ where: { id } });
  revalidatePath("/investimentos");
}

export async function atualizarValorAtual(id: string, valorAtual: number) {
  const user = await requireUser();
  const own = await prisma.investmentAsset.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Ativo não encontrado");
  await prisma.investmentAsset.update({
    where: { id },
    data: { valorAtual },
  });
  // Registra a atualização como movimentação histórica
  await prisma.investimento.create({
    data: {
      userId: user.id,
      descricao: "Atualização de valor",
      tipo: "atualizacao",
      valor: valorAtual,
      data: new Date(),
      assetId: id,
    },
  });
  revalidatePath("/investimentos");
}

// -------------------- MOVIMENTAÇÃO --------------------

const movSchema = z.object({
  descricao: z.string().min(1),
  tipo: z.enum([
    "aporte",
    "resgate",
    "rendimento",
    "atualizacao",
    "taxa",
    "imposto",
    "vencimento",
  ]),
  valor: z.number().min(0),
  data: z.string(),
  assetId: z.string().nullable().optional(),
  contaId: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export type MovimentacaoInput = z.infer<typeof movSchema>;

export async function criarMovimentacao(input: MovimentacaoInput) {
  const user = await requireUser();
  const data = movSchema.parse(input);
  await prisma.investimento.create({
    data: {
      userId: user.id,
      descricao: data.descricao,
      tipo: data.tipo,
      valor: data.valor,
      data: toDate(data.data) ?? new Date(),
      assetId: data.assetId || null,
      contaId: data.contaId || null,
      observacoes: data.observacoes || null,
    },
  });

  // Ajustar valorAplicado/valorAtual do asset, se vinculado
  if (data.assetId) {
    const asset = await prisma.investmentAsset.findFirst({
      where: { id: data.assetId, userId: user.id },
    });
    if (asset) {
      let novoAplicado = asset.valorAplicado;
      let novoAtual = asset.valorAtual;
      if (data.tipo === "aporte") {
        novoAplicado += data.valor;
        novoAtual += data.valor;
      } else if (data.tipo === "resgate") {
        novoAplicado = Math.max(0, novoAplicado - data.valor);
        novoAtual = Math.max(0, novoAtual - data.valor);
      } else if (data.tipo === "rendimento") {
        novoAtual += data.valor;
      } else if (data.tipo === "taxa" || data.tipo === "imposto") {
        novoAtual = Math.max(0, novoAtual - data.valor);
      }
      await prisma.investmentAsset.update({
        where: { id: data.assetId },
        data: { valorAplicado: novoAplicado, valorAtual: novoAtual },
      });
    }
  }

  revalidatePath("/investimentos");
  revalidatePath("/demonstrativo");
}

export async function excluirMovimentacao(id: string) {
  const user = await requireUser();
  const own = await prisma.investimento.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Movimentação não encontrada");
  await prisma.investimento.delete({ where: { id } });
  revalidatePath("/investimentos");
  revalidatePath("/demonstrativo");
}

// Legado: manter export antigo "criarInvestimento" delegando à nova ação
export async function criarInvestimento(input: {
  descricao: string;
  tipo: "aporte" | "resgate" | "rendimento";
  valor: number;
  data: string;
  ativo?: string | null;
  contaId?: string | null;
  observacoes?: string | null;
}) {
  return criarMovimentacao({
    descricao: input.descricao,
    tipo: input.tipo,
    valor: input.valor,
    data: input.data,
    assetId: null,
    contaId: input.contaId ?? null,
    observacoes: input.observacoes ?? null,
  });
}

export async function excluirInvestimento(id: string) {
  return excluirMovimentacao(id);
}
