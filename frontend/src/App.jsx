import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <AppRoutes />
      </NotificationsProvider>
    </AuthProvider>
  );
}
