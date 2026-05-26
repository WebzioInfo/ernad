import * as fs from 'fs';
import * as path from 'path';

const targetPath = path.join(__dirname, '../src/database/schema/logs.ts');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add import
const importTarget = `import { sql } from 'drizzle-orm';`;
const importReplacement = `import { sql } from 'drizzle-orm';
import { rawMaterials } from './inventory';`;

// 2. Add rawMaterialId and bagsUsed to productionLogs table
const logsTarget = `  preformUsage: integer('preform_usage').default(0),
  preformRejection: integer('preform_rejection').default(0),`;

const logsReplacement = `  preformUsage: integer('preform_usage').default(0),
  preformRejection: integer('preform_rejection').default(0),
  rawMaterialId: uuid('raw_material_id').references(() => rawMaterials.id),
  bagsUsed: decimal('bags_used', { precision: 8, scale: 2 }).default('0'),`;

// 3. Add bagsTotal to batchTotals
const totalsTarget = `  preformTotal: integer('preform_total').default(0).notNull(),`;
const totalsReplacement = `  preformTotal: integer('preform_total').default(0).notNull(),
  bagsTotal: decimal('bags_total', { precision: 10, scale: 2 }).default('0').notNull(),`;

let updated = content;

// Normalize line endings to LF
const normalize = (str: string) => str.replace(/\r\n/g, '\n');

let normalizedContent = normalize(updated);
const normalizedImportTarget = normalize(importTarget);
const normalizedImportRepl = normalize(importReplacement);
const normalizedLogsTarget = normalize(logsTarget);
const normalizedLogsRepl = normalize(logsReplacement);
const normalizedTotalsTarget = normalize(totalsTarget);
const normalizedTotalsRepl = normalize(totalsReplacement);

if (normalizedContent.includes(normalizedImportTarget)) {
  normalizedContent = normalizedContent.replace(normalizedImportTarget, normalizedImportRepl);
} else {
  console.error('Import target not found!');
}

if (normalizedContent.includes(normalizedLogsTarget)) {
  normalizedContent = normalizedContent.replace(normalizedLogsTarget, normalizedLogsRepl);
} else {
  console.error('Logs target not found!');
}

if (normalizedContent.includes(normalizedTotalsTarget)) {
  normalizedContent = normalizedContent.replace(normalizedTotalsTarget, normalizedTotalsRepl);
} else {
  console.error('Totals target not found!');
}

const finalContent = content.includes('\r\n') ? normalizedContent.replace(/\n/g, '\r\n') : normalizedContent;
fs.writeFileSync(targetPath, finalContent, 'utf8');
console.log('Successfully updated logs.ts schema!');
