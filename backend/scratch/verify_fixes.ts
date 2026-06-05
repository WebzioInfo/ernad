import { db } from '../src/database/db';
import { InventoryService } from '../src/modules/inventory/inventory.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ProductionEventsService } from '../src/realtime/production.gateway';

async function verify() {
  const service = new InventoryService(
    null as any as AuditService,
    null as any as ProductionEventsService
  );

  await service.recalculateInventory(db);
  const stock = await service.getProductionStock();
  const jar = stock.find((s: any) => s.productName === 'Kenby 20L Jar');
  console.log("Kenby 20L Jar state:", jar);

  process.exit(0);
}
verify().catch(console.error);
