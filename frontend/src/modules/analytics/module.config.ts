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
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: Globe,
          path: '/overview',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'production',
      label: 'Production',
      items: [
        {
          id: 'analytics',
          label: 'Efficiency',
          icon: BarChart3,
          path: '/analytics',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
