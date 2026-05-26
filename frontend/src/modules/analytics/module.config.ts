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
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'analytics',
      element: lazy(() => import('./EfficiencyDashboardPage')),
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
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
