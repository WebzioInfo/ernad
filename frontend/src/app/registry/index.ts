import { moduleRegistry } from './moduleRegistry';
import { analyticsConfig } from '../../modules/analytics/module.config';
import { biometricConfig } from '../../modules/biometric/module.config';
import { personnelConfig } from '../../modules/personnel/module.config';
import { productionConfig } from '../../modules/production/module.config';
import { inventoryConfig } from '../../modules/inventory/module.config';
import { notesConfig } from '../../modules/notes/module.config';
import { settingsConfig } from '../../modules/settings/module.config';
import { reportsConfig } from '../../modules/reports/module.config';

export const registerModules = () => {
  moduleRegistry.register(analyticsConfig);
  moduleRegistry.register(biometricConfig);
  moduleRegistry.register(personnelConfig);
  moduleRegistry.register(productionConfig);
  moduleRegistry.register(inventoryConfig);
  moduleRegistry.register(notesConfig);
  moduleRegistry.register(settingsConfig);
  moduleRegistry.register(reportsConfig);
};
