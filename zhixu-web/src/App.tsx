import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './app/AuthContext';
import { ToastProvider } from './app/ToastContext';
import { TopicsProvider } from './app/TopicsContext';
import { AppShell } from './layout/AppShell';
import { AuthPage } from './pages/auth/AuthPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { CreatePage } from './pages/create/CreatePage';
import { RoadmapPage } from './pages/roadmap/RoadmapPage';
import { NodeDetailPage } from './pages/node/NodeDetailPage';
import { StatsPage } from './pages/stats/StatsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <TopicsProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <AuthPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestOnly>
                    <AuthPage register />
                  </GuestOnly>
                }
              />
              <Route
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/roadmap" element={<RoadmapPage />} />
                <Route path="/node/:nodeId" element={<NodeDetailPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/create" element={<CreatePage />} />
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </TopicsProvider>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
