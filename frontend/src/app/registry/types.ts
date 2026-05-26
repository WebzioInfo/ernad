import { LucideIcon } from 'lucide-react';

export type UserRole = 
  | 'ADMIN' 
  | 'MANAGER' 
  | 'OPERATOR';

export interface RouteDefinition {
  path: string;
  element: React.LazyExoticComponent<React.FC<any>>;
  index?: boolean;
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
  children?: RouteDefinition[];
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  isComingSoon?: boolean;
  allowedRoles?: UserRole[];
  requiredPermissions?: string[];
  badge?: string | number;
}

export interface SidebarGroup {
  id: string;
  label: string;
  items: SidebarItem[];
  allowedRoles?: UserRole[];
}

export interface ModuleConfig {
  id: string;
  name: string;
  description?: string;
  category: 'CORE' | 'PRODUCTION' | 'ADMINISTRATION' | 'HR' | 'FINANCE' | 'INVENTORY';
  order: number;
  routes: RouteDefinition[];
  sidebarGroups?: SidebarGroup[];
  landingPage?: string;
}
