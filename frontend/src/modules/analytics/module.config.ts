import { lazy } from 'react';
import { BarChart3, Globe } from 'lucide-react';
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
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'analytics',
      element: lazy(() => import('./EfficiencyDashboardPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'dashboards',
      label: 'Insights',
      items: [
        {
          id: 'overview',
          label: 'Overview',
          icon: Globe,
          path: '/overview', // Will be prefixed by layout path
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'analytics',
          label: 'Analytics',
          icon: BarChart3,
          path: '/analytics',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
