import { requireUser } from "@/lib/session";
import { gerarRelatorio, type TipoRelatorio } from "@/server/relatorios";
import { RelatoriosClient } from "./relatorios-client";

interface Props {
  searchParams: Promise<{ tipo?: string; mes?: string; ano?: string }>;
}

export default async function RelatoriosPage({ searchParams }: Props) {
  await requireUser();
  const sp = await searchParams;
  const tipo = (sp.tipo as TipoRelatorio) ?? "demonstrativo";
  const hoje = new Date();
  const mes = Number(sp.mes) || hoje.getMonth() + 1;
  const ano = Number(sp.ano) || hoje.getFullYear();
  const user = await requireUser();
  const rel = await gerarRelatorio(user.id, tipo, mes, ano);

  return <RelatoriosClient tipo={tipo} mes={mes} ano={ano} relatorio={rel} />;
}
