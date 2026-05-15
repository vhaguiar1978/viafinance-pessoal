import { prisma } from "@/lib/prisma";

/**
 * Regras padrão do sistema — mapeiam palavras-chave para nomes de categoria.
 * Quando o usuário tem uma categoria com o mesmo nome (case-insensitive), usa.
 * Spec item 20.
 */
const REGRAS_PADRAO: { padroes: string[]; categoriaNome: string }[] = [
  // Alimentação / delivery
  {
    padroes: ["ifood", "i food", "rappi", "uber eats", "ubereats", "deliveroo"],
    categoriaNome: "Alimentação",
  },
  {
    padroes: [
      "mercado",
      "supermerc",
      "atacad",
      "carrefour",
      "extra",
      "pao de acu",
      "pão de açu",
      "assai",
      "dia ",
      "padaria",
      "açougue",
      "hortif",
    ],
    categoriaNome: "Alimentação",
  },
  // Transporte
  {
    padroes: [
      "uber",
      "99 taxi",
      "99taxi",
      "99 pop",
      "99pop",
      "cabify",
      "passagem",
      "metro",
      "metrô",
      "trem",
      "onibus",
      "ônibus",
      "estaciona",
      "pedagio",
      "pedágio",
      "sem parar",
    ],
    categoriaNome: "Transporte",
  },
  {
    padroes: ["shell", "ipiranga", "petrobras", "ale combu", "posto", "combustivel", "combustível", "gasolina", "etanol", "diesel"],
    categoriaNome: "Transporte",
  },
  // Saúde
  {
    padroes: ["farmacia", "farmácia", "drogasil", "droga raia", "droga raia", "drogaria", "panvel"],
    categoriaNome: "Saúde",
  },
  {
    padroes: ["hospital", "clinica", "clínica", "consulta", "exame", "laborat", "amil", "unimed"],
    categoriaNome: "Saúde",
  },
  // Assinaturas
  {
    padroes: [
      "netflix",
      "spotify",
      "amazon prime",
      "prime video",
      "disney+",
      "disney plus",
      "hbo max",
      "globoplay",
      "deezer",
      "youtube premium",
      "apple music",
      "icloud",
      "google one",
      "microsoft 365",
      "office 365",
    ],
    categoriaNome: "Assinaturas",
  },
  // Moradia
  {
    padroes: ["sabesp", "agua ", "água "],
    categoriaNome: "Moradia",
  },
  {
    padroes: ["enel", "cpfl", "eletropaulo", "light s/a", "energia eletrica", "energia elétrica", "luz "],
    categoriaNome: "Moradia",
  },
  {
    padroes: ["comgas", "comgás", "gas natural", "gás natural", "ultragaz"],
    categoriaNome: "Moradia",
  },
  {
    padroes: ["aluguel", "condom", "condomínio"],
    categoriaNome: "Moradia",
  },
  // Educação
  {
    padroes: ["escola", "faculdade", "universidade", "udemy", "curso", "alura", "rocketseat", "coursera"],
    categoriaNome: "Educação",
  },
  // Lazer
  {
    padroes: ["cinema", "ingresso", "show", "teatro", "park", "parque", "viagem"],
    categoriaNome: "Lazer",
  },
  // Receita
  {
    padroes: ["salario", "salário", "pagamento", "remunera"],
    categoriaNome: "Salário",
  },
];

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sugere uma categoria para a descrição informada. Considera:
 * 1. Regras aprendidas pelo usuário (CategoryRule) — mais peso
 * 2. Regras padrão do sistema (REGRAS_PADRAO)
 */
export async function sugerirCategoria(
  userId: string,
  descricao: string,
  tipoEsperado?: "despesa" | "receita",
): Promise<string | null> {
  if (!descricao) return null;
  const desc = normalizar(descricao);

  // 1) Regras do usuário (case-insensitive contains, ordenadas por peso desc)
  const rules = await prisma.categoryRule.findMany({
    where: { userId },
    include: { categoria: true },
    orderBy: { peso: "desc" },
  });
  for (const r of rules) {
    const padrao = normalizar(r.padrao);
    if (padrao && desc.includes(padrao)) {
      if (tipoEsperado && r.categoria.tipo !== tipoEsperado) continue;
      return r.categoriaId;
    }
  }

  // 2) Regras padrão — buscar categoria do usuário com nome correspondente
  const categorias = await prisma.categoria.findMany({
    where: { userId },
  });
  for (const regra of REGRAS_PADRAO) {
    for (const p of regra.padroes) {
      if (desc.includes(normalizar(p))) {
        const cat = categorias.find(
          (c) =>
            normalizar(c.nome) === normalizar(regra.categoriaNome) &&
            (!tipoEsperado || c.tipo === tipoEsperado),
        );
        if (cat) return cat.id;
      }
    }
  }
  return null;
}

/**
 * Aprende: quando o usuário escolheu uma categoria para uma descrição, criamos
 * (ou reforçamos) uma regra. Usamos como "padrão" a primeira palavra
 * significativa da descrição (pra não armazenar a descrição inteira).
 */
export async function aprenderCategoria(
  userId: string,
  descricao: string,
  categoriaId: string,
): Promise<void> {
  if (!descricao || !categoriaId) return;
  const palavras = normalizar(descricao)
    .split(" ")
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
    .slice(0, 2);
  if (palavras.length === 0) return;
  const padrao = palavras.join(" ");

  try {
    await prisma.categoryRule.upsert({
      where: { userId_padrao: { userId, padrao } },
      create: {
        userId,
        padrao,
        categoriaId,
        peso: 2,
        origem: "usuario",
      },
      update: {
        categoriaId,
        peso: { increment: 1 },
      },
    });
  } catch {
    // ignora — categoryId pode não existir mais
  }
}
