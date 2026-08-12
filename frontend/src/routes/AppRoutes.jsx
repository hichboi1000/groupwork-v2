import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// Route-level code splitting: a student never needs the Units/Classes
// management code, a lecturer never needs most of Tasks. Lazy-loading
// means each role only downloads the JS for the pages they actually
// visit, instead of the whole app up front — this matters most on the
// phone/mobile-data usage this app is meant to survive a whole degree on.
const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const RegisterPage = lazy(() => import("../pages/RegisterPage"));

const TasksPage = lazy(() => import("../pages/TasksPage"));
const UnitsManagementPage = lazy(() => import("../pages/UnitsManagementPage"));
const AssignmentsPage = lazy(() => import("../pages/AssignmentsPage"));
const GroupPage = lazy(() => import("../pages/GroupPage"));
const ProgressPage = lazy(() => import("../pages/ProgressPage"));
const NotificationsPage = lazy(() => import("../pages/NotificationsPage"));
const ClassManagementPage = lazy(() => import("../pages/ClassManagementPage"));

import AppLayout from "../components/layout/AppLayout";
import Loading from "../components/ui/Loading";

import { useAuth } from "../contexts/AuthContext";


function Protected({ children }) {

  const { user, loading } = useAuth();


  if (loading) {
    return <div>Loading...</div>;
  }


  if (!user) {
    return <Navigate to="/login" />;
  }


  return children;

}



function LayoutRoute({ children }) {

  return (
    <Protected>
      <AppLayout>
        <Suspense fallback={<Loading full label="Loading page…" />}>
          {children}
        </Suspense>
      </AppLayout>
    </Protected>
  );

}



export default function AppRoutes() {


  return (

    <Routes>


      {/* PUBLIC ROUTES */}

      <Route
        path="/login"
        element={<Suspense fallback={<Loading full />}><LoginPage /></Suspense>}
      />


      <Route
        path="/register"
        element={<Suspense fallback={<Loading full />}><RegisterPage /></Suspense>}
      />




      {/* APPLICATION ROUTES */}


      <Route
        path="/"
        element={
          <LayoutRoute>
            <DashboardPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/tasks"
        element={
          <LayoutRoute>
            <TasksPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/units"
        element={
          <LayoutRoute>
            <UnitsManagementPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/assignments"
        element={
          <LayoutRoute>
            <AssignmentsPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/groups"
        element={
          <LayoutRoute>
            <GroupPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/progress"
        element={
          <LayoutRoute>
            <ProgressPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/notifications"
        element={
          <LayoutRoute>
            <NotificationsPage />
          </LayoutRoute>
        }
      />



      <Route
        path="/classes"
        element={
          <LayoutRoute>
            <ClassManagementPage />
          </LayoutRoute>
        }
      />



      {/* FALLBACK - MUST BE LAST */}

      <Route
        path="*"
        element={<Navigate to="/" />}
      />


    </Routes>

  );

}