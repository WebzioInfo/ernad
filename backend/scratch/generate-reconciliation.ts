import { db } from '../src/database/db';
import { rawMaterials, rawMaterialTransactions, productionLogs } from '../src/database/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log("Generating Reconciliation Report...");
  
  const materials = await db.select().from(rawMaterials);
  const txs = await db.select().from(rawMaterialTransactions).orderBy(asc(rawMaterialTransactions.createdAt));
  
  let reportMd = `# Raw Material Reconciliation Report\n\n`;
  reportMd += `| Material Name | Material Type | Current Stock | Expected Stock | Difference | Status |\n`;
  reportMd += `|---|---|---|---|---|---|\n`;

  let sqlScript = `-- SQL REPAIR SCRIPT FOR RAW MATERIAL STOCK\n`;
  sqlScript += `-- Generated on ${new Date().toISOString()}\n\n`;

  let corruptionFound = false;

  for (const mat of materials) {
    const matTxs = txs.filter(t => t.materialId === mat.id);
    
    // Calculate expected stock
    let expectedStock = 0;
    for (const t of matTxs) {
      expectedStock += Number(t.quantityChange);
    }

    const currentStock = Number(mat.currentStock);
    const diff = expectedStock - currentStock;

    let status = '✅ OK';
    if (Math.abs(diff) > 0.0001) {
      status = '❌ CORRUPT';
      corruptionFound = true;
      sqlScript += `-- Fix for ${mat.name} (ID: ${mat.id})\n`;
      sqlScript += `UPDATE raw_materials SET current_stock = ${expectedStock.toFixed(2)} WHERE id = '${mat.id}';\n\n`;
    }

    reportMd += `| ${mat.name} | ${mat.materialType} | ${currentStock.toFixed(2)} | ${expectedStock.toFixed(2)} | ${diff.toFixed(2)} | ${status} |\n`;
  }

  const reportsDir = 'C:\\Users\\siinaan\\.gemini\\antigravity-ide\\brain\\e8d39929-0576-4932-bfcd-8cc6a63b1e05';
  const reportPath = path.join(reportsDir, 'reconciliation_report.md');
  const sqlPath = path.join(__dirname, 'repair_stock.sql');

  fs.writeFileSync(reportPath, reportMd);
  fs.writeFileSync(sqlPath, sqlScript);

  console.log(`Reconciliation report written to ${reportPath}`);
  console.log(`SQL repair script written to ${sqlPath}`);
  
  if (corruptionFound) {
    console.log("⚠️ Corruption found! Check the SQL script for fixes.");
  } else {
    console.log("✅ No corruption found. Ledger is perfectly balanced.");
  }
  
  process.exit(0);
}

main().catch(console.error);
