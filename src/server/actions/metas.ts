"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const schema = z.object({
  nome: z.string().min(1),
  valorAlvo: z.number().min(0.01),
  valorAtual: z.number().min(0).default(0),
  prazo: z.string().nullable().optional(),
  categoria: z
    .enum([
      "emergencia",
      "viagem",
      "imovel",
      "veiculo",
      "educacao",
      "aposentadoria",
      "outros",
    ])
    .nullable()
    .optional(),
  observacao: z.string().nullable().optional(),
  status: z.enum(["em_andamento", "concluida", "cancelada"]).default("em_andamento"),
});

export type MetaInput = z.infer<typeof schema>;

function toDate(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export async function criarMeta(input: MetaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  await prisma.financialGoal.create({
    data: {
      userId: user.id,
      nome: data.nome,
      valorAlvo: data.valorAlvo,
      valorAtual: data.valorAtual,
      prazo: toDate(data.prazo),
      categoria: data.categoria ?? null,
      observacao: data.observacao || null,
      status: data.status,
    },
  });
  revalidatePath("/metas");
}

export async function atualizarMeta(id: string, input: MetaInput) {
  const user = await requireUser();
  const data = schema.parse(input);
  const own = await prisma.financialGoal.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Meta não encontrada");
  await prisma.financialGoal.update({
    where: { id },
    data: {
      nome: data.nome,
      valorAlvo: data.valorAlvo,
      valorAtual: data.valorAtual,
      prazo: toDate(data.prazo),
      categoria: data.categoria ?? null,
      observacao: data.observacao || null,
      status: data.status,
    },
  });
  revalidatePath("/metas");
}

export async function ajustarValorMeta(id: string, valorAtual: number) {
  const user = await requireUser();
  const own = await prisma.financialGoal.findFirst({
    where: { id, userId: user.id },
    select: { id: true, valorAlvo: true },
  });
  if (!own) throw new Error("Meta não encontrada");
  const concluida = valorAtual >= own.valorAlvo;
  await prisma.financialGoal.update({
    where: { id },
    data: {
      valorAtual,
      ...(concluida ? { status: "concluida" } : {}),
    },
  });
  revalidatePath("/metas");
}

export async function excluirMeta(id: string) {
  const user = await requireUser();
  const own = await prisma.financialGoal.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Meta não encontrada");
  await prisma.financialGoal.delete({ where: { id } });
  revalidatePath("/metas");
}
