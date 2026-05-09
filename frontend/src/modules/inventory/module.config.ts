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
      id: 'inventory_group',
      label: 'Supply Chain',
      items: [
        {
          id: 'inventory',
          label: 'Inventory Control',
          icon: Package,
          path: '/inventory',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
