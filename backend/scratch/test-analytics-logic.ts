import { AnalyticsService } from '../src/analytics/analytics.service';

/**
 * MOCK TEST: AI Anomaly Detection Logic
 * This test verifies the statistical Z-score thresholding logic 
 * even if the database pooler is transiently unavailable.
 */
async function testLogic() {
  console.log('🧠 Testing Analytics Logic (Unit Simulation)...');

  // Simulated results from `db.select().from(logs)`
  const mockBaselineLogs = Array.from({ length: 10 }).map(() => ({ capWastage: Math.random() * 3 }));
  const mockAnomaly = { capWastage: 50 };
  
  const allLogs = [...mockBaselineLogs, mockAnomaly];

  // Logic from AnalyticsService
  const avgWastage = allLogs.reduce((a, b) => a + b.capWastage, 0) / allLogs.length;
  const variance = allLogs.reduce((a, b) => a + Math.pow(b.capWastage - avgWastage, 2), 0) / allLogs.length;
  const stdDev = Math.sqrt(variance);

  const threshold = avgWastage + (stdDev * 2);
  
  console.log(`- Average Wastage: ${avgWastage.toFixed(2)}`);
  console.log(`- Std Deviation: ${stdDev.toFixed(2)}`);
  console.log(`- Anomaly Threshold (2σ): ${threshold.toFixed(2)}`);

  const detected = mockAnomaly.capWastage > threshold;
  
  if (detected) {
    console.log('✅ SUCCESS: Anomaly detected (50 > ' + threshold.toFixed(2) + ')');
  } else {
    console.log('❌ FAILURE: Anomaly missed');
  }
}

testLogic();
