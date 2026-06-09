const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, '../frontend/src');

function getFiles(dir, suffix, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getFiles(filePath, suffix, fileList);
      }
    } else if (file.endsWith(suffix)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const hookNames = [
  'useBatches',
  'useActiveBatch',
  'useStartBatch',
  'useCloseBatch',
  'useReopenBatch',
  'useInitiateChangeover',
  'useCompleteChangeover',
  'useLogHistory',
  'useActiveEvents',
  'useReconciliation',
  'useLogTelemetry',
  'useCurrentSession',
  'useActiveSessions',
  'useEndSession',
  'useLines',
  'useLine',
  'useBrands',
  'useProducts',
  'useShifts',
  'useUsers',
  'useUser',
  'useToggleUserActive',
  'useStock',
  'useStockByCategory',
  'useWarehouses',
  'usePackagingConfigs',
  'useLedger',
  'useRawMaterials',
  'useProductionStock',
  'useStationConsumption',
  'useRawMaterialLedger',
  'useProductLedger',
  'useKpis',
  'useLinePerformance',
  'useFactoryLive',
  'useBiometricDevices',
  'useAttendanceToday',
  'useMonthlyAttendanceReport',
  'useNotes',
  'useCreateNote',
  'useDeleteNote',
  'useUnreadNotifications',
  'useMarkNotificationRead',
  'useSalesTransactions',
  'useCreateSalesTransaction',
  'useUpdateSalesTransaction',
  'useDeleteSalesTransaction',
];

const serviceNames = [
  'AuthService',
  'ProductionService',
  'TelemetryService',
  'OperatorSessionService',
  'MasterDataService',
  'UserService',
  'InventoryService',
  'AnalyticsService',
  'BiometricService',
  'TerminalService',
  'NotesService',
  'NotificationService',
  'ReportService',
  'SalesService'
];

const files = getFiles(frontendDir, '.tsx').concat(getFiles(frontendDir, '.ts'));
const hookUsages = {};
const serviceUsages = {};

hookNames.forEach(h => hookUsages[h] = []);
serviceNames.forEach(s => serviceUsages[s] = []);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const relPath = path.relative(frontendDir, file);
  
  if (relPath === 'hooks\\useApi.ts' || relPath === 'services\\api-services.ts') {
    continue;
  }

  hookNames.forEach(h => {
    if (content.includes(h)) {
      hookUsages[h].push(relPath);
    }
  });

  serviceNames.forEach(s => {
    if (content.includes(s)) {
      serviceUsages[s].push(relPath);
    }
  });
}

fs.writeFileSync(
  path.join(__dirname, 'frontend_callers_detailed.json'),
  JSON.stringify({ hookUsages, serviceUsages }, null, 2)
);
console.log('Done mapping frontend callers detailed');
