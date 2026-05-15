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

/**
 * Extrai linhas em formato "DATA DESCRIÇÃO VALOR" do texto bruto.
 * Faz uma varredura linha por linha + tenta também identificar grupos de 3
 * elementos consecutivos.
 */
export function parsePDFText(text: string): ParsedPDFRow[] {
  const rows: ParsedPDFRow[] = [];
  const linhasBrutas = text.split(/\r?\n/);

  // 1) Linhas com a estrutura completa "DATA  DESC  VALOR"
  for (const linha of linhasBrutas) {
    const l = linha.trim();
    if (l.length < 8) continue;
    const m = l.match(REGEX_LINHA_GENERICA);
    if (!m) continue;
    const data = parseDataPDF(m[1]);
    if (!data) continue;
    const descricao = m[2].trim().replace(/\s+/g, " ");
    if (descricao.length < 2 || /total|saldo/i.test(descricao.slice(0, 12)))
      continue;
    const valor = parseValorPDF(m[3]);
    if (valor === null || Math.abs(valor) < 0.01) continue;
    rows.push({
      data,
      descricao,
      valor: Math.abs(valor),
      tipo: valor < 0 ? "despesa" : "receita",
    });
  }

  // 2) Se a varredura por linha falhou (PDFs com layout em colunas), tenta
  // identificar grupos no texto contínuo: DATA seguido por descrição seguido
  // por valor.
  if (rows.length === 0) {
    const compacto = text.replace(/\n+/g, " ").replace(/\s+/g, " ");
    const regexGrupo =
      /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}\s+[a-zç]{3,9}\s+\d{2,4})\s+([^\d][^\n]{2,80}?)\s+([+\-]?R?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}(?:\s?[CD])?)/gi;
    let match: RegExpExecArray | null;
    while ((match = regexGrupo.exec(compacto)) !== null) {
      const data = parseDataPDF(match[1]);
      if (!data) continue;
      const descricao = match[2].trim().replace(/\s+/g, " ");
      if (descricao.length < 2) continue;
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

  return rows;
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
