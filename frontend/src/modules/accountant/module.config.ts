import { lazy } from 'react';
import { Home, Package, Users } from 'lucide-react';
import { ModuleConfig } from '../../app/registry/types';

export const accountantConfig: ModuleConfig = {
  id: 'accountant',
  name: 'Accountant',
  category: 'FINANCE',
  order: 18,
  routes: [
    {
      path: '',
      element: lazy(() => import('./AccountantPage')),
      allowedRoles: ['ACCOUNTANT'],
    },
    {
      path: 'sales',
      element: lazy(() => import('./SalesRedirect')),
      allowedRoles: ['ACCOUNTANT'],
    },
    {
      path: 'products',
      element: lazy(() => import('../inventory/ProductsPage')),
      allowedRoles: ['ACCOUNTANT'],
    },
    {
      path: 'raw-materials',
      element: lazy(() => import('../inventory/RawMaterialsPage')),
      allowedRoles: ['ACCOUNTANT'],
    },
    {
      path: 'sales/customers',
      element: lazy(() => import('./CustomersPage')),
      allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
    },
    {
      path: 'sales/customers/add',
      element: lazy(() => import('./AddCustomerPage')),
      allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
    },
    {
      path: 'sales/customers/edit/:id',
      element: lazy(() => import('./AddCustomerPage')),
      allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
    },
    {
      path: 'sales/customers/:customerId',
      element: lazy(() => import('./CustomerDetailsPage')),
      allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
    },
  ],
  sidebarGroups: [
    {
      id: 'accountant',
      label: 'Accountant',
      allowedRoles: ['ACCOUNTANT'],
      items: [
        {
          id: 'accountant-dashboard',
          label: 'Dashboard',
          icon: Home,
          path: '',
          allowedRoles: ['ACCOUNTANT'],
        },
        {
          id: 'accountant-sales',
          label: 'Sales',
          icon: Package,
          path: 'sales',
          allowedRoles: ['ACCOUNTANT'],
        },
        {
          id: 'accountant-products',
          label: 'Products',
          icon: Package,
          path: 'products',
          allowedRoles: ['ACCOUNTANT'],
        },
        {
          id: 'accountant-raw-materials',
          label: 'Raw Materials',
          icon: Package,
          path: 'raw-materials',
          allowedRoles: ['ACCOUNTANT'],
        },
      ],
    },
    {
      id: 'accounting',
      label: 'Accounting',
      allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
      items: [
        {
          id: 'customers',
          label: 'Customers',
          icon: Users,
          path: '/sales/customers',
          allowedRoles: ['ADMIN', 'MANAGER', 'ACCOUNTANT'],
        },
      ],
    },
  ],
};
