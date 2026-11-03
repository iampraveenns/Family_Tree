import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useThemeStore } from './stores/useThemeStore.ts';
import { useFamilyStore } from './stores/useFamilyStore.ts';
import { ensureAuthSession, setAuthTokens } from './utils/api.ts';
import { ThemeProvider } from './components/ui/ThemeProvider.tsx';
import { ToastContainer } from './components/ui/ToastContainer.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx';
import { PageSkeleton } from './components/ui/PageSkeleton.tsx';
import { AppLayout } from './layouts/AppLayout.tsx';
import { RegisterPage } from './pages/public/RegisterPage.tsx';

// Family Tree Page (Lazy Loaded)
const FamilyTreePage = React.lazy(() =>
  import('./pages/family/FamilyTreePage.tsx').then((m) => ({ default: m.FamilyTreePage }))
);

const SuperAdminDashboard = React.lazy(() =>
  import('./pages/admin/SuperAdminDashboard.tsx').then((m) => ({ default: m.SuperAdminDashboard }))
);

const MasterAdminAuthPage = React.lazy(() =>
  import('./pages/admin/MasterAdminAuthPage.tsx').then((m) => ({ default: m.MasterAdminAuthPage }))
);

function RouteFallback() {
  return <PageSkeleton />;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const role = typeof localStorage !== 'undefined' ? (localStorage.getItem('familyroots_user_role') || '').toUpperCase() : '';
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('familyroots_access_token') : null;

  if (role !== 'SUPER_ADMIN' || !token) {
    return <Navigate to="/auth/masterlogin" replace />;
  }

  return <>{children}</>;
}

function FamilyTreeRoute({ children }: { children: React.ReactNode }) {
  const role = typeof localStorage !== 'undefined' ? (localStorage.getItem('familyroots_user_role') || '').toUpperCase() : '';
  const isImpersonating = typeof localStorage !== 'undefined' && localStorage.getItem('familyroots_master_impersonation');
  if (role === 'SUPER_ADMIN' && !isImpersonating) {
    return <Navigate to="/master-admin/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { isDark } = useThemeStore();
  const { fetchFamilyTree } = useFamilyStore();

  useEffect(() => {
    let mounted = true;
    async function initApp() {
      await ensureAuthSession();
      if (mounted) {
        await fetchFamilyTree();
      }
    }
    initApp();
    return () => {
      mounted = false;
    };
  }, [fetchFamilyTree]);

  // Always enforce pure light theme across the application
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* 1st Page: Signup / Registration */}
              <Route path="/" element={<RegisterPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/signup" element={<RegisterPage />} />
              <Route path="/login" element={<RegisterPage />} />
              <Route path="/auth/masterlogin" element={<MasterAdminAuthPage />} />
              <Route path="/masterlogin" element={<MasterAdminAuthPage />} />

              {/* Application Layout for Family Tree & Master Admin Dashboard */}
              <Route element={<AppLayout />}>
                <Route
                  path="/master-admin/dashboard"
                  element={
                    <SuperAdminRoute>
                      <SuperAdminDashboard />
                    </SuperAdminRoute>
                  }
                />
                <Route path="/master-admin" element={<Navigate to="/master-admin/dashboard" replace />} />
                <Route path="/super-admin/dashboard" element={<Navigate to="/master-admin/dashboard" replace />} />
                <Route path="/super-admin" element={<Navigate to="/master-admin/dashboard" replace />} />
                <Route
                  path="/family/tree"
                  element={
                    <FamilyTreeRoute>
                      <FamilyTreePage />
                    </FamilyTreeRoute>
                  }
                />
                <Route
                  path="/tree"
                  element={
                    <FamilyTreeRoute>
                      <FamilyTreePage />
                    </FamilyTreeRoute>
                  }
                />
                <Route path="/dashboard" element={<Navigate to="/family/tree" replace />} />
              </Route>

              {/* All other routes fallback to Signup or Family Tree */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <ToastContainer />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
