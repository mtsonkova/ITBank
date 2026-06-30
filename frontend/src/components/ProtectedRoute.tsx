import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Role } from '@banking-simulator/shared-types';
import { useAuth } from '../contexts/AuthContext';

const ROLE_HOME: Record<Role, string> = {
  customer: '/customer/dashboard',
  account_manager: '/manager/dashboard',
  admin: '/admin/overview',
};

interface Props {
  allowedRoles: Role[];
  children: ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: Props) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <>{children}</>;
}
