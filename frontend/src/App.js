import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import PartsPage from './pages/PartsPage';
import PartDetailPage from './pages/PartDetailPage';
import MilesPage from './pages/MilesPage';
import HistoryPage from './pages/HistoryPage';
import ReportsPage from './pages/ReportsPage';
import UploadPage from './pages/UploadPage';
import AdminPage from './pages/AdminPage';
import CarsPage from './pages/CarsPage';
import PendingApprovalPage from './pages/PendingApprovalPage';

/**
 * Guard for all main app routes.
 * - Not logged in → /login
 * - Logged in but pending approval → /pending
 * - Otherwise → render the page
 */
function RequireAuth({ children }) {
  const { user, isPending } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isPending) return <Navigate to="/pending" replace />;
  return children;
}

/**
 * Guard for the /pending route itself.
 * - Not logged in → /login
 * - Logged in and NOT pending (already approved) → /
 * - Pending → show the page
 */
function RequirePending({ children }) {
  const { user, isPending } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!isPending) return <Navigate to="/" replace />;
  return children;
}

/**
 * Admin page is accessible to all authenticated users:
 * - Admin: can view AND edit users (change roles/status)
 * - Normal: can view users (read-only)
 * - Readonly: can view users (read-only)
 */
function RequireUsersAccess({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Pending approval page — shown to users who haven't been activated yet */}
      <Route
        path="/pending"
        element={
          <RequirePending>
            <PendingApprovalPage />
          </RequirePending>
        }
      />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="cars" element={<CarsPage />} />
        <Route path="cars/:carId/parts" element={<PartsPage />} />
        <Route path="cars/:carId/parts/:partId" element={<PartDetailPage />} />
        <Route path="cars/:carId/miles" element={<MilesPage />} />
        <Route path="cars/:carId/history" element={<HistoryPage />} />
        <Route path="cars/:carId/reports" element={<ReportsPage />} />
        <Route path="cars/:carId/upload" element={<UploadPage />} />
        <Route
          path="admin"
          element={
            <RequireUsersAccess>
              <AdminPage />
            </RequireUsersAccess>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
