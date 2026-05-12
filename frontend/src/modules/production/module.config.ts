import { lazy } from 'react';
import { Activity, Monitor, Layout, ShieldCheck } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const productionConfig: ModuleConfig = {
  id: 'production',
  name: 'Manufacturing',
  category: 'PRODUCTION',
  order: 30,
  routes: [
    {
      path: 'production',
      element: lazy(() => import('./ProductionControlPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'forensics/:batchId',
      element: lazy(() => import('./BatchForensicsDashboard')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'execution',
      label: 'Shop Floor Execution',
      items: [
        {
          id: 'terminal',
          label: 'Industrial Terminal',
          icon: Monitor,
          path: '/terminal',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OPERATOR']
        },
        {
          id: 'factory_tv',
          label: 'Factory TV Monitor',
          icon: Layout,
          path: '/admin/production-tv',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'production_mgmt',
      label: 'Plant Management',
      items: [
        {
          id: 'production_control',
          label: 'Production Control',
          icon: Activity,
          path: '/admin/production',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'quality_qc',
          label: 'Quality Control (QC)',
          icon: ShieldCheck,
          path: '/admin/quality',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
