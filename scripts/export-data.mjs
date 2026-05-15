// Exporta TODOS os dados do banco atual pra um JSON
// (rodar ANTES de migrar pra Postgres, pra backup)
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();

async function main() {
  console.log("Exportando dados...");

  const data = {
    exportedAt: new Date().toISOString(),
    users: await prisma.user.findMany(),
    contas: await prisma.conta.findMany(),
    cartoes: await prisma.cartao.findMany(),
    categorias: await prisma.categoria.findMany(),
    lancamentos: await prisma.lancamento.findMany(),
    despesasFixas: await prisma.despesaFixa.findMany(),
    despesasFixasMensais: await prisma.despesaFixaMensal.findMany(),
    investimentos: await prisma.investimento.findMany(),
    cardPurchases: await prisma.cardPurchase.findMany(),
    cardInstallments: await prisma.cardInstallment.findMany(),
    cardInvoices: await prisma.cardInvoice.findMany(),
    monthlyLimits: await prisma.monthlyLimit.findMany(),
    categoryLimits: await prisma.categoryLimit.findMany(),
    transferencias: await prisma.transferencia.findMany(),
    passwordResetTokens: await prisma.passwordResetToken.findMany(),
    categoryRules: await prisma.categoryRule.findMany(),
    importBatches: await prisma.importBatch.findMany(),
    importedTransactions: await prisma.importedTransaction.findMany(),
    investmentAssets: await prisma.investmentAsset.findMany(),
    financialGoals: await prisma.financialGoal.findMany(),
    bankConnections: await prisma.bankConnection.findMany(),
    consentRecords: await prisma.consentRecord.findMany(),
    bankAccountSyncs: await prisma.bankAccountSync.findMany(),
    bankTransactionSyncs: await prisma.bankTransactionSync.findMany(),
    cardSyncAccounts: await prisma.cardSyncAccount.findMany(),
    cardSyncTransactions: await prisma.cardSyncTransaction.findMany(),
    investmentPositionSyncs: await prisma.investmentPositionSync.findMany(),
    syncLogs: await prisma.syncLog.findMany(),
  };

  const summary = Object.entries(data)
    .filter(([k]) => k !== "exportedAt")
    .map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.length : "n/a"}`)
    .join("\n");
  console.log("Resumo:\n" + summary);

  const path = "data-backup.json";
  writeFileSync(path, JSON.stringify(data, null, 2));
  console.log(`\n✓ Backup salvo em ${path}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
