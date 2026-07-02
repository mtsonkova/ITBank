import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import AccountsPage from './pages/customer/AccountsPage';
import CardsPage from './pages/customer/CardsPage';
import TransferPage from './pages/customer/TransferPage';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import AdminOverview from './pages/admin/AdminOverview';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/customer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer/accounts"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <AccountsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer/cards"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <CardsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/customer/transactions"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <TransferPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manager/dashboard"
            element={
              <ProtectedRoute allowedRoles={['account_manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminOverview />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
