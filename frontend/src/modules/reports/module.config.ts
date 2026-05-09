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
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      path: 'reports/sales',
      element: lazy(() => import('./pages/SalesAnalyticsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    },
    {
      path: 'reports/attendance',
      element: lazy(() => import('./pages/AttendanceReportsPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN']
    }
  ],
  sidebarGroups: [
    {
      id: 'reports_group',
      label: 'Reporting Suite',
      items: [
        {
          id: 'prod_reports',
          label: 'Production Ledger',
          icon: FileText,
          path: '/reports/production',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        },
        {
          id: 'sales_reports',
          label: 'Sales Analytics',
          icon: BarChart4,
          path: '/reports/sales',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        },
        {
          id: 'attendance_reports',
          label: 'Staff Attendance',
          icon: ClipboardList,
          path: '/reports/attendance',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        }
      ]
    }
  ]
};
