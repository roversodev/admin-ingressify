import { useQuery } from "convex/react";
import { api } from "@/api";
import { useUser } from "@clerk/nextjs";

export type AdminPermission = 
  | 'view_users' | 'manage_users'
  | 'view_events' | 'manage_events'
  | 'view_finances' | 'manage_finances'
  | '*';

export type AdminRole = 'admin' | 'support' | 'finance' | 'superadmin';

export function useAdminPermissions() {
  const { user, isLoaded } = useUser();
  
  const adminStatus = useQuery(api.admin.checkAdminStatus, 
    isLoaded && user?.id ? { userId: user.id } : "skip"
  );

  const isLoading = !isLoaded || adminStatus === undefined;
  const isAdmin = adminStatus?.isAdmin || false;
  const isSuperAdmin = adminStatus?.isSuperAdmin || false;
  const permissions = adminStatus?.permissions || [];
  const role = adminStatus?.role as AdminRole;

  const hasPermission = (permission: AdminPermission | string) => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
  };

  const hasRole = (targetRole: AdminRole) => {
    if (isLoading) return false;
    if (isSuperAdmin) return true;
    return role === targetRole;
  };

  const hasAnyPermission = (permissionList: (AdminPermission | string)[]) => {
    return permissionList.some(p => hasPermission(p));
  };

  const hasAllPermissions = (permissionList: (AdminPermission | string)[]) => {
    return permissionList.every(p => hasPermission(p));
  };

  return {
    isLoading,
    isAdmin,
    isSuperAdmin,
    role,
    permissions,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions
  };
}