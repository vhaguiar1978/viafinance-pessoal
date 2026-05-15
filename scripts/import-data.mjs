// Importa data-backup.json pro banco atual (que deve ser Postgres já migrado).
// Rodar APÓS `prisma migrate deploy` ter criado as tabelas no Supabase.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();

const TABLES_ORDER = [
  // Independentes / referenciadas por outras
  "users",
  "contas",
  "cartoes",
  "categorias",
  "investmentAssets",
  // Dependentes
  "lancamentos",
  "despesasFixas",
  "despesasFixasMensais",
  "investimentos",
  "cardPurchases",
  "cardInvoices",
  "cardInstallments",
  "monthlyLimits",
  "categoryLimits",
  "transferencias",
  "passwordResetTokens",
  "categoryRules",
  "importBatches",
  "importedTransactions",
  "financialGoals",
  "bankConnections",
  "consentRecords",
  "bankAccountSyncs",
  "bankTransactionSyncs",
  "cardSyncAccounts",
  "cardSyncTransactions",
  "investmentPositionSyncs",
  "syncLogs",
];

const TABLE_TO_PRISMA_MODEL = {
  users: "user",
  contas: "conta",
  cartoes: "cartao",
  categorias: "categoria",
  lancamentos: "lancamento",
  despesasFixas: "despesaFixa",
  despesasFixasMensais: "despesaFixaMensal",
  investimentos: "investimento",
  cardPurchases: "cardPurchase",
  cardInstallments: "cardInstallment",
  cardInvoices: "cardInvoice",
  monthlyLimits: "monthlyLimit",
  categoryLimits: "categoryLimit",
  transferencias: "transferencia",
  passwordResetTokens: "passwordResetToken",
  categoryRules: "categoryRule",
  importBatches: "importBatch",
  importedTransactions: "importedTransaction",
  investmentAssets: "investmentAsset",
  financialGoals: "financialGoal",
  bankConnections: "bankConnection",
  consentRecords: "consentRecord",
  bankAccountSyncs: "bankAccountSync",
  bankTransactionSyncs: "bankTransactionSync",
  cardSyncAccounts: "cardSyncAccount",
  cardSyncTransactions: "cardSyncTransaction",
  investmentPositionSyncs: "investmentPositionSync",
  syncLogs: "syncLog",
};

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "data",
  "dataInicio",
  "dataFim",
  "dataVencimento",
  "dataFechamento",
  "dataPagamento",
  "dataCompra",
  "dataAplicacao",
  "vencimento",
  "expiresAt",
  "usedAt",
  "confirmedAt",
  "dataOriginal",
  "ultimaSincronizacao",
  "proximaSincronizacao",
  "dataAutorizacao",
  "dataExpiracao",
  "revogadoEm",
  "ultimaAtualizacao",
  "iniciadoEm",
  "finalizadoEm",
  "prazo",
]);

function reviveDates(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (DATE_FIELDS.has(key) && typeof v === "string") {
      obj[key] = new Date(v);
    }
  }
  return obj;
}

async function main() {
  const raw = readFileSync("data-backup.json", "utf8");
  const data = JSON.parse(raw);
  console.log(`Backup de ${data.exportedAt}`);

  for (const table of TABLES_ORDER) {
    const rows = data[table] ?? [];
    if (rows.length === 0) {
      console.log(`  ${table}: vazio, pulando`);
      continue;
    }
    const modelName = TABLE_TO_PRISMA_MODEL[table];
    const model = prisma[modelName];
    if (!model) {
      console.log(`  ${table}: model ${modelName} não encontrado, pulando`);
      continue;
    }
    let count = 0;
    for (const row of rows) {
      try {
        await model.create({ data: reviveDates({ ...row }) });
        count++;
      } catch (err) {
        console.error(`  ${table}: erro em registro ${row.id}:`, err.message);
      }
    }
    console.log(`  ${table}: ${count}/${rows.length} importados`);
  }

  await prisma.$disconnect();
  console.log("\n✓ Importação concluída");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
