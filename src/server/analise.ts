import { prisma } from "@/lib/prisma";
import { totaisDoMes, obterCompetencia, competenciaAnterior } from "./competencia";
import { formatBRL, nomeMes } from "@/lib/utils";

export type Severidade = "info" | "warning" | "danger" | "success";

export interface AnaliseItem {
  id: string;
  titulo: string;
  detalhe: string;
  severidade: Severidade;
  area: "limite" | "cartao" | "fixas" | "assinaturas" | "carteira" | "metas" | "fluxo";
}

/**
 * Gera análises educativas baseadas em regras (sem LLM). Spec items 18 e 19.
 * Foco: organização e alertas. Não dá recomendações de investimento.
 */
export async function gerarAnalises(
  userId: string,
  mes: number,
  ano: number,
): Promise<AnaliseItem[]> {
  const out: AnaliseItem[] = [];
  let id = 0;
  const next = () => `a-${++id}`;

  const totais = await totaisDoMes(userId, mes, ano);
  const comp = obterCompetencia(mes, ano);

  // 1. Limite mensal
  if (totais.limiteMensal !== null && totais.limiteMensal > 0) {
    const pct = totais.limitePercentual ?? 0;
    const pctTxt = `${(pct * 100).toFixed(1)}%`;
    if (pct >= 1) {
      out.push({
        id: next(),
        titulo: "Limite mensal ultrapassado",
        detalhe: `Você usou ${pctTxt} do limite. Excedeu em ${formatBRL(totais.limiteUsado - totais.limiteMensal)}.`,
        severidade: "danger",
        area: "limite",
      });
    } else if (pct >= 0.9) {
      out.push({
        id: next(),
        titulo: "Limite quase no fim",
        detalhe: `Você está em ${pctTxt}. Disponível: ${formatBRL(totais.limiteDisponivel ?? 0)}.`,
        severidade: "danger",
        area: "limite",
      });
    } else if (pct >= 0.8) {
      out.push({
        id: next(),
        titulo: `Você já usou ${pctTxt} do limite mensal`,
        detalhe: `Restam ${formatBRL(totais.limiteDisponivel ?? 0)} para o restante de ${comp.nome}.`,
        severidade: "warning",
        area: "limite",
      });
    }
    // Projeção linear se mais de 5 dias do mês passaram
    const hoje = new Date();
    if (
      hoje >= comp.inicio &&
      hoje <= comp.fim &&
      pct < 1 &&
      pct > 0
    ) {
      const diaDoMes = hoje.getDate();
      const diasTotal = new Date(ano, mes, 0).getDate();
      if (diaDoMes >= 5) {
        const projecao = (totais.limiteUsado / diaDoMes) * diasTotal;
        if (projecao > totais.limiteMensal) {
          const diasParaEstourar = Math.ceil(
            ((totais.limiteMensal - totais.limiteUsado) /
              (totais.limiteUsado / diaDoMes)) ||
              0,
          );
          out.push({
            id: next(),
            titulo: "Ritmo atual pode estourar o limite",
            detalhe: `Mantendo a média atual, você pode ultrapassar o limite em ~${diasParaEstourar} dias.`,
            severidade: "warning",
            area: "limite",
          });
        }
      }
    }
  } else {
    out.push({
      id: next(),
      titulo: "Defina um limite mensal",
      detalhe: "Ter um limite mensal ajuda a organizar suas finanças e acompanhar o consumo.",
      severidade: "info",
      area: "limite",
    });
  }

  // 2. Gastos do mês — fluxo
  if (totais.entradas > 0 && totais.despesasPagas + totais.despesasAbertas > totais.entradas) {
    out.push({
      id: next(),
      titulo: "Despesas superam as entradas no mês",
      detalhe: `Entradas: ${formatBRL(totais.entradas)} • Despesas: ${formatBRL(totais.despesasPagas + totais.despesasAbertas)}.`,
      severidade: "danger",
      area: "fluxo",
    });
  }

  // 3. Maior categoria
  const lancsMes = await prisma.lancamento.findMany({
    where: { userId, data: { gte: comp.inicio, lte: comp.fim }, tipo: "despesa", status: { not: "cancelada" } },
    include: { categoria: true },
  });
  const cardInstsMes = await prisma.cardInstallment.findMany({
    where: { userId, mes, ano, status: { not: "cancelada" } },
    include: { purchase: { include: { categoria: true } } },
  });
  const fixasMes = await prisma.despesaFixaMensal.findMany({
    where: { userId, mes, ano, status: { not: "cancelada" } },
    include: { despesaFixa: { include: { categoria: true } } },
  });

  const porCat = new Map<string, number>();
  for (const l of lancsMes) {
    const c = l.categoria?.nome ?? "Sem categoria";
    porCat.set(c, (porCat.get(c) ?? 0) + l.valor);
  }
  for (const i of cardInstsMes) {
    const c = i.purchase.categoria?.nome ?? "Sem categoria";
    porCat.set(c, (porCat.get(c) ?? 0) + i.valor);
  }
  for (const f of fixasMes) {
    const c = f.despesaFixa.categoria?.nome ?? "Sem categoria";
    const v = f.valorReal ?? f.valorPrevisto;
    porCat.set(c, (porCat.get(c) ?? 0) + v);
  }
  const ordemCat = Array.from(porCat.entries()).sort((a, b) => b[1] - a[1]);
  if (ordemCat.length > 0 && ordemCat[0][1] > 0) {
    out.push({
      id: next(),
      titulo: `Maior gasto: ${ordemCat[0][0]}`,
      detalhe: `Categoria com maior gasto em ${comp.nome} (${formatBRL(ordemCat[0][1])}).`,
      severidade: "info",
      area: "fluxo",
    });
  }

  // 4. Comparativo com mês anterior
  const ant = competenciaAnterior(mes, ano);
  const totaisAnt = await totaisDoMes(userId, ant.mes, ant.ano);
  const despAtual = totais.despesasPagas + totais.despesasAbertas;
  const despAnt = totaisAnt.despesasPagas + totaisAnt.despesasAbertas;
  if (despAnt > 0) {
    const variacao = (despAtual - despAnt) / despAnt;
    if (variacao > 0.2) {
      out.push({
        id: next(),
        titulo: "Despesas cresceram acima do mês anterior",
        detalhe: `+${(variacao * 100).toFixed(0)}% em ${comp.nome} (${formatBRL(despAtual)} vs ${formatBRL(despAnt)} em ${nomeMes(ant.mes)}).`,
        severidade: "warning",
        area: "fluxo",
      });
    } else if (variacao < -0.15) {
      out.push({
        id: next(),
        titulo: "Despesas caíram em relação ao mês anterior",
        detalhe: `${(variacao * 100).toFixed(0)}% (de ${formatBRL(despAnt)} para ${formatBRL(despAtual)}).`,
        severidade: "success",
        area: "fluxo",
      });
    }
  }

  // 5. Cartão — % do limite usado
  const cartoes = await prisma.cartao.findMany({
    where: { userId, ativo: true },
  });
  for (const c of cartoes) {
    if (c.limite <= 0) continue;
    const purchases = await prisma.cardPurchase.findMany({
      where: { cartaoId: c.id, status: "ativa" },
      include: { installments: true },
    });
    let usado = 0;
    let parcelasFuturas = 0;
    for (const p of purchases) {
      const pago = p.installments
        .filter((i) => i.status === "paga")
        .reduce((acc, i) => acc + i.valor, 0);
      usado += Math.max(0, p.valorTotal - pago);
      parcelasFuturas += p.installments.filter(
        (i) => i.status !== "paga" && i.status !== "cancelada" && (i.ano > ano || (i.ano === ano && i.mes > mes)),
      ).reduce((acc, i) => acc + i.valor, 0);
    }
    const pctC = usado / c.limite;
    if (pctC >= 0.85) {
      out.push({
        id: next(),
        titulo: `Cartão ${c.nome} com ${(pctC * 100).toFixed(0)}% do limite usado`,
        detalhe: `Limite: ${formatBRL(c.limite)} • Usado: ${formatBRL(usado)}.`,
        severidade: pctC >= 0.95 ? "danger" : "warning",
        area: "cartao",
      });
    }
    if (parcelasFuturas > c.limite * 0.5) {
      out.push({
        id: next(),
        titulo: `${c.nome} tem muitas parcelas futuras`,
        detalhe: `${formatBRL(parcelasFuturas)} em parcelas pra próximos meses. Cuidado ao fazer novas compras parceladas.`,
        severidade: "warning",
        area: "cartao",
      });
    }
  }

  // 6. Assinaturas / fixas
  const fixas = await prisma.despesaFixa.findMany({
    where: { userId, ativa: true },
  });
  if (fixas.length > 0) {
    const total = fixas.reduce((a, f) => a + f.valor, 0);
    if (fixas.length >= 5) {
      out.push({
        id: next(),
        titulo: `Você tem ${fixas.length} despesas fixas ativas`,
        detalhe: `Total previsto: ${formatBRL(total)} por mês. Revise se ainda usa todas.`,
        severidade: "info",
        area: "fixas",
      });
    }
  }

  // Assinaturas no cartão — purchases com ehAssinatura
  const assinaturas = await prisma.cardPurchase.findMany({
    where: { userId, ehAssinatura: true, status: "ativa" },
  });
  if (assinaturas.length >= 3) {
    const totalAssin = assinaturas.reduce((a, p) => a + p.valorTotal, 0);
    out.push({
      id: next(),
      titulo: `${assinaturas.length} assinaturas ativas`,
      detalhe: `Somam ${formatBRL(totalAssin)} por mês no cartão. Vale revisar quais usa de verdade.`,
      severidade: "info",
      area: "assinaturas",
    });
  }

  // 7. Carteira — concentração
  const assets = await prisma.investmentAsset.findMany({
    where: { userId, status: "ativo" },
  });
  if (assets.length > 0) {
    const totalAtual = assets.reduce((a, x) => a + x.valorAtual, 0);
    if (totalAtual > 0) {
      const porTipoMap = new Map<string, number>();
      for (const a of assets) {
        porTipoMap.set(a.tipo, (porTipoMap.get(a.tipo) ?? 0) + a.valorAtual);
      }
      const ordem = Array.from(porTipoMap.entries()).sort((a, b) => b[1] - a[1]);
      const maiorPct = ordem[0][1] / totalAtual;
      if (maiorPct > 0.8) {
        out.push({
          id: next(),
          titulo: "Carteira concentrada em um único tipo",
          detalhe: `${(maiorPct * 100).toFixed(0)}% da carteira está em ${ordem[0][0]}. Diversificação pode reduzir riscos.`,
          severidade: "info",
          area: "carteira",
        });
      }
      const rendaFixaTipos = new Set([
        "cdb",
        "lci",
        "lca",
        "tesouro",
        "poupanca",
        "conta_remunerada",
      ]);
      const rendaFixa = assets
        .filter((a) => rendaFixaTipos.has(a.tipo))
        .reduce((acc, a) => acc + a.valorAtual, 0);
      const rfPct = rendaFixa / totalAtual;
      if (rfPct >= 0.9) {
        out.push({
          id: next(),
          titulo: "Carteira majoritariamente em renda fixa",
          detalhe: `~${(rfPct * 100).toFixed(0)}% em renda fixa. Se for jovem e tiver longo prazo, talvez valha diversificar.`,
          severidade: "info",
          area: "carteira",
        });
      } else if (rfPct <= 0.2 && totalAtual > 1000) {
        out.push({
          id: next(),
          titulo: "Carteira majoritariamente em renda variável",
          detalhe: `Apenas ~${(rfPct * 100).toFixed(0)}% em renda fixa. Reserva de emergência costuma ficar em renda fixa de liquidez alta.`,
          severidade: "info",
          area: "carteira",
        });
      }
      // Vencimento próximo (30 dias)
      const limite = new Date();
      limite.setDate(limite.getDate() + 30);
      const proximos = assets.filter(
        (a) => a.vencimento && a.vencimento > new Date() && a.vencimento <= limite,
      );
      if (proximos.length > 0) {
        out.push({
          id: next(),
          titulo: `${proximos.length} investimento(s) vencendo em até 30 dias`,
          detalhe: proximos.map((a) => a.nome).join(", "),
          severidade: "warning",
          area: "carteira",
        });
      }
    }
  }

  // 8. Metas atrasadas
  const metas = await prisma.financialGoal.findMany({
    where: { userId, status: "em_andamento" },
  });
  for (const m of metas) {
    const pct = m.valorAlvo > 0 ? m.valorAtual / m.valorAlvo : 0;
    if (m.prazo && m.prazo < new Date() && pct < 1) {
      out.push({
        id: next(),
        titulo: `Meta atrasada: ${m.nome}`,
        detalhe: `Prazo passou e você está em ${(pct * 100).toFixed(0)}%. Revise valor ou prazo.`,
        severidade: "warning",
        area: "metas",
      });
    }
  }

  // 9. Reserva de emergência (se categoria/meta existir)
  const metaEmerg = metas.find((m) => m.categoria === "emergencia");
  if (metaEmerg) {
    const pct = metaEmerg.valorAlvo > 0 ? metaEmerg.valorAtual / metaEmerg.valorAlvo : 0;
    if (pct < 0.5) {
      out.push({
        id: next(),
        titulo: "Reserva de emergência abaixo do desejado",
        detalhe: `Está em ${(pct * 100).toFixed(0)}% da sua meta (${formatBRL(metaEmerg.valorAtual)} de ${formatBRL(metaEmerg.valorAlvo)}).`,
        severidade: "warning",
        area: "metas",
      });
    }
  }

  if (out.length === 0) {
    out.push({
      id: next(),
      titulo: "Tudo em ordem por enquanto",
      detalhe: "Continue registrando suas movimentações para ter análises mais precisas.",
      severidade: "success",
      area: "fluxo",
    });
  }

  return out;
}
