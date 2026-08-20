import { motion, AnimatePresence } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

import {
  HomeIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  BellIcon,
  ChartBarIcon,
  BuildingLibraryIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

// Each role gets only the nav items that are actually relevant to them.
// Add/remove items here — Sidebar and QuickActions should stay in sync.
const MENU_BY_ROLE = {
  // Progress is merged into "My Group" for student/leader (it's always
  // about their own group), so it's dropped here to keep the nav short.
  // Rep/lecturer keep it — for them it's a cross-group comparison tool,
  // a genuinely different job.
  student: [
    { name: "Dashboard", path: "/", icon: HomeIcon },
    { name: "My Tasks", path: "/tasks", icon: ClipboardDocumentListIcon },
    { name: "My Group", path: "/groups", icon: UserGroupIcon },
    { name: "Assignments", path: "/assignments", icon: BookOpenIcon },
    { name: "Notifications", path: "/notifications", icon: BellIcon },
  ],
  leader: [
    { name: "Dashboard", path: "/", icon: HomeIcon },
    { name: "Tasks", path: "/tasks", icon: ClipboardDocumentListIcon },
    { name: "My Group", path: "/groups", icon: UserGroupIcon },
    { name: "Assignments", path: "/assignments", icon: BookOpenIcon },
    { name: "Notifications", path: "/notifications", icon: BellIcon },
  ],
  rep: [
    { name: "Dashboard", path: "/", icon: HomeIcon },
    { name: "My Group", path: "/groups", icon: UserGroupIcon },
    { name: "Classes", path: "/classes", icon: BuildingLibraryIcon },
    { name: "Units", path: "/units", icon: BookOpenIcon },
    { name: "Assignments", path: "/assignments", icon: ClipboardDocumentListIcon },
    { name: "Progress", path: "/progress", icon: ChartBarIcon },
    { name: "Notifications", path: "/notifications", icon: BellIcon },
  ],
  lecturer: [
    { name: "Dashboard", path: "/", icon: HomeIcon },
    { name: "Units", path: "/units", icon: BookOpenIcon },
    { name: "Assignments", path: "/assignments", icon: ClipboardDocumentListIcon },
    { name: "Progress", path: "/progress", icon: ChartBarIcon },
    { name: "Notifications", path: "/notifications", icon: BellIcon },
  ],
};

function SidebarContent({ onNavigate }) {
  const { user } = useAuth();

  const initials =
    user?.avatar_initials ||
    (user?.first_name?.[0] || "") + (user?.last_name?.[0] || "") ||
    user?.username?.slice(0, 2).toUpperCase();

  const menu = MENU_BY_ROLE[user?.role] || MENU_BY_ROLE.student;

  return (
    <>
      {/* LOGO */}
      <div className="px-8 py-7 border-b border-border">
        <h1 className="font-display text-2xl font-semibold text-ink">GroupWork</h1>
        <p className="text-xs text-muted mt-1 uppercase tracking-[0.12em]">Term Planner</p>
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 p-4 overflow-y-auto">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.name} to={item.path} onClick={onNavigate} end={item.path === "/"}>
              {({ isActive }) => (
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-4 w-full rounded-[--radius-control] px-4 py-3 mb-2 transition-colors ${
                    isActive
                      ? "bg-ink text-surface"
                      : "hover:bg-accent-soft/60 text-ink-soft"
                  }`}
                >
                  <Icon className="w-6 h-6 shrink-0" />
                  <span className="font-medium">{item.name}</span>
                </motion.div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* USER CARD */}
      <div className="border-t border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-ink flex items-center justify-center text-surface font-display font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{user?.first_name || user?.username}</div>
            <div className="text-xs text-muted capitalize">{user?.role}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-72 bg-surface border-r border-border flex-col min-h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* MOBILE SIDEBAR (slide-over) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-ink/50 z-50 lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="fixed inset-y-0 left-0 w-72 bg-surface z-50 flex flex-col lg:hidden shadow-2xl"
            >
              <button
                onClick={onClose}
                className="absolute top-5 right-4 p-2 rounded-lg hover:bg-status-todo-bg"
                aria-label="Close menu"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <SidebarContent onNavigate={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
