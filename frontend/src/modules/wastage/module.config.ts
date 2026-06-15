import { lazy } from 'react';
import { Trash2 } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const wastageConfig: ModuleConfig = {
  id: 'wastage',
  name: 'Wastage Intelligence',
  category: 'CORE',
  order: 11, // Placed prominently right below Dashboard (10)
  routes: [
    {
      path: 'wastage-intelligence',
      element: lazy(() => import('./pages/WastageDashboard')),
      allowedRoles: ['ADMIN']
    }
  ],
  sidebarGroups: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'wastage_center',
          label: 'Wastage Intelligence',
          icon: Trash2,
          path: '/wastage-intelligence',
          allowedRoles: ['ADMIN']
        }
      ]
    }
  ]
};
