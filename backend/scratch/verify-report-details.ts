import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ReportsService } from '../src/modules/reports/reports.service';
import { db } from '../src/database/db';
import { productionLines, productionBatches } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const reportsService = app.get(ReportsService);

  console.log('--- FETCHING PRODUCTION LINES ---');
  const lines = await db.select().from(productionLines);
  console.log('Available Production Lines:', lines.map(l => ({ id: l.id, name: l.name })));

  const line1 = lines.find(l => l.name.toLowerCase().includes('line 1') || l.name.includes('1'));
  if (!line1) {
    console.error('Line 1 not found!');
    await app.close();
    return;
  }

  console.log(`Using line: ${line1.name} (${line1.id})`);

  const startDate = new Date('2026-06-08T00:00:00.000Z');
  const endDate = new Date('2026-06-15T23:59:59.000Z');

  console.log(`\n--- BATCHES IN RANGE (${startDate.toISOString()} to ${endDate.toISOString()}) ---`);
  const dbBatches = await db.select()
    .from(productionBatches)
    .where(eq(productionBatches.lineId, line1.id));
  console.log(`Total batches on this line in DB: ${dbBatches.length}`);
  dbBatches.forEach(b => {
    console.log(`- Batch: ${b.batchCode} | Status: ${b.status} | EndTime: ${b.endTime?.toISOString()}`);
  });

  console.log('\n--- CALLING getProductionReportDetails ---');
  const result = await reportsService.getProductionReportDetails({
    startDate,
    endDate,
    lineId: line1.id
  });

  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify(result.summary, null, 2));

  console.log('\n--- TELEMETRY LOGS SAMPLE ---');
  console.log(JSON.stringify(result.logs.slice(0, 5), null, 2));

  console.log('\n--- BATCHES INCLUDED ---');
  console.log(result.batches);

  console.log('\n--- STATION ANALYSIS ---');
  console.log(JSON.stringify(result.stationAnalysis, null, 2));

  console.log('\n--- RECONCILIATION DATA ---');
  console.log(JSON.stringify(result.reconciliation, null, 2));

  await app.close();
}

bootstrap().catch(console.error);
