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
      allowedRoles: ['ADMIN']
    },
    {
      path: 'staffs',
      element: lazy(() => import('./StaffDirectoryPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'audit',
      element: lazy(() => import('./AuditLogsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
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
          allowedRoles: ['ADMIN']
        },
        {
          id: 'staffs',
          label: 'Operators',
          icon: UserCog,
          path: '/staffs',
          allowedRoles: ['ADMIN', 'MANAGER']
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
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
