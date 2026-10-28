import React, { useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './stores/useThemeStore.ts';
import { useFamilyStore } from './stores/useFamilyStore.ts';
import { ensureAuthSession } from './utils/api.ts';
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

function RouteFallback() {
  return <PageSkeleton />;
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

              {/* Application Layout for Family Tree & Super Admin Dashboard */}
              <Route element={<AppLayout />}>
                <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
                <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
                <Route path="/family/tree" element={<FamilyTreePage />} />
                <Route path="/tree" element={<FamilyTreePage />} />
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
