import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Confia no header X-Forwarded-Host — necessário pra tunnels, proxies, Vercel etc.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    /**
     * Sempre retorna URLs RELATIVAS pra forçar Auth.js a usar o host atual
     * da requisição (resolve problema de redirect pra localhost quando atrás
     * de tunnels/proxies como serveo/cloudflared/Vercel).
     */
    async redirect({ url, baseUrl }) {
      // URL já é relativa → ok
      if (url.startsWith("/")) return url;
      // URL absoluta do mesmo host → extrai caminho
      try {
        const u = new URL(url);
        const b = new URL(baseUrl);
        if (u.origin === b.origin) return u.pathname + u.search;
      } catch {
        /* ignora */
      }
      // Fallback: dashboard relativo
      return "/dashboard";
    },
  },
});
