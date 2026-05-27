import { lazy } from 'react';
import { FileText, BarChart4 } from 'lucide-react';
// TEMP DISABLED - Future Admin Feature
// import { ClipboardList } from 'lucide-react';
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
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    {
      path: 'reports/sales',
      element: lazy(() => import('./pages/SalesAnalyticsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
    },
    /* TEMP DISABLED - Future Admin Feature
    // Preserved for future implementation
    {
      path: 'reports/attendance',
      element: lazy(() => import('./pages/AttendanceReportsPage')),
      allowedRoles: ['ADMIN']
    },
    */
    {
      path: 'reports/batch/:id',
      element: lazy(() => import('./pages/BatchForensicsPage')),
      allowedRoles: ['ADMIN', 'MANAGER']
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
          allowedRoles: ['ADMIN', 'MANAGER']
        },
        {
          id: 'sales_reports',
          label: 'Sales',
          icon: BarChart4,
          path: '/reports/sales',
          allowedRoles: ['ADMIN', 'MANAGER']
        }
      ]
    },
    /* TEMP DISABLED - Future Admin Feature
    // Preserved for future implementation
    {
      id: 'team',
      label: 'Team',
      items: [
        {
          id: 'attendance_reports',
          label: 'Attendance',
          icon: ClipboardList,
          path: '/reports/attendance',
          allowedRoles: ['ADMIN'],
          isComingSoon: true
        }
      ]
    }
    */
  ]
};
