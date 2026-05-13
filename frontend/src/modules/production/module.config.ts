import { lazy } from 'react';
import { Activity, Monitor, Layout, ShieldCheck, LayoutDashboard, Database } from 'lucide-react';
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
      path: 'management',
      element: lazy(() => import('./ProductionManagementDashboard')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'forensics/:batchId',
      element: lazy(() => import('./BatchForensicsDashboard')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'terminal',
      element: lazy(() => import('./TerminalDashboard')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      path: 'production-logs',
      element: lazy(() => import('./ProductionLogsManager')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'quality',
      element: lazy(() => import('./QualityManagementPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'production',
      label: 'Production',
      items: [
        {
          id: 'production_control',
          label: 'Live Production',
          icon: Activity,
          path: '/production',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'production_dashboard',
          label: 'Batches',
          icon: LayoutDashboard,
          path: '/management',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'terminal',
          label: 'Terminal',
          icon: Monitor,
          path: '/terminal',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        },
        {
          id: 'operator_workspace',
          label: 'Workspace',
          icon: Layout,
          path: '/operator/select',
          allowedRoles: ['OPERATOR', 'OPERATOR_BLOWING', 'OPERATOR_FILLING', 'OPERATOR_LABELING', 'OPERATOR_PACKING']
        },
        {
          id: 'production_logs',
          label: 'Production Logs',
          icon: Database,
          path: '/production-logs',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'quality',
      label: 'Quality',
      items: [
        {
          id: 'quality_qc',
          label: 'Quality Checks',
          icon: ShieldCheck,
          path: '/quality',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
