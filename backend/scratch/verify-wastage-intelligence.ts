import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WastageService } from '../src/modules/wastage/wastage.service';

async function bootstrap() {
  console.log('--- INITIALIZING NESTJS APPLICATION CONTEXT ---');
  const app = await NestFactory.createApplicationContext(AppModule);
  const wastageService = app.get(WastageService);

  const startDate = new Date('2026-06-08T00:00:00.000Z');
  const endDate = new Date('2026-06-15T23:59:59.000Z');

  console.log('--- CALLING getWastageDashboardData for batchCode EB26164 ---');
  const result = await wastageService.getWastageDashboardData({
    startDate,
    endDate,
    batchCode: 'EB26164'
  });

  console.log('\n=== KPIS ===');
  console.log(JSON.stringify(result.kpis, null, 2));

  console.log('\n=== LINE PERFORMANCE ===');
  console.log(JSON.stringify(result.linePerformance, null, 2));

  console.log('\n=== MATERIAL WASTAGE ===');
  console.log(JSON.stringify(result.materialWastage, null, 2));

  console.log('\n=== STATION WASTAGE ===');
  console.log(JSON.stringify(result.stationWastage, null, 2));

  console.log('\n=== SKU WASTAGE ===');
  console.log(JSON.stringify(result.skuWastage, null, 2));

  console.log('\n=== ROOT CAUSE ANALYSIS ===');
  console.log(JSON.stringify(result.rootCause, null, 2));

  console.log('\n=== VALIDATION WARNINGS ===');
  console.log(JSON.stringify(result.validationWarnings, null, 2));

  console.log('\n=== WORST BATCHES ===');
  console.log(JSON.stringify(result.worstBatches, null, 2));

  if (result.worstBatches.length > 0) {
    const worstId = result.worstBatches[0].id;
    console.log(`\n--- CALLING getBatchWastageDetails for ${worstId} ---`);
    const details = await wastageService.getBatchWastageDetails(worstId);
    console.log('Batch Info:', JSON.stringify(details?.batchInfo, null, 2));
    console.log('Stations Breakdown:', JSON.stringify(details?.stations, null, 2));
    console.log('Linked Transactions Count:', details?.transactions.length);
  }

  await app.close();
}

bootstrap().catch(console.error);
