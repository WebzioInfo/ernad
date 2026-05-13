import { lazy } from 'react';
import { FileText, BarChart4, ClipboardList } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const reportsConfig: ModuleConfig = {
  id: 'reports',
  name: 'Enterprise Reporting',
  category: 'CORE',
  order: 15,
  routes: [
    {
      path: 'reports/production',
      element: lazy(() => import('./pages/ProductionReportsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'reports/sales',
      element: lazy(() => import('./pages/SalesAnalyticsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'reports/attendance',
      element: lazy(() => import('./pages/AttendanceReportsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      path: 'reports/batch/:id',
      element: lazy(() => import('./pages/BatchForensicsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'reports',
      label: 'Reports',
      items: [
        {
          id: 'prod_reports',
          label: 'Reports',
          icon: FileText,
          path: '/reports/production',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          id: 'sales_reports',
          label: 'Sales',
          icon: BarChart4,
          path: '/reports/sales',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'team',
      label: 'Team',
      items: [
        {
          id: 'attendance_reports',
          label: 'Attendance',
          icon: ClipboardList,
          path: '/reports/attendance',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
          isComingSoon: true
        }
      ]
    }
  ]
};
