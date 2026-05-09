import { lazy } from 'react';
import { StickyNote } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const notesConfig: ModuleConfig = {
  id: 'notes',
  name: 'Notes',
  category: 'CORE',
  order: 90,
  routes: [
    {
      path: 'notes',
      element: lazy(() => import('./NotesPage')),
      allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    }
  ],
  sidebarGroups: [
    {
      id: 'notes_group',
      label: 'Collaboration',
      items: [
        {
          id: 'notes',
          label: 'Operation Notes',
          icon: StickyNote,
          path: '/notes',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
        }
      ]
    }
  ]
};
