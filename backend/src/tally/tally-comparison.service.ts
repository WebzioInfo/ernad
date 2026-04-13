import { Injectable, Logger } from '@nestjs/common';
import { db } from '../db/drizzle.provider'; // Assume Drizzle DB provider exists
import { materialFlows } from '../db/drizzle-schema'; 
// (assuming system_inventory is added to schema, or raw query used)
import { sql } from 'drizzle-orm';

@Injectable()
export class TallyComparisonService {
  private readonly logger = new Logger(TallyComparisonService.name);

  /**
   * Mock implementation of fetching data from Tally
   * In reality, this might hit an ODBC endpoint, Tally API, or read an XML file.
   */
  async mockFetchTallyInventory(): Promise<Record<string, number>> {
      this.logger.log('Mocking fetch from Tally...');
      return {
          "2L_Preforms": 50000,
          "Labels_Kenby_2L": 48000,
          "Shrink_Rolls_kg": 200,
      };
  }

  /**
   * Compares the latest Tally snapshot with System Inventory
   */
  async compareStock() {
      // 1. Fetch current system inventory
      const systemStockDocs = await db.execute(sql`
        SELECT material_name, current_stock FROM system_inventory
      `);

      const systemStockMap = systemStockDocs.rows.reduce((acc, row) => {
          acc[row.material_name as string] = row.current_stock;
          return acc;
      }, {} as Record<string, number>);

      // 2. Fetch or retrieve Tally latest stock
      const tallyStock = await this.mockFetchTallyInventory();

      // 3. Compute Differences
      const discrepancies = [];
      
      const allMaterials = new Set([...Object.keys(systemStockMap), ...Object.keys(tallyStock)]);

      for (const material of allMaterials) {
          const sysQty = systemStockMap[material] || 0;
          const tallyQty = tallyStock[material] || 0;
          
          if (sysQty !== tallyQty) {
              discrepancies.push({
                  material,
                  systemStock: sysQty,
                  tallyStock: tallyQty,
                  difference: tallyQty - sysQty, // Positive means Tally has more
              });
          }
      }

      this.logger.log(`Found ${discrepancies.length} discrepancies between Tally and System.`);
      return discrepancies;
  }
}
