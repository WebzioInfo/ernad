import { db } from '../src/database/db';
import { sql } from 'drizzle-orm';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

async function main() {
  const service = new DashboardService();
  const res = await service.getOverview('today');
  
  console.log('--- TODAY OVERVIEW ---');
  console.log('Units Packed:', res.kpis.unitsPacked);
  console.log('Produced Period:', res.materials.producedDuringPeriod);
  console.log('Preforms Used:', res.materials.preformsUsedDuringPeriod);
  console.log('Caps Used:', res.materials.capsUsedDuringPeriod);
  console.log('Labels Used:', res.materials.labelsUsedDuringPeriod);
  console.log('Shrink Used:', res.materials.shrinkUsedDuringPeriod);
  console.log('Active Lines:', res.kpis.activeLines);
  console.log('Staff Active:', res.kpis.staffActive);

  process.exit(0);
}

main().catch(console.error);
