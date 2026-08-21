import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "react-router-dom";

import AppLayout from "../components/layout/AppLayout";
import Loading from "../components/ui/Loading";
import { useAuth } from "../contexts/AuthContext";

// Route-level code splitting: a student never needs the Units/Classes
// management code, a lecturer never needs most of Tasks. Lazy-loading
// means each role only downloads the JS for the pages they actually
// visit, instead of the whole app up front — this matters most on the
// phone/mobile-data usage this app is meant to survive a whole degree on.
const LoginPage = lazy(() => import("../pages/LoginPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));

// Every authenticated page shares the exact same wrapper (auth guard +
// layout chrome + lazy-load fallback) and differs only in path/component,
// so they're described here as data and rendered with one map() below
// instead of one hand-written <Route> block per page.
const APP_PAGES = [
  { path: "/", Page: lazy(() => import("../pages/DashboardPage")) },
  { path: "/tasks", Page: lazy(() => import("../pages/TasksPage")) },
  { path: "/units", Page: lazy(() => import("../pages/UnitsManagementPage")) },
  { path: "/assignments", Page: lazy(() => import("../pages/AssignmentsPage")) },
  { path: "/groups", Page: lazy(() => import("../pages/GroupPage")) },
  { path: "/progress", Page: lazy(() => import("../pages/ProgressPage")) },
  { path: "/notifications", Page: lazy(() => import("../pages/NotificationsPage")) },
  { path: "/classes", Page: lazy(() => import("../pages/ClassManagementPage")) },
];

const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
};

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading full label="Loading…" />;
  return user ? children : <Navigate to="/login" replace />;
}

function LayoutRoute({ children }) {
  const location = useLocation();
  return (
    <Protected>
      <AppLayout>
        <Suspense fallback={<Loading full label="Loading page…" />}>
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} {...pageTransition}>
              {children}
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </AppLayout>
    </Protected>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/login" element={<Suspense fallback={<Loading full />}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<Loading full />}><RegisterPage /></Suspense>} />

      {/* APPLICATION ROUTES — one data-driven block instead of a
          hand-written <Route> per page (was ~140 lines, same behavior). */}
      {APP_PAGES.map(({ path, Page }) => (
        <Route key={path} path={path} element={<LayoutRoute><Page /></LayoutRoute>} />
      ))}

      {/* FALLBACK — MUST BE LAST */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
