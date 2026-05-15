import { redirect } from "next/navigation";

export default function NovoLancamentoRedirect() {
  redirect("/lancamentos?novo=1");
}
