import { lazy } from 'react';
import { Settings } from 'lucide-react';
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
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'settings_group',
      label: 'System',
      items: [
        {
          id: 'settings',
          label: 'Global Settings',
          icon: Settings,
          path: '/settings',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
