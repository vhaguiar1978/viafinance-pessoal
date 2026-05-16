import type { NextAuthConfig } from "next-auth";

export default {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
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
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return url;
      try {
        const u = new URL(url);
        const b = new URL(baseUrl);
        if (u.origin === b.origin) return u.pathname + u.search;
      } catch {
        /* ignora */
      }
      return "/dashboard";
    },
  },
} satisfies NextAuthConfig;
