import { lazy } from 'react';
import { Sparkles } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const aiConfig: ModuleConfig = {
  id: 'ai',
  name: 'Kenby AI',
  category: 'CORE',
  order: 5,
  routes: [
    {
      path: 'ai',
      element: lazy(() => import('./KenbyAIPage')),
      allowedRoles: ['ADMIN']
    }
  ],
  sidebarGroups: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        {
          id: 'kenby_ai',
          label: 'Kenby AI',
          icon: Sparkles,
          path: '/owner/ai',
          allowedRoles: ['ADMIN']
        }
      ]
    }
  ]
};
