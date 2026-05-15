import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sugerirCategoria } from "@/server/categorization";

const schema = z.object({
  descricao: z.string(),
  tipo: z.enum(["despesa", "receita"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ categoriaId: null });
  }
  const categoriaId = await sugerirCategoria(
    session.user.id,
    parsed.data.descricao,
    parsed.data.tipo,
  );
  return NextResponse.json({ categoriaId });
}
