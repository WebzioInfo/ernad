import { lazy } from 'react';
import { Users, UserCog, History } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const personnelConfig: ModuleConfig = {
  id: 'personnel',
  name: 'Workforce',
  category: 'ADMINISTRATION',
  order: 50,
  routes: [
    {
      path: 'users',
      element: lazy(() => import('./UserManagementPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      path: 'staffs',
      element: lazy(() => import('./StaffDirectoryPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'audit',
      element: lazy(() => import('./AuditLogsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'team',
      label: 'Team',
      items: [
        {
          id: 'users',
          label: 'System Access',
          icon: Users,
          path: '/users',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        },
        {
          id: 'staffs',
          label: 'Operators',
          icon: UserCog,
          path: '/staffs',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      items: [
        {
          id: 'audit',
          label: 'History',
          icon: History,
          path: '/audit',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
