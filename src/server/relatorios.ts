import { prisma } from "@/lib/prisma";
import { totaisDoMes, obterCompetencia, valorEfetivo } from "./competencia";

export type TipoRelatorio =
  | "demonstrativo"
  | "categorias"
  | "entradas-saidas"
  | "fixas"
  | "variaveis"
  | "cartao"
  | "parcelas"
  | "assinaturas"
  | "investimentos"
  | "metas";

export interface LinhaRelatorio {
  [coluna: string]: string | number;
}

export interface Relatorio {
  titulo: string;
  colunas: string[];
  linhas: LinhaRelatorio[];
  totais?: Record<string, number>;
}

export async function gerarRelatorio(
  userId: string,
  tipo: TipoRelatorio,
  mes: number,
  ano: number,
): Promise<Relatorio> {
  const comp = obterCompetencia(mes, ano);

  switch (tipo) {
    case "demonstrativo": {
      const totais = await totaisDoMes(userId, mes, ano);
      return {
        titulo: `Demonstrativo ${comp.nome}/${ano}`,
        colunas: ["Métrica", "Valor"],
        linhas: [
          { Métrica: "Entradas", Valor: totais.entradas },
          { Métrica: "Despesas pagas", Valor: totais.despesasPagas },
          { Métrica: "Despesas em aberto", Valor: totais.despesasAbertas },
          { Métrica: "Despesas previstas", Valor: totais.despesasPrevistas },
          { Métrica: "Gastos no cartão", Valor: totais.gastosCartao },
          { Métrica: "Investimentos", Valor: totais.investimentos },
          { Métrica: "Saldo do mês", Valor: totais.saldoFinal },
          { Métrica: "Limite mensal", Valor: totais.limiteMensal ?? 0 },
          { Métrica: "Limite usado", Valor: totais.limiteUsado },
          { Métrica: "Limite disponível", Valor: totais.limiteDisponivel ?? 0 },
        ],
      };
    }
    case "categorias": {
      const lancs = await prisma.lancamento.findMany({
        where: {
          userId,
          data: { gte: comp.inicio, lte: comp.fim },
          tipo: "despesa",
          status: { not: "cancelada" },
        },
        include: { categoria: true },
      });
      const installs = await prisma.cardInstallment.findMany({
        where: { userId, mes, ano, status: { not: "cancelada" } },
        include: { purchase: { include: { categoria: true } } },
      });
      const fixas = await prisma.despesaFixaMensal.findMany({
        where: { userId, mes, ano, status: { not: "cancelada" } },
        include: { despesaFixa: { include: { categoria: true } } },
      });
      const map = new Map<string, { qtd: number; valor: number }>();
      const add = (nome: string, v: number) => {
        const cur = map.get(nome) ?? { qtd: 0, valor: 0 };
        cur.qtd += 1;
        cur.valor += v;
        map.set(nome, cur);
      };
      for (const l of lancs) add(l.categoria?.nome ?? "Sem categoria", l.valor);
      for (const i of installs)
        add(i.purchase.categoria?.nome ?? "Sem categoria", i.valor);
      for (const f of fixas)
        add(
          f.despesaFixa.categoria?.nome ?? "Sem categoria",
          valorEfetivo(f),
        );
      const total = Array.from(map.values()).reduce((acc, v) => acc + v.valor, 0);
      const linhas = Array.from(map.entries())
        .sort((a, b) => b[1].valor - a[1].valor)
        .map(([nome, v]) => ({
          Categoria: nome,
          Itens: v.qtd,
          Valor: v.valor,
          "%": total > 0 ? ((v.valor / total) * 100).toFixed(1) + "%" : "0%",
        }));
      return {
        titulo: `Gastos por categoria — ${comp.nome}/${ano}`,
        colunas: ["Categoria", "Itens", "Valor", "%"],
        linhas,
        totais: { Valor: total },
      };
    }
    case "entradas-saidas": {
      const totais = await totaisDoMes(userId, mes, ano);
      const dif = totais.entradas - (totais.despesasPagas + totais.despesasAbertas);
      return {
        titulo: `Entradas x Saídas — ${comp.nome}/${ano}`,
        colunas: ["Fluxo", "Valor"],
        linhas: [
          { Fluxo: "Entradas", Valor: totais.entradas },
          { Fluxo: "Saídas (pagas)", Valor: totais.despesasPagas },
          { Fluxo: "Saídas (em aberto)", Valor: totais.despesasAbertas },
          { Fluxo: "Diferença", Valor: dif },
        ],
      };
    }
    case "fixas": {
      const fixas = await prisma.despesaFixaMensal.findMany({
        where: { userId, mes, ano, status: { not: "cancelada" } },
        include: { despesaFixa: { include: { categoria: true } } },
        orderBy: { diaVencimento: "asc" },
      });
      const linhas = fixas.map((f) => ({
        Descrição: f.descricaoOverride ?? f.despesaFixa.descricao,
        Categoria: f.despesaFixa.categoria?.nome ?? "",
        Tipo: f.despesaFixa.tipoValor,
        Vencimento: f.diaVencimento,
        Previsto: f.valorPrevisto,
        Real: f.valorReal ?? 0,
        Status: f.status,
      }));
      return {
        titulo: `Despesas fixas — ${comp.nome}/${ano}`,
        colunas: [
          "Descrição",
          "Categoria",
          "Tipo",
          "Vencimento",
          "Previsto",
          "Real",
          "Status",
        ],
        linhas,
        totais: {
          Previsto: linhas.reduce((a, l) => a + Number(l.Previsto), 0),
          Real: linhas.reduce((a, l) => a + Number(l.Real), 0),
        },
      };
    }
    case "variaveis": {
      const lancs = await prisma.lancamento.findMany({
        where: {
          userId,
          data: { gte: comp.inicio, lte: comp.fim },
          tipo: "despesa",
          status: { not: "cancelada" },
        },
        include: { categoria: true, conta: true },
        orderBy: { data: "asc" },
      });
      const linhas = lancs.map((l) => ({
        Data: l.data.toLocaleDateString("pt-BR"),
        Descrição: l.descricao,
        Categoria: l.categoria?.nome ?? "",
        Conta: l.conta?.nome ?? "",
        Status: l.status,
        Valor: l.valor,
      }));
      return {
        titulo: `Despesas variáveis — ${comp.nome}/${ano}`,
        colunas: ["Data", "Descrição", "Categoria", "Conta", "Status", "Valor"],
        linhas,
        totais: { Valor: linhas.reduce((a, l) => a + Number(l.Valor), 0) },
      };
    }
    case "cartao": {
      const installs = await prisma.cardInstallment.findMany({
        where: { userId, mes, ano, status: { not: "cancelada" } },
        include: {
          purchase: { include: { categoria: true, cartao: true } },
        },
        orderBy: { dataVencimento: "asc" },
      });
      const linhas = installs.map((i) => ({
        Cartão: i.purchase.cartao.nome,
        Descrição: i.purchase.descricao,
        Parcela:
          i.purchase.totalParcelas > 1
            ? `${i.numero}/${i.purchase.totalParcelas}`
            : i.purchase.ehAssinatura
              ? "Assinatura"
              : "À vista",
        Categoria: i.purchase.categoria?.nome ?? "",
        Vencimento: i.dataVencimento.toLocaleDateString("pt-BR"),
        Status: i.status,
        Valor: i.valor,
      }));
      return {
        titulo: `Cartão de crédito — ${comp.nome}/${ano}`,
        colunas: [
          "Cartão",
          "Descrição",
          "Parcela",
          "Categoria",
          "Vencimento",
          "Status",
          "Valor",
        ],
        linhas,
        totais: { Valor: linhas.reduce((a, l) => a + Number(l.Valor), 0) },
      };
    }
    case "parcelas": {
      const purchases = await prisma.cardPurchase.findMany({
        where: { userId, status: "ativa", totalParcelas: { gt: 1 } },
        include: {
          installments: { orderBy: { numero: "asc" } },
          cartao: true,
          categoria: true,
        },
        orderBy: { dataCompra: "desc" },
      });
      const linhas = purchases.map((p) => ({
        Cartão: p.cartao.nome,
        Descrição: p.descricao,
        Categoria: p.categoria?.nome ?? "",
        "Total compra": p.valorTotal,
        Parcelas: p.totalParcelas,
        Pagas: p.installments.filter((i) => i.status === "paga").length,
        "Falta pagar": p.installments
          .filter((i) => i.status !== "paga" && i.status !== "cancelada")
          .reduce((a, i) => a + i.valor, 0),
      }));
      return {
        titulo: "Parcelas — todas as compras parceladas ativas",
        colunas: [
          "Cartão",
          "Descrição",
          "Categoria",
          "Total compra",
          "Parcelas",
          "Pagas",
          "Falta pagar",
        ],
        linhas,
      };
    }
    case "assinaturas": {
      const assin = await prisma.cardPurchase.findMany({
        where: { userId, ehAssinatura: true, status: "ativa" },
        include: { cartao: true, categoria: true },
      });
      const linhas = assin.map((a) => ({
        Cartão: a.cartao.nome,
        Descrição: a.descricao,
        Categoria: a.categoria?.nome ?? "",
        Valor: a.valorTotal,
      }));
      return {
        titulo: "Assinaturas ativas",
        colunas: ["Cartão", "Descrição", "Categoria", "Valor"],
        linhas,
        totais: { Valor: linhas.reduce((a, l) => a + Number(l.Valor), 0) },
      };
    }
    case "investimentos": {
      const assets = await prisma.investmentAsset.findMany({
        where: { userId, status: "ativo" },
        orderBy: { valorAtual: "desc" },
      });
      const linhas = assets.map((a) => ({
        Nome: a.nome,
        Instituição: a.instituicao ?? "",
        Tipo: a.tipo,
        Aplicado: a.valorAplicado,
        Atual: a.valorAtual,
        Rendimento: a.valorAtual - a.valorAplicado,
        Risco: a.risco ?? "",
        Vencimento: a.vencimento
          ? a.vencimento.toLocaleDateString("pt-BR")
          : "",
      }));
      return {
        titulo: "Carteira de investimentos",
        colunas: [
          "Nome",
          "Instituição",
          "Tipo",
          "Aplicado",
          "Atual",
          "Rendimento",
          "Risco",
          "Vencimento",
        ],
        linhas,
        totais: {
          Aplicado: linhas.reduce((a, l) => a + Number(l.Aplicado), 0),
          Atual: linhas.reduce((a, l) => a + Number(l.Atual), 0),
          Rendimento: linhas.reduce((a, l) => a + Number(l.Rendimento), 0),
        },
      };
    }
    case "metas": {
      const metas = await prisma.financialGoal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      const linhas = metas.map((m) => ({
        Nome: m.nome,
        Categoria: m.categoria ?? "",
        Alvo: m.valorAlvo,
        Atual: m.valorAtual,
        "% Progresso":
          m.valorAlvo > 0
            ? ((m.valorAtual / m.valorAlvo) * 100).toFixed(1) + "%"
            : "0%",
        Prazo: m.prazo ? m.prazo.toLocaleDateString("pt-BR") : "",
        Status: m.status,
      }));
      return {
        titulo: "Metas financeiras",
        colunas: [
          "Nome",
          "Categoria",
          "Alvo",
          "Atual",
          "% Progresso",
          "Prazo",
          "Status",
        ],
        linhas,
      };
    }
  }
}

export function gerarCSV(rel: Relatorio): string {
  const sep = ";";
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(sep) || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [];
  lines.push(rel.colunas.map(escape).join(sep));
  for (const l of rel.linhas) {
    lines.push(
      rel.colunas
        .map((c) => {
          const v = l[c];
          if (typeof v === "number") {
            return v.toFixed(2).replace(".", ",");
          }
          return escape(v);
        })
        .join(sep),
    );
  }
  if (rel.totais) {
    const row: Record<string, unknown> = {};
    rel.colunas.forEach((c, i) => {
      if (i === 0) row[c] = "TOTAL";
      else if (rel.totais![c] !== undefined) row[c] = rel.totais![c];
      else row[c] = "";
    });
    lines.push(
      rel.colunas
        .map((c) => {
          const v = row[c];
          if (typeof v === "number") return v.toFixed(2).replace(".", ",");
          return escape(v);
        })
        .join(sep),
    );
  }
  return "﻿" + lines.join("\n"); // BOM para Excel abrir em UTF-8
}
