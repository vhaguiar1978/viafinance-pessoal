import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViaFinance Pessoal",
    short_name: "ViaFinance",
    description: "Seu controle financeiro pessoal — moderno, simples e completo",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0a0a0a",
    theme_color: "#10b981",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Novo lançamento",
        short_name: "Lançar",
        description: "Registrar uma despesa ou receita",
        url: "/lancamentos?novo=1",
      },
      {
        name: "Demonstrativo",
        short_name: "Mês",
        description: "Ver o mês atual",
        url: "/demonstrativo",
      },
      {
        name: "Cartões",
        short_name: "Cartões",
        description: "Faturas e limites",
        url: "/cartoes",
      },
    ],
  };
}
