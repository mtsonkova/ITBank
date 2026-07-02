import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Role } from '@banking-simulator/shared-types';
import { useAuth } from '../../contexts/AuthContext';
import { ChangePasswordModal } from '../modals/ChangePasswordModal';

interface NavItem {
  label: string;
  path: string;
  testId: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  customer: [
    { label: 'Dashboard',           path: '/customer/dashboard', testId: 'dashboard' },
    { label: 'Accounts',            path: '/customer/accounts',  testId: 'accounts'  },
    { label: 'Cards',               path: '/customer/cards',     testId: 'cards'     },
    { label: 'Transfer & Pay',      path: '/customer/transactions', testId: 'transfer'  },
    { label: 'Spend',               path: '/customer/spend',     testId: 'spend'     },
    { label: 'Transaction History', path: '/customer/history',   testId: 'history'   },
    { label: 'My Requests',         path: '/customer/requests',  testId: 'requests'  },
  ],
  account_manager: [
    { label: 'Dashboard',           path: '/manager/dashboard',  testId: 'dashboard' },
    { label: 'My Clients',          path: '/manager/clients',    testId: 'clients'   },
    { label: 'Approvals',           path: '/manager/approvals',  testId: 'approvals' },
    { label: 'Transaction History', path: '/manager/history',    testId: 'history'   },
  ],
  admin: [
    { label: 'Overview',            path: '/admin/overview',     testId: 'overview'  },
    { label: 'Approvals',           path: '/admin/approvals',    testId: 'approvals' },
    { label: 'User Management',     path: '/admin/users',        testId: 'users'     },
    { label: 'Transaction History', path: '/admin/history',      testId: 'history'   },
  ],
};

export function Sidebar() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  if (!user) return null;

  const items = NAV_ITEMS[user.role];

  return (
    <>
      <aside
        data-testid="nav-sidebar"
        className="w-[252px] shrink-0 h-screen bg-white border-r border-[#E3EEF3] flex flex-col"
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#EEF4F7]">
          <span className="font-display font-bold italic text-xl tracking-tight">
            <span className="text-brand-primary">IT</span>
            <span className="text-[#0F172A]"> Bank</span>
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              data-testid={`nav-link-${item.testId}`}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-nav-activeBg text-nav-activeText font-bold'
                    : 'text-nav-inactiveText hover:bg-nav-hoverBg font-normal'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Change password — pinned bottom */}
        <div className="px-3 pb-4 pt-2 border-t border-[#EEF4F7]">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="w-full text-left px-3 py-2 rounded text-sm text-nav-inactiveText hover:bg-nav-hoverBg transition-colors"
          >
            Change password
          </button>
        </div>
      </aside>

      {modalOpen && <ChangePasswordModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
