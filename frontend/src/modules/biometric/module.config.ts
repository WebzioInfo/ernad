import { lazy } from 'react';
import { Fingerprint, ClipboardCheck, FileText } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const biometricConfig: ModuleConfig = {
  id: 'biometric',
  name: 'Biometric',
  category: 'CORE',
  order: 20,
  routes: [
    {
      path: 'attendance',
      element: lazy(() => import('./pages/AttendancePage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    },
    {
      path: 'biometric',
      element: lazy(() => import('./pages/DashboardPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
      children: [
        {
          path: 'devices',
          element: lazy(() => import('./pages/DevicesPage')),
          allowedRoles: ['SUPER_ADMIN', 'ADMIN']
        },
        {
          path: 'logs',
          element: lazy(() => import('./pages/LiveLogsPage')),
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          path: 'unmapped',
          element: lazy(() => import('./pages/UnmappedLogsPage')),
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          path: 'shifts',
          element: lazy(() => import('./pages/ShiftsPage')),
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        },
        {
          path: 'reports',
          element: lazy(() => import('./pages/ReportsPage')),
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ],
  sidebarGroups: [
    {
      id: 'team',
      label: 'Team',
      items: [
        {
          id: 'attendance',
          label: 'Attendance',
          icon: ClipboardCheck,
          path: '/attendance',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
          isComingSoon: true
        },
        {
          id: 'biometric',
          label: 'Biometric',
          icon: Fingerprint,
          path: '/biometric',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    },
    {
      id: 'reports',
      label: 'Reports',
      items: [
        {
          id: 'attendance_reports',
          label: 'Attendance Reports',
          icon: FileText,
          path: '/biometric/reports',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
          isComingSoon: true
        }
      ]
    }
  ]
};
