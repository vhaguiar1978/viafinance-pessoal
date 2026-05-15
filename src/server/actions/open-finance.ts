"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getProvider } from "../open-finance/provider";

export async function conectarBanco(input: {
  bancoNome: string;
  frequenciaSync: "manual" | "diaria" | "semanal" | "mensal";
}) {
  const user = await requireUser();
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      "Nenhum provider Open Finance configurado. Use Importação manual por enquanto.",
    );
  }
  const link = await provider.iniciarConsentimento({
    userId: user.id,
    bancoNome: input.bancoNome,
    permissoes: ["contas", "extrato", "cartoes", "investimentos"],
    redirectUrl: "/bancos-conectados",
  });
  await prisma.bankConnection.create({
    data: {
      userId: user.id,
      provider: provider.name,
      providerItemId: link.externalId ?? null,
      bancoNome: input.bancoNome,
      status: "desconectado",
      frequenciaSync: input.frequenciaSync,
      observacoes: `Link: ${link.url}`,
    },
  });
  revalidatePath("/bancos-conectados");
  return link.url;
}

export async function desconectarBanco(id: string) {
  const user = await requireUser();
  const conn = await prisma.bankConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!conn) throw new Error("Conexão não encontrada");
  const provider = getProvider();
  if (provider && conn.providerItemId) {
    try {
      await provider.revogarConsentimento(conn.providerItemId);
    } catch {
      // ignora — manteremos o registro pra histórico
    }
  }
  await prisma.bankConnection.update({
    where: { id },
    data: { status: "desconectado" },
  });
  revalidatePath("/bancos-conectados");
}

export async function excluirConexao(id: string) {
  const user = await requireUser();
  const own = await prisma.bankConnection.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!own) throw new Error("Conexão não encontrada");
  await prisma.bankConnection.delete({ where: { id } });
  revalidatePath("/bancos-conectados");
}

export async function sincronizarAgora(id: string) {
  const user = await requireUser();
  const conn = await prisma.bankConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!conn) throw new Error("Conexão não encontrada");
  const provider = getProvider();
  if (!provider) {
    throw new Error("Nenhum provider Open Finance ativo");
  }
  // Estrutura preparada: log + sync. Quando provider real existir, expandir.
  const log = await prisma.syncLog.create({
    data: {
      userId: user.id,
      connectionId: conn.id,
      tipo: "tudo",
      status: "sucesso",
      mensagem: "Sincronização placeholder — integre um provider para uso real",
    },
  });
  await prisma.bankConnection.update({
    where: { id },
    data: { ultimaSincronizacao: new Date() },
  });
  revalidatePath("/bancos-conectados");
  return log.id;
}
