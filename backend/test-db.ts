import { db } from './src/database/db';
import { MasterDataService } from './src/modules/master-data/master-data.service';
import { ProductionEventsService } from './src/realtime/production.gateway';

async function run() {
  const service = new MasterDataService({} as any);
  const data = await service.getRawMaterials('BLOWING');
  console.log('Returned data for BLOWING:', JSON.stringify(data, null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
