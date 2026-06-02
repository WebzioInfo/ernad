import axios from 'axios';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ernad',
});

async function run() {
  console.log('Starting Production Consistency Audit...');
  
  // 1. Get recent logs from DB
  const { rows } = await pool.query(`
    SELECT * FROM production_logs 
    WHERE "deletedAt" IS NULL 
    ORDER BY "loggedAt" DESC 
    LIMIT 20
  `);

  if (rows.length === 0) {
    console.log('No production logs found to audit.');
    return;
  }

  // Group logs by batch and station to fetch from API
  const combinations = new Set(rows.map(r => `${r.batchId}::${r.station}`));
  
  let mismatches = 0;

  for (const combo of combinations) {
    const [batchId, station] = combo.split('::');
    console.log(`\nChecking Batch: ${batchId}, Station: ${station}`);
    
    try {
      const response = await axios.get(`http://localhost:3000/api/telemetry/history/${batchId}?station=${station}`);
      const apiLogs = response.data;
      
      const dbLogs = rows.filter(r => r.batchId === batchId && r.station === station);
      
      for (const dbLog of dbLogs) {
        const apiLog = apiLogs.find((a: any) => a.id === `prod_log_${dbLog.id}` || a.id === dbLog.id);
        
        if (!apiLog) {
          console.error(`[MISMATCH] Log ID ${dbLog.id} found in DB but not returned by API.`);
          mismatches++;
          continue;
        }

        // Compare fields
        const checks = [
          { name: 'Output', db: Number(dbLog.primaryCount), api: Number(apiLog.primaryCount) },
          { name: 'Rejects', db: Number(dbLog.wastageCount), api: Number(apiLog.wastageCount) },
          { name: 'Secondary Packaging', db: Number(dbLog.secondaryPackagingCount), api: Number(apiLog.secondaryPackagingCount) },
          { name: 'Labels Used (bopRollUsage)', db: Number(dbLog.bopRollUsage), api: Number(apiLog.bopRollUsage) },
          { name: 'Shrink Weight', db: Number(dbLog.shrinkWeightUsed), api: Number(apiLog.shrinkWeightUsed) },
          { name: 'Bags Used', db: Number(dbLog.bagsUsed), api: Number(apiLog.bagsUsed) },
          { name: 'Caps Used', db: Number(dbLog.capUsage), api: Number(apiLog.capUsage) },
        ];

        let logHasMismatch = false;
        for (const check of checks) {
          if (!isNaN(check.db) && check.db !== check.api) {
            console.error(`[MISMATCH] Log ${dbLog.id} - ${check.name}: DB=${check.db}, API=${check.api}`);
            logHasMismatch = true;
            mismatches++;
          }
        }
        
        if (!logHasMismatch) {
          console.log(`[OK] Log ${dbLog.id} values match perfectly.`);
        }
      }
    } catch (err: any) {
      console.error(`Failed to fetch API data for ${combo}:`, err.message);
    }
  }

  console.log(`\nAudit Complete. Total Mismatches: ${mismatches}`);
  process.exit(mismatches > 0 ? 1 : 0);
}

run().catch(console.error);
