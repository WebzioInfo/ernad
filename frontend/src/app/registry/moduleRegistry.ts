import { ModuleConfig, SidebarGroup, RouteDefinition } from './types';

class ModuleRegistry {
  private static instance: ModuleRegistry;
  private modules: Map<string, ModuleConfig> = new Map();

  private constructor() {}

  public static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry();
    }
    return ModuleRegistry.instance;
  }

  public register(config: ModuleConfig) {
    if (this.modules.has(config.id)) {
      console.warn(`Module with id ${config.id} is already registered. Overwriting...`);
    }
    this.modules.set(config.id, config);
  }

  public getModules(): ModuleConfig[] {
    return Array.from(this.modules.values()).sort((a, b) => a.order - b.order);
  }

  public getModule(id: string): ModuleConfig | undefined {
    return this.modules.get(id);
  }

  public getAllSidebarGroups(): SidebarGroup[] {
    const groups: SidebarGroup[] = [];
    this.getModules().forEach(module => {
      if (module.sidebarGroups) {
        groups.push(...module.sidebarGroups);
      }
    });
    return groups;
  }

  public getAllRoutes(): RouteDefinition[] {
    const routes: RouteDefinition[] = [];
    this.getModules().forEach(module => {
      routes.push(...module.routes);
    });
    return routes;
  }
}

export const moduleRegistry = ModuleRegistry.getInstance();
