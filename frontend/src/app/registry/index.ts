import { moduleRegistry } from './moduleRegistry';
import { analyticsConfig } from '../../modules/analytics/module.config';
import { personnelConfig } from '../../modules/personnel/module.config';
import { productionConfig } from '../../modules/production/module.config';
import { inventoryConfig } from '../../modules/inventory/module.config';
import { notesConfig } from '../../modules/notes/module.config';
import { settingsConfig } from '../../modules/settings/module.config';
import { reportsConfig } from '../../modules/reports/module.config';
import { accountantConfig } from '../../modules/accountant/module.config';
import { incidentsConfig } from '../../modules/incidents/module.config';
import { wastageConfig } from '../../modules/wastage/module.config';
import { aiConfig } from '../../modules/ai/module.config';

export const registerModules = () => {
  moduleRegistry.register(aiConfig);
  moduleRegistry.register(analyticsConfig);
  moduleRegistry.register(wastageConfig);
  moduleRegistry.register(personnelConfig);
  moduleRegistry.register(productionConfig);
  moduleRegistry.register(incidentsConfig);
  moduleRegistry.register(accountantConfig);
  moduleRegistry.register(inventoryConfig);
  moduleRegistry.register(notesConfig);
  moduleRegistry.register(settingsConfig);
  moduleRegistry.register(reportsConfig);
};
