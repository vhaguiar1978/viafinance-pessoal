import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  gerarRelatorio,
  gerarCSV,
  type TipoRelatorio,
} from "@/server/relatorios";

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

  if (!tipo) {
    return NextResponse.json({ error: "Tipo obrigatório" }, { status: 400 });
  }

  const rel = await gerarRelatorio(session.user.id, tipo, mes, ano);
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
