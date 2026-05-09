import { lazy } from 'react';
import { Activity, Play } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const productionConfig: ModuleConfig = {
  id: 'production',
  name: 'Production',
  category: 'PRODUCTION',
  order: 30,
  routes: [
    {
      path: 'production',
      element: lazy(() => import('./ProductionControlPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'production_mgmt',
      label: 'Manufacturing',
      items: [
        {
          id: 'production',
          label: 'Production Control',
          icon: Activity,
          path: '/production',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'line_select',
          label: 'Operator Terminal',
          icon: Play,
          path: '/line/select', // Path is absolute to bypass layout prefix if needed, but registry handles it
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR']
        }
      ]
    }
  ]
};
