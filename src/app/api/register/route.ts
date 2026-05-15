import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres"),
});

const CATEGORIAS_PADRAO_DESPESA = [
  { nome: "Moradia", cor: "#0ea5e9", icone: "Home" },
  { nome: "Alimentação", cor: "#f97316", icone: "UtensilsCrossed" },
  { nome: "Transporte", cor: "#facc15", icone: "Car" },
  { nome: "Saúde", cor: "#ef4444", icone: "HeartPulse" },
  { nome: "Lazer", cor: "#a855f7", icone: "PartyPopper" },
  { nome: "Educação", cor: "#22c55e", icone: "BookOpen" },
  { nome: "Assinaturas", cor: "#8b5cf6", icone: "Repeat" },
  { nome: "Outros", cor: "#94a3b8", icone: "MoreHorizontal" },
];

const CATEGORIAS_PADRAO_RECEITA = [
  { nome: "Salário", cor: "#10b981", icone: "Wallet" },
  { nome: "Freelance", cor: "#06b6d4", icone: "Briefcase" },
  { nome: "Rendimentos", cor: "#84cc16", icone: "TrendingUp" },
  { nome: "Outros", cor: "#94a3b8", icone: "MoreHorizontal" },
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 },
      );
    }

    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma conta com esse email" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        categorias: {
          create: [
            ...CATEGORIAS_PADRAO_DESPESA.map((c) => ({ ...c, tipo: "despesa" })),
            ...CATEGORIAS_PADRAO_RECEITA.map((c) => ({ ...c, tipo: "receita" })),
          ],
        },
        contas: {
          create: [
            { nome: "Conta principal", tipo: "corrente", cor: "#10b981" },
          ],
        },
      },
    });

    return NextResponse.json({ id: user.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao criar conta" },
      { status: 500 },
    );
  }
}
