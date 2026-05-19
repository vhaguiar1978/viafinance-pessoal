import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  gerarRelatorio,
  gerarCSV,
  type FiltroAvancado,
  type TipoRelatorio,
} from "@/server/relatorios";

function parseDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") as TipoRelatorio;
  const mes = Number(searchParams.get("mes")) || new Date().getMonth() + 1;
  const ano = Number(searchParams.get("ano")) || new Date().getFullYear();
  const formato = (searchParams.get("formato") ?? "csv").toLowerCase();

  const inicio = parseDate(searchParams.get("inicio"));
  const fimRaw = parseDate(searchParams.get("fim"));
  // Garante que `fim` cubra o dia inteiro
  const fim = fimRaw
    ? new Date(
        fimRaw.getFullYear(),
        fimRaw.getMonth(),
        fimRaw.getDate(),
        23,
        59,
        59,
        999,
      )
    : undefined;
  const categoriaIdsRaw = searchParams.getAll("categoriaId");
  const categoriaIds = categoriaIdsRaw.length > 0 ? categoriaIdsRaw : undefined;
  const busca = searchParams.get("busca") || undefined;

  const filtro: FiltroAvancado | undefined =
    inicio || fim || categoriaIds || busca
      ? { inicio, fim, categoriaIds, busca }
      : undefined;

  if (!tipo) {
    return NextResponse.json({ error: "Tipo obrigatório" }, { status: 400 });
  }

  const rel = await gerarRelatorio(session.user.id, tipo, mes, ano, filtro);
  const filename = `${rel.titulo.replace(/[^a-zA-Z0-9]+/g, "-")}.csv`;

  if (formato === "csv") {
    const csv = gerarCSV(rel);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json(rel);
}
