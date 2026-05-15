/**
 * Detector heurístico de banco a partir do conteúdo bruto de um CSV.
 * Roda apenas com a primeira linha (cabeçalho) e algumas linhas iniciais.
 *
 * Retorna o nome do banco identificado + confiança (0-1).
 * Se não bater nenhum, devolve null.
 */

export interface DeteccaoBanco {
  banco: string;
  confianca: number;
  pistas: string[];
}

interface Perfil {
  banco: string;
  /** Tokens (case-insensitive) procurados no cabeçalho ou nas primeiras linhas */
  tokens: string[];
  /** Caracteres de cabeçalho que tipicamente esse banco usa */
  colunasEsperadas?: string[];
  pesoMinimo?: number;
}

const PERFIS: Perfil[] = [
  {
    banco: "Nubank",
    tokens: ["nubank", "identificador", "nu pagamentos"],
    colunasEsperadas: ["data", "valor", "identificador", "descrição"],
  },
  {
    banco: "Itaú",
    tokens: ["itau", "itaú", "extrato itau"],
    colunasEsperadas: ["data", "lançamento", "valor", "saldo"],
  },
  {
    banco: "Bradesco",
    tokens: ["bradesco", "histórico", "extrato bradesco"],
    colunasEsperadas: ["data", "histórico", "valor", "saldo"],
  },
  {
    banco: "Santander",
    tokens: ["santander", "santander brasil"],
    colunasEsperadas: ["data", "histórico", "valor"],
  },
  {
    banco: "Banco do Brasil",
    tokens: ["banco do brasil", "bb extrato", "banco brasil"],
    colunasEsperadas: ["data", "histórico", "documento", "valor"],
  },
  {
    banco: "Caixa",
    tokens: ["caixa econômica", "cef ", "caixa economica"],
    colunasEsperadas: ["data", "histórico", "valor"],
  },
  {
    banco: "Inter",
    tokens: ["banco inter", "inter extrato"],
    colunasEsperadas: ["data", "histórico", "valor"],
  },
  {
    banco: "C6 Bank",
    tokens: ["c6 bank", "c6bank"],
    colunasEsperadas: ["data", "descrição", "valor"],
  },
  {
    banco: "Mercado Pago",
    tokens: [
      "mercado pago",
      "mercadopago",
      "detalhe da operação",
      "id da operação",
      "id_operacao",
    ],
    colunasEsperadas: ["data", "descrição", "valor"],
  },
  {
    banco: "PagSeguro",
    tokens: ["pagseguro", "pagbank", "uol pagseguro"],
    colunasEsperadas: ["data", "descrição", "valor"],
  },
  {
    banco: "Will Bank",
    tokens: ["will bank", "willbank"],
  },
  {
    banco: "Neon",
    tokens: ["banco neon", "neon pagamentos"],
  },
  {
    banco: "Sicredi",
    tokens: ["sicredi"],
  },
  {
    banco: "Sicoob",
    tokens: [
      "sicoob",
      "facilcred",
      "rentab.invest facilcred",
      "transf.autoriz.entre c/c",
      "transf autoriz entre ags",
    ],
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

export function detectarBanco(csv: string): DeteccaoBanco | null {
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return null;

  // Pega cabeçalho + 5 primeiras linhas pra análise
  const amostra = normalizar(linhas.slice(0, 6).join(" | "));

  let melhor: DeteccaoBanco | null = null;

  for (const p of PERFIS) {
    const pistas: string[] = [];
    let pontos = 0;

    for (const tok of p.tokens) {
      if (amostra.includes(normalizar(tok))) {
        pontos += 2;
        pistas.push(tok);
      }
    }

    if (p.colunasEsperadas) {
      let bateColunas = 0;
      for (const col of p.colunasEsperadas) {
        if (amostra.includes(normalizar(col))) bateColunas++;
      }
      // Bate metade das colunas → +1 ponto
      if (bateColunas >= Math.ceil(p.colunasEsperadas.length / 2)) {
        pontos += 1;
        pistas.push(`colunas:${bateColunas}/${p.colunasEsperadas.length}`);
      }
    }

    if (pontos === 0) continue;

    // Confiança: até 3 pontos = média, 4+ = alta
    const confianca = Math.min(1, pontos / 4);

    if (!melhor || confianca > melhor.confianca) {
      melhor = { banco: p.banco, confianca, pistas };
    }
  }

  // Só devolve se confiança >= 0.5 (palavra-chave forte OU colunas + algum token)
  if (melhor && melhor.confianca >= 0.4) return melhor;
  return null;
}

/**
 * Encontra a melhor conta do usuário pra vincular a um banco detectado.
 * Compara o campo `banco` da conta (case-insensitive contains).
 */
export function escolherContaPorBanco<T extends { id: string; nome: string; banco: string | null }>(
  contas: T[],
  bancoDetectado: string,
): T | null {
  if (!bancoDetectado) return null;
  const banco = normalizar(bancoDetectado);
  // Match exato no campo banco
  let match = contas.find((c) => c.banco && normalizar(c.banco) === banco);
  if (match) return match;
  // Match parcial (banco contains nome ou vice-versa)
  match = contas.find((c) => {
    if (!c.banco) return false;
    const b = normalizar(c.banco);
    return b.includes(banco) || banco.includes(b);
  });
  if (match) return match;
  // Match pelo nome da conta
  match = contas.find((c) => normalizar(c.nome).includes(banco));
  return match ?? null;
}
