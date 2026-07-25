import { lazy } from 'react';
import { Settings, History } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const settingsConfig: ModuleConfig = {
  id: 'settings',
  name: 'Settings',
  category: 'ADMINISTRATION',
  order: 100,
  routes: [
    {
      path: 'settings',
      element: lazy(() => import('./SettingsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'edit-history',
      element: lazy(() => import('../admin/EditHistoryPage')),
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'OWNER']
    }
  ],
  sidebarGroups: [
    {
      id: 'system',
      label: 'System',
      items: [
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          path: '/settings',
          allowedRoles: ['ADMIN', 'MANAGER']
        },
        {
          id: 'edit-history',
          label: 'Edit History',
          icon: History,
          path: '/edit-history',
          allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'OWNER']
        }
      ]
    }
  ]
};
