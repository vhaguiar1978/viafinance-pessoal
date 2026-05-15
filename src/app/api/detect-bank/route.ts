import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectarBanco, escolherContaPorBanco } from "@/server/bank-detector";

const schema = z.object({
  csv: z.string().min(1).max(100_000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ detectado: null });
  }

  const det = detectarBanco(parsed.data.csv);
  if (!det) return NextResponse.json({ detectado: null });

  const contas = await prisma.conta.findMany({
    where: { userId: session.user.id, ativa: true },
    select: { id: true, nome: true, banco: true },
  });
  const contaSugerida = escolherContaPorBanco(contas, det.banco);

  return NextResponse.json({
    detectado: {
      banco: det.banco,
      confianca: det.confianca,
      pistas: det.pistas,
      contaSugeridaId: contaSugerida?.id ?? null,
      contaSugeridaNome: contaSugerida?.nome ?? null,
    },
  });
}
