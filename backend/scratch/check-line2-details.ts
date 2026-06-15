import { db } from '../src/database/db';
import { ReportsService } from '../src/modules/reports/reports.service';

async function main() {
  const reportsService = new ReportsService();
  
  // Find Line 2 ID
  const line2 = await db.query.productionLines.findFirst({
    where: (lines, { eq }) => eq(lines.name, 'LINE 2')
  });
  if (!line2) {
    console.error('LINE 2 not found');
    return;
  }

  const startDate = new Date('2026-06-08T00:00:00Z');
  const endDate = new Date('2026-06-15T23:59:59Z');

  console.log(`Querying details for line: ${line2.name} (ID: ${line2.id})`);
  const details = await reportsService.getProductionReportDetails({
    startDate,
    endDate,
    lineId: line2.id
  });

  console.log('=== SUMMARY ===');
  console.log(details.summary);

  console.log('=== STATION ANALYSIS ===');
  console.log(details.stationAnalysis);

  console.log('=== TELEMETRY LOGS (Returned to Frontend) ===');
  console.log(`Total logs: ${details.logs.length}`);
  console.log(JSON.stringify(details.logs, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
