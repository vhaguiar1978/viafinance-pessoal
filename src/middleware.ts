import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/api/auth",
  "/api/register",
  "/api/password-reset",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (req.auth && (pathname === "/login" || pathname === "/cadastro")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(req.auth ? "/dashboard" : "/login", req.url),
    );
  }

  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Exclui /api/auth/* (NextAuth roda seu próprio handler — invocá-lo no
  // middleware causa cookies duplicados e callback-url errado em proxies/tunnels).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
