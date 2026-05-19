/**
 * Parser heurístico de extratos bancários em PDF.
 *
 * Extrai texto via `pdf-parse` e tenta achar linhas com padrão:
 *   DATA  DESCRIÇÃO  VALOR
 *
 * Funciona bem com PDFs de texto (Nubank, Itaú, Bradesco, Santander, Caixa, BB,
 * Inter, C6, Sicoob, Mercado Pago, PagSeguro etc). NÃO funciona com PDFs
 * escaneados (imagem), que exigem OCR.
 */

export interface ParsedPDFRow {
  data: Date;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
}

export interface PDFParseResult {
  texto: string;
  rows: ParsedPDFRow[];
  bancoDetectado?: string;
}

const MESES_PT: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

function parseDataPDF(s: string): Date | null {
  const t = s.trim().toLowerCase();
  // DD/MM/YYYY ou DD-MM-YYYY
  let m = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/);
  if (m) {
    let y = parseInt(m[3]);
    if (y < 100) y += 2000;
    return new Date(y, parseInt(m[2]) - 1, parseInt(m[1]));
  }
  // DD MMM YYYY (ex: 01 dez 2025)
  m = t.match(/^(\d{1,2})\s+([a-zç]{3,})\s+(\d{2,4})/i);
  if (m) {
    const mes = MESES_PT[m[2].slice(0, 3).toLowerCase()];
    if (mes) {
      let y = parseInt(m[3]);
      if (y < 100) y += 2000;
      return new Date(y, mes - 1, parseInt(m[1]));
    }
  }
  // YYYY-MM-DD
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return null;
}

function parseValorPDF(s: string): number | null {
  if (!s) return null;
  let t = s.trim();
  // remove R$
  t = t.replace(/R\$/gi, "").trim();
  // detecta sinal de débito/crédito por sufixo (D, C, -, +)
  let sinal = 1;
  if (/(^-|-$|\bD\b|debito|débito)/i.test(t) && !/\+/.test(t)) sinal = -1;
  if (/^\+/.test(t) || /\bC\b/i.test(t)) sinal = 1;
  // Remove letras sufixadas (D, C)
  t = t.replace(/\s*[CD]\s*$/i, "");
  // Remove +/-
  t = t.replace(/^[+\-]/, "").replace(/[+\-]$/, "").replace(/[()]/g, "").trim();
  // Mantém apenas dígitos, vírgula e ponto
  t = t.replace(/[^\d.,]/g, "");
  if (!t) return null;

  if (t.includes(",") && t.includes(".")) {
    if (t.lastIndexOf(",") > t.lastIndexOf(".")) {
      // formato pt-BR: 1.234,56
      t = t.replace(/\./g, "").replace(",", ".");
    } else {
      // formato en-US: 1,234.56
      t = t.replace(/,/g, "");
    }
  } else if (t.includes(",")) {
    t = t.replace(",", ".");
  }

  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return sinal * n;
}

const REGEX_LINHA_GENERICA =
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+[a-zç]{3,9}\s+\d{2,4})\s+(.+?)\s+([+\-]?R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?:\s?[CD])?)\s*$/im;

// Limite máximo razoável pra descrição de uma transação. Linhas/grupos que
// excedam isso indicam que a regex casou o texto inteiro do extrato como uma
// única "transação" (caso típico de PDFs com layout contínuo onde todas as
// movimentações vêm em uma linha só).
const MAX_DESC_LEN = 180;

// Detecta se uma linha tem múltiplas ocorrências de data — indício de que o
// PDF não tem quebras entre transações (PagSeguro, alguns layouts do Inter etc.)
const REGEX_DATA_GLOBAL =
  /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+[a-zç]{3,9}\s+\d{2,4})/gi;

// Extrai "DATA DESCRICAO VALOR" de um trecho que já está delimitado (de uma
// data até a próxima). Não usa âncoras de fim de linha — assume que o caller
// já picotou em chunks corretos.
const REGEX_CHUNK =
  /^\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+[a-zç]{3,9}\s+\d{2,4})\s+(.+?)\s+([+\-]?R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?:\s?[CD])?)\s*$/i;

function descricaoEhRuim(desc: string): boolean {
  if (desc.length < 2 || desc.length > MAX_DESC_LEN) return true;
  if (/^(total|saldo|periodo|período|descrição|descricao)/i.test(desc)) return true;
  return false;
}

/**
 * Extrai linhas em formato "DATA DESCRIÇÃO VALOR" do texto bruto.
 *
 * Três estratégias, em ordem:
 *   1) Linha-por-linha — funciona quando cada transação está em sua própria
 *      linha do texto extraído (Nubank, Itaú, Bradesco, etc.).
 *   2) Split por datas — quando o extractor de texto colocou várias
 *      transações na mesma linha (PagSeguro, alguns Inter). Picota o texto
 *      pelos pontos onde há uma data e processa cada pedaço como um chunk.
 *   3) Regex global no texto compactado — fallback final pra layouts em coluna
 *      onde a quebra natural se perde.
 *
 * Linhas/chunks cuja descrição passe de MAX_DESC_LEN são descartadas, pra
 * evitar que a regex grude todo o extrato em uma única "transação".
 */
export function parsePDFText(text: string): ParsedPDFRow[] {
  const rows: ParsedPDFRow[] = [];
  const linhasBrutas = text.split(/\r?\n/);

  // 1) Linhas que já têm a estrutura completa "DATA  DESC  VALOR"
  for (const linha of linhasBrutas) {
    const l = linha.trim();
    if (l.length < 8) continue;
    // Linha muito longa ou com várias datas → trata na estratégia 2
    const datasNaLinha = (l.match(REGEX_DATA_GLOBAL) ?? []).length;
    if (datasNaLinha > 1 || l.length > 300) continue;
    const m = l.match(REGEX_LINHA_GENERICA);
    if (!m) continue;
    const data = parseDataPDF(m[1]);
    if (!data) continue;
    const descricao = m[2].trim().replace(/\s+/g, " ");
    if (descricaoEhRuim(descricao)) continue;
    const valor = parseValorPDF(m[3]);
    if (valor === null || Math.abs(valor) < 0.01) continue;
    rows.push({
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
    });
  }

  // 2) Linhas com múltiplas datas — picota por data e processa cada chunk
  for (const linha of linhasBrutas) {
    const l = linha.trim();
    if (l.length < 20) continue;
    const matches = [...l.matchAll(REGEX_DATA_GLOBAL)];
    if (matches.length < 2) continue;
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? l.length) : l.length;
      const chunk = l.slice(start, end).trim();
      if (chunk.length < 8 || chunk.length > MAX_DESC_LEN + 60) continue;
      const m = chunk.match(REGEX_CHUNK);
      if (!m) continue;
      const data = parseDataPDF(m[1]);
      if (!data) continue;
      const descricao = m[2].trim().replace(/\s+/g, " ");
      if (descricaoEhRuim(descricao)) continue;
      const valor = parseValorPDF(m[3]);
      if (valor === null || Math.abs(valor) < 0.01) continue;
      rows.push({
        data,
        descricao,
        valor: Math.abs(valor),
        tipo: valor < 0 ? "despesa" : "receita",
      });
    }
  }

  // 3) Fallback final: regex global no texto compactado (layouts em coluna)
  if (rows.length === 0) {
    const compacto = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
    const regexGrupo =
      /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+[a-zç]{3,9}\s+\d{2,4})\s+([^\d][^\n]{2,80}?)\s+([+\-]?R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?:\s?[CD])?)/gi;
    let match: RegExpExecArray | null;
    while ((match = regexGrupo.exec(compacto)) !== null) {
      const data = parseDataPDF(match[1]);
      if (!data) continue;
      const descricao = match[2].trim().replace(/\s+/g, " ");
      if (descricaoEhRuim(descricao)) continue;
      const valor = parseValorPDF(match[3]);
      if (valor === null || Math.abs(valor) < 0.01) continue;
      rows.push({
        data,
        descricao,
        valor: Math.abs(valor),
        tipo: valor < 0 ? "despesa" : "receita",
      });
    }
  }

  return dedupeDefensivo(rows);
}

/**
 * Defesa contra duplicação do extractor de PDF (unpdf/pdf-parse podem
 * "duplicar" partes do texto quando o PDF tem layouts complexos, páginas
 * repetidas, ou tabelas renderizadas como sobreposição).
 *
 * Heurística: se a mesma chave (data + descrição + valor + tipo) aparece
 * mais de 2 vezes no resultado bruto, é quase certo que foi duplicação do
 * extractor — manter só 1. Se aparece exatamente 2 vezes, mantém as 2
 * (pode ser uma operação real repetida pelo usuário no mesmo dia).
 *
 * A janela é defensiva pra cima — se o usuário REALMENTE fez 5 Pix iguais
 * no mesmo dia, vai aparecer só 1 e ele pode adicionar os 4 restantes
 * manualmente. Esse caso é raríssimo; o caso comum é o extractor cuspir 31
 * cópias da mesma transação.
 */
function dedupeDefensivo(rows: ParsedPDFRow[]): ParsedPDFRow[] {
  if (rows.length <= 1) return rows;
  const LIMITE_COPIAS_REAIS = 2;
  const chave = (r: ParsedPDFRow) =>
    `${r.data.getFullYear()}-${r.data.getMonth() + 1}-${r.data.getDate()}|${r.descricao}|${r.valor.toFixed(2)}|${r.tipo}`;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(chave(r), (counts.get(chave(r)) ?? 0) + 1);
  const vistos = new Map<string, number>();
  const limpas: ParsedPDFRow[] = [];
  for (const r of rows) {
    const k = chave(r);
    const total = counts.get(k)!;
    const max = total > LIMITE_COPIAS_REAIS ? 1 : total;
    const ja = vistos.get(k) ?? 0;
    if (ja >= max) continue;
    vistos.set(k, ja + 1);
    limpas.push(r);
  }
  return limpas;
}

/**
 * Extrai texto de um PDF (Buffer).
 * Usa import dinâmico porque pdf-parse não funciona bem com bundler.
 */
export async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  // Usa unpdf — biblioteca compatível com Next.js/serverless (não requer worker)
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
  );
  const { text } = await extractText(pdf, { mergePages: true });
  return text ?? "";
}

/**
 * Converte as linhas extraídas pra um CSV no formato que o parser CSV existente
 * já entende (cabeçalho data, descrição, valor com sinal).
 */
export function rowsParaCSV(rows: ParsedPDFRow[]): string {
  const linhas: string[] = ["Data,Descricao,Valor"];
  for (const r of rows) {
    const d = r.data;
    const data = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const desc = `"${r.descricao.replace(/"/g, '""')}"`;
    const v = (r.tipo === "despesa" ? -r.valor : r.valor)
      .toFixed(2)
      .replace(".", ",");
    linhas.push(`${data},${desc},${v}`);
  }
  return linhas.join("\n");
}

/**
 * Pipeline completo: PDF Buffer → texto → rows → CSV.
 */
export async function processarPDF(buffer: Buffer): Promise<PDFParseResult> {
  const texto = await extrairTextoPDF(buffer);
  const rows = parsePDFText(texto);
  return { texto, rows };
}
