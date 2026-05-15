import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({ email: z.string().email() });

const RESET_TOKEN_TTL_MS = 1000 * 60 * 30; // 30 minutos

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: true }); // não vaza info
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    // Mesmo se o usuário não existir, devolve ok pra não vazar emails cadastrados.
    if (!user) return NextResponse.json({ ok: true });

    // Limpa tokens antigos não usados
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    });

    const tokenRaw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(tokenRaw)
      .digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const host = req.headers.get("host") ?? "localhost:3000";
    const resetUrl = `${proto}://${host}/redefinir-senha?token=${tokenRaw}`;

    // Em produção: integrar com Resend / SMTP aqui.
    // Por enquanto: log no servidor + retorna no body em dev.
    console.log("\n[VIAFINANCE] Link de recuperação de senha:");
    console.log(`  ${resetUrl}\n  (expira em 30 minutos)\n`);

    const devReveal = process.env.NODE_ENV !== "production";

    return NextResponse.json({
      ok: true,
      ...(devReveal ? { resetUrl } : {}),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: true });
  }
}
