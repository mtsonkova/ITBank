import { useNavigate } from 'react-router-dom';
import type { Role } from '@banking-simulator/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';

const ROLE_LABELS: Record<Role, string> = {
  customer: 'Customer',
  account_manager: 'Account Manager',
  admin: 'Admin',
};

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0] ?? '')
    .join('')
    .toUpperCase();
}

interface Props {
  pageTitle: string;
}

export function Header({ pageTitle }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // best-effort — always log out locally
    }
    logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <header className="h-[62px] bg-brand-deep flex items-center px-6 gap-4 shrink-0">
      {/* Page title */}
      <h1 className="font-display font-semibold text-[18px] text-white leading-none">
        {pageTitle}
      </h1>

      {/* Search pill — placeholder, functional in M6 */}
      <div className="flex-1 max-w-xs">
        <div className="rounded-full bg-white/10 text-white/50 px-4 py-1.5 text-sm cursor-default select-none">
          Search…
        </div>
      </div>

      {/* User block */}
      <div className="ml-auto flex items-center gap-3">
        {/* Initials avatar */}
        <div className="w-8 h-8 rounded-full bg-avatar-bg text-avatar-text text-sm font-semibold flex items-center justify-center shrink-0">
          {getInitials(user.fullName)}
        </div>

        {/* Name + role */}
        <div className="hidden sm:block">
          <div
            data-testid="user-display-name"
            className="text-white text-[13px] leading-tight font-medium"
          >
            {user.fullName}
          </div>
          <div className="text-[#BFE6F2] text-[11px] leading-tight">
            {ROLE_LABELS[user.role]}
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          data-testid="btn-logout"
          onClick={handleLogout}
          className="ml-1 text-white/80 hover:text-white text-sm border border-white/20 hover:border-white/40 rounded px-3 py-1 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
