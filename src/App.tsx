import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Home from '@/pages/Home';
import AuthPage from '@/pages/AuthPage';
import SearchPage from '@/pages/SearchPage';
import MapView from '@/pages/MapView';
import GymDetails from '@/pages/GymDetails';
import MyBookings from '@/pages/MyBookings';
import RegisterGym from '@/pages/RegisterGym';
import AdminRoute from '@/components/AdminRoute';
import { clearStoredData, useStoredQuery } from '@/lib/useStoredQuery';
import CurrencyProvider from '@/lib/CurrencyProvider';

// Admin screens load only when an admin opens them.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminBookings = lazy(() => import('@/pages/admin/AdminBookings'));
const AdminGyms = lazy(() => import('@/pages/admin/AdminGyms'));
const AdminGymEdit = lazy(() => import('@/pages/admin/AdminGymEdit'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'));
const AdminInvites = lazy(() => import('@/pages/admin/AdminInvites'));
const AdminRegistrations = lazy(() => import('@/pages/admin/AdminRegistrations'));
const AdminRegistrationDetail = lazy(() => import('@/pages/admin/AdminRegistrationDetail'));

// Gym owner screens, loaded only for owners.
const VendorLayout = lazy(() => import('@/pages/vendor/VendorLayout'));
const VendorProfile = lazy(() => import('@/pages/vendor/VendorProfile'));
const VendorBookings = lazy(() => import('@/pages/vendor/VendorBookings'));
const VendorReviews = lazy(() => import('@/pages/vendor/VendorReviews'));

const Loading = <div className="site auth-loading"><span className="auth-spinner" /></div>;

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="site auth-loading"><span className="auth-spinner" /></div>;
  if (!isSignedIn) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const [query, setQuery] = useStoredQuery();
  const { isLoaded, isSignedIn } = useAuth();

  // Saved data lives only while someone is signed in: clear it on sign-out (in any tab)
  // and when a session expired while the browser was closed.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      clearStoredData();
      setQuery(null);
    }
  }, [isLoaded, isSignedIn, setQuery]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/plan" element={
        <ProtectedRoute>
          <SearchPage initial={query} onSearch={setQuery} />
        </ProtectedRoute>
      } />
      <Route path="/map" element={
        <ProtectedRoute>
          <MapView query={query} />
        </ProtectedRoute>
      } />
      <Route path="/gym/:gymId" element={
        <ProtectedRoute>
          <GymDetails />
        </ProtectedRoute>
      } />
      <Route path="/bookings" element={
        <ProtectedRoute>
          <MyBookings />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminRoute>
            <Suspense fallback={<div className="site auth-loading"><span className="auth-spinner" /></div>}>
              <AdminLayout />
            </Suspense>
          </AdminRoute>
        </ProtectedRoute>
      }>
        <Route index element={<AdminBookings />} />
        <Route path="gyms" element={<AdminGyms />} />
        <Route path="gyms/:gymId" element={<AdminGymEdit />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="invites" element={<AdminInvites />} />
        <Route path="registrations" element={<AdminRegistrations />} />
        <Route path="registrations/:gymId" element={<AdminRegistrationDetail />} />
      </Route>
      <Route path="/register/:token" element={<RegisterGym />} />
      <Route path="/vendor" element={
        <ProtectedRoute>
          <Suspense fallback={Loading}>
            <VendorLayout />
          </Suspense>
        </ProtectedRoute>
      }>
        <Route index element={<VendorProfile />} />
        <Route path="bookings" element={<VendorBookings />} />
        <Route path="reviews" element={<VendorReviews />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <CurrencyProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </CurrencyProvider>
  );
}
