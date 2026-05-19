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
 * Prefixos genéricos de operação bancária que não devem entrar na regra
 * — eles aparecem em quase toda transação e não identificam o destinatário.
 */
const PREFIXOS_OPERACAO: RegExp[] = [
  /^(qr code\s+)?pix\s+(enviado|recebido|transf(er[êe]ncia)?)\s*[-–]?\s*/i,
  /^pix\s+transf\.?\s*/i,
  /^ted\s*[-–]?\s*/i,
  /^doc\s*[-–]?\s*/i,
  /^cart[ãa]o\s+(de\s+)?(d[ée]bito|cr[ée]dito)\s*[-–]?\s*/i,
  /^compra\s+(com\s+)?cart[ãa]o\s*[-–]?\s*/i,
  /^dep(\.|osito)?\s+(din(heiro)?\s+)?atm\s*[-–]?\s*/i,
  /^transf(er[êe]ncia)?\.?\s*(autoriz(ada)?\.?)?\s*(entre\s+c\/c)?\s*[-–]?\s*/i,
  /^saque\s*[-–]?\s*/i,
  /^compra\s*[-–]?\s*/i,
  /^pagamento\s+(de\s+)?(boleto|conta)?\s*[-–]?\s*/i,
];

/**
 * Extrai o padrão mais distintivo de uma descrição pra servir de regra de
 * categorização. Estratégia:
 *   1. Remove prefixos comuns de operação ("QR Code Pix enviado - ...", etc.)
 *   2. Remove datas/números no final
 *   3. Pega o segmento mais longo entre traços (geralmente o nome do
 *      destinatário/estabelecimento)
 *   4. Limita a 60 chars
 */
function extrairPadrao(descricao: string): string | null {
  let s = descricao.trim();
  // 1) Remove prefixos de operação
  for (const r of PREFIXOS_OPERACAO) s = s.replace(r, "");
  // 2) Remove datas no fim (DD/MM, DD/MM/YYYY, etc.)
  s = s.replace(/\s+\d{1,2}[/\-]\d{1,2}([/\-]\d{2,4})?\s*$/, "");
  // 3) Remove pontuação solta no começo
  s = s.replace(/^[\s\-–:|]+/, "").trim();
  if (s.length < 3) return null;
  // 4) Quebra por traços e fica com o segmento mais longo
  const partes = s.split(/\s*[-–]\s+/).map((p) => p.trim()).filter((p) => p.length >= 3);
  let melhor = s;
  if (partes.length > 0) {
    melhor = partes.reduce((a, b) => (b.length > a.length ? b : a), partes[0]);
  }
  // 5) Limita tamanho razoável (rule.padrao tem que caber em índices)
  melhor = melhor.slice(0, 60).trim();
  if (melhor.length < 3) return null;
  return melhor;
}

/**
 * Aprende: quando o usuário escolheu uma categoria para uma descrição, cria
 * (ou reforça) uma CategoryRule que vai categorizar transações futuras com
 * descrição parecida — incluindo importações.
 *
 * O padrão salvo é o trecho mais distintivo da descrição (geralmente o nome
 * do destinatário/estabelecimento). Reforço aumenta o peso da regra.
 */
export async function aprenderCategoria(
  userId: string,
  descricao: string,
  categoriaId: string,
): Promise<void> {
  if (!descricao || !categoriaId) return;
  const padraoBruto = extrairPadrao(descricao);
  if (!padraoBruto) return;
  const padrao = normalizar(padraoBruto);
  if (padrao.length < 3) return;

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
