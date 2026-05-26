import { lazy } from 'react';
import { Package, Layers } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const inventoryConfig: ModuleConfig = {
  id: 'inventory',
  name: 'Inventory',
  category: 'INVENTORY',
  order: 40,
  routes: [
    {
      path: 'products',
      element: lazy(() => import('./ProductsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'raw-materials',
      element: lazy(() => import('./RawMaterialsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'inventory',
      label: 'Inventory',
      items: [
        {
          id: 'products',
          label: 'Products',
          icon: Package,
          path: '/products',
          allowedRoles: ['ADMIN', 'MANAGER']
        },
        {
          id: 'raw-materials',
          label: 'Raw Materials',
          icon: Layers,
          path: '/raw-materials',
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
