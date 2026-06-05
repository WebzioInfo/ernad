import { DashboardService } from '../src/modules/dashboard/dashboard.service';

async function main() {
  const service = new DashboardService();
  
  const todayRes = await service.getOverview('today');
  console.log('--- TODAY OVERVIEW ---');
  console.log('Units Packed:', todayRes.kpis.unitsPacked);
  console.log('Produced Period (Cases):', todayRes.materials.producedDuringPeriod);

  const weekRes = await service.getOverview('week');
  console.log('--- WEEK OVERVIEW ---');
  console.log('Produced Period (Cases):', weekRes.materials.producedDuringPeriod);
  
  process.exit(0);
}

main().catch(console.error);
