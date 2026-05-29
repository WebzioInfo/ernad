import { lazy } from 'react';
import { Activity, Monitor, Layout, LayoutDashboard, Database } from 'lucide-react';
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
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'management',
      element: lazy(() => import('./ProductionManagementDashboard')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'batch-logs/:batchId',
      element: lazy(() => import('./BatchLogsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'forensics/:batchId',
      element: lazy(() => import('./BatchForensicsDashboard')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'terminal',
      element: lazy(() => import('./TerminalDashboard')),
      allowedRoles: ['ADMIN']
    },
    {
      path: 'production-logs',
      element: lazy(() => import('./ProductionLogsManager')),
      allowedRoles: ['ADMIN', 'MANAGER']
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
          allowedRoles: ['ADMIN', 'MANAGER']
        },
        {
          id: 'production_dashboard',
          label: 'Batches',
          icon: LayoutDashboard,
          path: '/management',
          allowedRoles: ['ADMIN', 'MANAGER']
        },
        {
          id: 'terminal',
          label: 'Terminal',
          icon: Monitor,
          path: '/terminal',
          allowedRoles: ['ADMIN']
        },
        {
          id: 'operator_workspace',
          label: 'Workspace',
          icon: Layout,
          path: '/operator/select',
          allowedRoles: ['OPERATOR']
        },
        {
          id: 'production_logs',
          label: 'Production Logs',
          icon: Database,
          path: '/production-logs',
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
