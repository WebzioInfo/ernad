import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ReportsService } from '../src/modules/reports/reports.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const reportsService = app.get(ReportsService);

  const startDate = new Date('2026-06-08T00:00:00.000Z');
  const endDate = new Date('2026-06-15T23:59:59.000Z');

  console.log('--- CALLING getOperationsLedgerReport ---');
  const result = await reportsService.getOperationsLedgerReport({
    startDate,
    endDate
  });

  console.log('\n--- LINE MATERIAL WASTAGE DATA ---');
  console.log(JSON.stringify(result.lineMaterialWastage, null, 2));

  await app.close();
}

bootstrap().catch(console.error);
