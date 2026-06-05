import { lazy } from 'react';
import { Globe } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const analyticsConfig: ModuleConfig = {
  id: 'analytics',
  name: 'Analytics',
  category: 'CORE',
  order: 10,
  routes: [
    {
      path: 'overview',
      element: lazy(() => import('./ExecutiveDashboard')),
      allowedRoles: ['ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: Globe,
          path: '/overview',
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
