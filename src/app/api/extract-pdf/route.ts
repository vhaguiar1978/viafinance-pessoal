import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processarPDF, rowsParaCSV } from "@/server/pdf-parser";
import { detectarBanco, escolherContaPorBanco } from "@/server/bank-detector";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let buffer: Buffer;
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Arquivo muito grande (máximo 10MB)" },
        { status: 400 },
      );
    }
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Erro ao ler arquivo" }, { status: 400 });
  }

  try {
    const { texto, rows } = await processarPDF(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Não consegui extrair transações deste PDF. Pode ser um PDF escaneado (imagem) ou um layout não suportado. Tente exportar em CSV ou OFX.",
          tamanhoTexto: texto.length,
        },
        { status: 422 },
      );
    }

    const csv = rowsParaCSV(rows);

    // Detecta banco no texto
    const det = detectarBanco(texto);

    let contaSugerida: { id: string; nome: string } | null = null;
    if (det) {
      const contas = await prisma.conta.findMany({
        where: { userId: session.user.id, ativa: true },
        select: { id: true, nome: true, banco: true },
      });
      const c = escolherContaPorBanco(contas, det.banco);
      if (c) contaSugerida = { id: c.id, nome: c.nome };
    }

    return NextResponse.json({
      csv,
      totalLinhas: rows.length,
      banco: det?.banco ?? null,
      confianca: det?.confianca ?? 0,
      contaSugeridaId: contaSugerida?.id ?? null,
      contaSugeridaNome: contaSugerida?.nome ?? null,
    });
  } catch (err) {
    console.error("Erro ao processar PDF:", err);
    return NextResponse.json(
      {
        error:
          "Falha ao ler o PDF. Verifique se não é um PDF protegido por senha ou escaneado.",
      },
      { status: 500 },
    );
  }
}
