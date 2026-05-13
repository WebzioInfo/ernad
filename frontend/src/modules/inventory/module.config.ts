import { lazy } from 'react';
import { Package } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const inventoryConfig: ModuleConfig = {
  id: 'inventory',
  name: 'Inventory',
  category: 'INVENTORY',
  order: 40,
  routes: [
    {
      path: 'inventory',
      element: lazy(() => import('./InventoryPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'inventory',
      label: 'Inventory',
      items: [
        {
          id: 'inventory',
          label: 'Materials',
          icon: Package,
          path: '/inventory',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
