import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function parseBRL(value: string): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/\s|R\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function nomeMes(mes: number) {
  return MESES[mes - 1] ?? "";
}

export function formatDateBR(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

/** Cria uma data segura para um dia/mês/ano respeitando meses curtos. */
export function safeDate(ano: number, mes: number, dia: number): Date {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const diaCorrigido = Math.min(dia, ultimoDia);
  return new Date(ano, mes - 1, diaCorrigido);
}

export function competenciaKey(ano: number, mes: number) {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}
