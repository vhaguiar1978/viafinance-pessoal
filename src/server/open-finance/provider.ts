/**
 * Camada abstrata de Open Finance.
 *
 * Esta interface define o contrato que um provider Open Finance (Pluggy,
 * Belvo ou similar) precisa implementar. Hoje não há provider real ligado —
 * apenas a estrutura.
 *
 * Regras obrigatórias (item 13 da spec):
 *  - Nunca pedir/armazenar senha do banco
 *  - Conexão sempre via consentimento autorizado
 *  - Usuário pode desconectar a qualquer momento
 *  - Logs de sincronização
 *
 * Para integrar um provider real:
 *  1. Implemente esta interface.
 *  2. Registre o provider em `getProvider()`.
 *  3. Configure variáveis de ambiente (`OPEN_FINANCE_PROVIDER`, etc.).
 */

export interface OFProviderAccount {
  providerAccountId: string;
  tipo: "corrente" | "poupanca" | string;
  numero?: string;
  agencia?: string;
  saldoAtual: number;
  moeda: string;
}

export interface OFProviderTransaction {
  providerTxId: string;
  data: Date;
  descricao: string;
  valor: number;
  tipo: "credito" | "debito";
}

export interface OFProviderCardAccount {
  providerCardId: string;
  nome: string;
  bandeira?: string;
  limite: number;
  limiteUsado: number;
}

export interface OFProviderInvestment {
  providerAssetId: string;
  nome: string;
  tipo: string;
  valorAplicado: number;
  valorAtual: number;
  vencimento?: Date;
}

export interface OFConsentLink {
  url: string;
  expiresAt?: Date;
  externalId?: string;
}

export interface OpenFinanceProvider {
  readonly name: string;

  /** Inicia o fluxo de consentimento e devolve a URL pra o usuário autorizar */
  iniciarConsentimento(params: {
    userId: string;
    bancoNome: string;
    permissoes: string[];
    redirectUrl: string;
  }): Promise<OFConsentLink>;

  /** Lista contas após consentimento aprovado */
  listarContas(connectionExternalId: string): Promise<OFProviderAccount[]>;

  /** Lista transações de uma conta no intervalo */
  listarTransacoes(
    providerAccountId: string,
    inicio: Date,
    fim: Date,
  ): Promise<OFProviderTransaction[]>;

  /** Lista cartões do banco */
  listarCartoes(connectionExternalId: string): Promise<OFProviderCardAccount[]>;

  /** Lista posições de investimentos */
  listarInvestimentos(
    connectionExternalId: string,
  ): Promise<OFProviderInvestment[]>;

  /** Revoga consentimento do lado do provider */
  revogarConsentimento(connectionExternalId: string): Promise<void>;
}

let _provider: OpenFinanceProvider | null = null;

/**
 * Retorna o provider configurado, ou null se nenhum provider estiver ligado.
 * Quando integrar Pluggy/Belvo, instancie e retorne aqui.
 */
export function getProvider(): OpenFinanceProvider | null {
  return _provider;
}

/** Apenas para testes/dev */
export function setProvider(p: OpenFinanceProvider | null) {
  _provider = p;
}
