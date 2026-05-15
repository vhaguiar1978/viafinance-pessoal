/**
 * Parser de CSV genérico para extratos bancários brasileiros.
 *
 * Suporta:
 *  - Separadores: , ; \t
 *  - Datas: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY
 *  - Valores: 1.234,56 ou 1234.56 ou -200,00
 *  - Coluna de tipo opcional: "C/D", "Entrada/Saída", "Crédito/Débito"
 *  - Detecção automática de colunas: data, descrição/histórico, valor, tipo
 *
 * Não tenta encaixar todo banco, mas cobre Nubank/Itaú/Bradesco/Santander/genérico.
 */

export interface ParsedRow {
  data: Date;
  descricao: string;
  valor: number; // sempre positivo
  tipo: "despesa" | "receita";
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedRow[];
  totalLinhas: number;
  erros: string[];
}

function detectarSeparador(linha: string): string {
  const counts = {
    ",": (linha.match(/,/g) ?? []).length,
    ";": (linha.match(/;/g) ?? []).length,
    "\t": (linha.match(/\t/g) ?? []).length,
  };
  const max = Math.max(counts[","], counts[";"], counts["\t"]);
  if (max === 0) return ",";
  if (counts["\t"] === max) return "\t";
  if (counts[";"] === max) return ";";
  return ",";
}

function parseLinhaCSV(linha: string, sep: string): string[] {
  // Suporta valores com aspas que contém o separador
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (inQuote && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (c === sep && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  // YYYY-MM-DD
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  // DD/MM/YYYY or DD-MM-YYYY
  m = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // ISO completo
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function parseValor(s: string): number {
  if (!s) return 0;
  let t = s.trim().replace(/R\$/gi, "").replace(/\s+/g, "");
  const neg = t.startsWith("-") || /\(.*\)/.test(t);
  t = t.replace(/[()\-+]/g, "");

  if (t.includes(",") && t.includes(".")) {
    // 1.234,56 ou 1,234.56 — assumimos pt-BR (vírgula decimal) se vírgula vier por último
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      t = t.replace(/,/g, "");
    }
  } else if (t.includes(",")) {
    t = t.replace(",", ".");
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

const ALIAS_DATA = ["data", "date", "dt", "data lanc", "data lancamento"];
const ALIAS_DESC = [
  "descricao",
  "descrição",
  "description",
  "historico",
  "histórico",
  "memo",
  "details",
  "title",
  "lançamento",
  "lancamento",
];
const ALIAS_VALOR = ["valor", "amount", "value", "montante", "qtde", "qty"];
const ALIAS_TIPO = ["tipo", "c/d", "type", "credito/debito"];
// Bancos brasileiros frequentemente separam crédito/débito em colunas distintas.
const ALIAS_CREDITO = [
  "credito",
  "crédito",
  "credit",
  "entrada",
  "credit (r$)",
  "credito (r$)",
];
const ALIAS_DEBITO = [
  "debito",
  "débito",
  "debit",
  "saida",
  "saída",
  "debit (r$)",
  "debito (r$)",
];
const ALIAS_SALDO = ["saldo", "balance"];

/**
 * Linhas de rodapé que indicam fim das movimentações úteis. Quando uma dessas
 * frases aparece, paramos de processar pra evitar lixo (resumos, totalizadores,
 * informações de filtro etc.).
 */
const PADROES_RODAPE = [
  "filtro de resultados",
  "últimos lan",
  "ultimos lan",
  "saldo final",
  "saldo anterior",
  "saldo inicial",
  "total dos lan",
  "movimentação entre",
  "movimentacao entre",
  "os dados acima",
];

function acharCol(headers: string[], aliases: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  for (let i = 0; i < norm.length; i++) {
    if (aliases.some((a) => norm[i].includes(a))) return i;
  }
  return -1;
}

function ehRodape(linha: string): boolean {
  const t = linha.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return PADROES_RODAPE.some((p) => t.includes(p));
}

export function parseCSV(text: string): ParseResult {
  const erros: string[] = [];
  // Normaliza quebras de linha + remove BOM
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const linhas = clean.split("\n").filter((l) => l.trim().length > 0);
  if (linhas.length === 0) {
    return { rows: [], totalLinhas: 0, erros: ["Arquivo vazio"] };
  }
  const sep = detectarSeparador(linhas[0]);
  const headers = parseLinhaCSV(linhas[0], sep);

  const idxData = acharCol(headers, ALIAS_DATA);
  const idxDesc = acharCol(headers, ALIAS_DESC);
  const idxVal = acharCol(headers, ALIAS_VALOR);
  const idxTipo = acharCol(headers, ALIAS_TIPO);
  const idxCredito = acharCol(headers, ALIAS_CREDITO);
  const idxDebito = acharCol(headers, ALIAS_DEBITO);
  const idxSaldo = acharCol(headers, ALIAS_SALDO);

  // Modo "Crédito/Débito separados" — comum em Sicoob, BB, Caixa, Bradesco etc.
  // Nesse modo a coluna "valor" geralmente é o SALDO acumulado e deve ser ignorada.
  const modoCreditoDebito = idxCredito >= 0 && idxDebito >= 0;

  if (idxData < 0 || idxDesc < 0) {
    return {
      rows: [],
      totalLinhas: 0,
      erros: [
        `Não consegui identificar as colunas. Esperado: data e descrição/histórico. Encontrado: ${headers.join(" | ")}`,
      ],
    };
  }

  if (!modoCreditoDebito && idxVal < 0) {
    return {
      rows: [],
      totalLinhas: 0,
      erros: [
        `Não consegui identificar a coluna de valor (ou Crédito/Débito separados). Cabeçalho: ${headers.join(" | ")}`,
      ],
    };
  }

  const rows: ParsedRow[] = [];
  let totalLinhas = 0;
  for (let i = 1; i < linhas.length; i++) {
    const linhaRaw = linhas[i];

    // Para a quebra quando encontramos rodapé (sumário, totalizador, "Últimos lançamentos" etc.)
    if (ehRodape(linhaRaw)) break;

    const campos = parseLinhaCSV(linhaRaw, sep);
    if (campos.length < idxData + 1) continue;

    const data = parseDate(campos[idxData] ?? "");
    if (!data) continue; // linha sem data válida → pula (cabeçalho duplicado, separador, etc.)

    const descricao = (campos[idxDesc] ?? "").trim();
    if (!descricao) continue;

    let valor = 0;
    let tipo: "despesa" | "receita" = "despesa";

    if (modoCreditoDebito) {
      const cred = parseValor(campos[idxCredito] ?? "");
      const debit = parseValor(campos[idxDebito] ?? "");
      if (Math.abs(cred) > 0) {
        valor = Math.abs(cred);
        tipo = "receita";
      } else if (Math.abs(debit) > 0) {
        valor = Math.abs(debit);
        tipo = "despesa";
      } else {
        continue; // linha de saldo inicial ou "COD. LANC. 0" sem valor → pula
      }
    } else {
      const valorRaw = parseValor(campos[idxVal] ?? "");
      if (valorRaw === 0) continue;
      valor = Math.abs(valorRaw);
      tipo = valorRaw < 0 ? "despesa" : "receita";
      if (idxTipo >= 0) {
        const t = (campos[idxTipo] ?? "").toLowerCase();
        if (/^(c|cr|credito|crédito|entrada|receita)/.test(t)) tipo = "receita";
        if (/^(d|db|debito|débito|saida|saída|despesa)/.test(t)) tipo = "despesa";
      }
    }

    const raw: Record<string, string> = {};
    headers.forEach((h, j) => {
      raw[h] = campos[j] ?? "";
    });

    rows.push({ data, descricao, valor, tipo, raw });
    totalLinhas++;
  }

  void idxSaldo;

  return { rows, totalLinhas, erros };
}
