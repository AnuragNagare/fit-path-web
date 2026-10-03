import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import Home from '@/pages/Home';
import AuthPage from '@/pages/AuthPage';
import RoutePlanner from '@/pages/RoutePlanner';
import MapView from '@/pages/MapView';
import GymDetails from '@/pages/GymDetails';
import { clearStoredData, useStoredQuery } from '@/lib/useStoredQuery';

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
          <RoutePlanner initial={query} onSearch={setQuery} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
