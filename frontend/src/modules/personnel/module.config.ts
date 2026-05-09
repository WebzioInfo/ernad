import { lazy } from 'react';
import { Users, UserCog, History } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const personnelConfig: ModuleConfig = {
  id: 'personnel',
  name: 'Personnel',
  category: 'ADMINISTRATION',
  order: 50,
  routes: [
    {
      path: 'users',
      element: lazy(() => import('./UserManagementPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
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
      id: 'personnel_mgmt',
      label: 'Personnel',
      items: [
        {
          id: 'users',
          label: 'Users',
          icon: Users,
          path: '/users',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'staffs',
          label: 'Staff Directory',
          icon: UserCog,
          path: '/staffs',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'audit',
          label: 'Audit Logs',
          icon: History,
          path: '/audit',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
