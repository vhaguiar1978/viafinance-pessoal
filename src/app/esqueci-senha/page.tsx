"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet } from "lucide-react";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      setSent(true);
      if (j?.resetUrl) setDevLink(j.resetUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="mb-6 flex items-center gap-2">
        <div className="rounded-lg bg-primary p-2 text-primary-foreground">
          <Wallet className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ViaFinance</h1>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            Informe seu email e enviaremos um link para redefinir
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-success/10 px-3 py-2 text-success">
                Se o email existir, um link de recuperação foi gerado.
              </div>
              {devLink && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Link (modo desenvolvimento):
                  </div>
                  <a
                    href={devLink}
                    className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs text-primary underline-offset-2 hover:underline"
                  >
                    {devLink}
                  </a>
                </div>
              )}
              <Link
                href="/login"
                className="block text-center text-sm text-primary hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <Link
                href="/login"
                className="block text-center text-sm text-muted-foreground hover:underline"
              >
                Voltar
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
