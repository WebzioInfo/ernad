import { lazy } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const incidentsConfig: ModuleConfig = {
  id: 'incidents',
  name: 'Incident & Maintenance Management',
  category: 'PRODUCTION',
  order: 35,
  routes: [
    {
      path: 'incidents',
      element: lazy(() => import('./pages/IncidentsDashboard')),
      allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
    },
  ],
  sidebarGroups: [
    {
      id: 'production',
      label: 'Production',
      items: [
        {
          id: 'incidents_maintenance',
          label: 'Incidents & Maintenance',
          icon: AlertTriangle,
          path: '/incidents',
          allowedRoles: ['ADMIN', 'MANAGER', 'OPERATOR'],
        },
      ],
    },
  ],
};
