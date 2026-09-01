import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageSkeleton } from '@/components/PageSkeleton';
import { DEMO_MODE } from '@/lib/supabase';
import { SplashScreen } from '@/pages/SplashScreen';

const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const AddExpense = lazy(() => import('@/pages/AddExpense'));
const AddIncome = lazy(() => import('@/pages/AddIncome'));
const History = lazy(() => import('@/pages/History'));
const SmsParser = lazy(() => import('@/pages/SmsParser'));
const VoiceInput = lazy(() => import('@/pages/VoiceInput'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Budgets = lazy(() => import('@/pages/Budgets'));
const Recurring = lazy(() => import('@/pages/Recurring'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const Reports = lazy(() => import('@/pages/Reports'));
const Splits = lazy(() => import('@/pages/Splits'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function ProtectedLayout() {
  const user = useStore((s) => s.user);
  const onboarded = useStore((s) => s.onboarded);
  const initialized = useStore((s) => s.initialized);
  const location = useLocation();

  if (!initialized) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (!onboarded && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (onboarded && location.pathname === '/onboarding') return <Navigate to="/" replace />;

  return (
    <AppLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add-expense" element={<AddExpense />} />
          <Route path="/add-income" element={<AddIncome />} />
          <Route path="/history" element={<History />} />
          <Route path="/sms" element={<SmsParser />} />
          <Route path="/voice" element={<VoiceInput />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/splits" element={<Splits />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export default function App() {
  const init = useStore((s) => s.init);
  const user = useStore((s) => s.user);
  const initialized = useStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) init();
  }, [init, initialized]);

  useEffect(() => {
    if (DEMO_MODE) {
      const listener = (e: Event) => {
        e.preventDefault();
      };
      window.addEventListener('contextmenu', listener);
      return () => window.removeEventListener('contextmenu', listener);
    }
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicLayout>
            <Suspense fallback={<SplashScreen />}>
              {user ? <Navigate to="/" replace /> : <Login />}
            </Suspense>
          </PublicLayout>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicLayout>
            <Suspense fallback={<SplashScreen />}>
              <Signup />
            </Suspense>
          </PublicLayout>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicLayout>
            <Suspense fallback={<SplashScreen />}>
              <ForgotPassword />
            </Suspense>
          </PublicLayout>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicLayout>
            <Suspense fallback={<SplashScreen />}>
              <ResetPassword />
            </Suspense>
          </PublicLayout>
        }
      />
      <Route
        path="/onboarding"
        element={
          <PublicLayout>
            <Suspense fallback={<SplashScreen />}>
              <Onboarding />
            </Suspense>
          </PublicLayout>
        }
      />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
