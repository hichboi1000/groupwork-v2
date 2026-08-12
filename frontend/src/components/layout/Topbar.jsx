import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import { useNavigate } from "react-router-dom";

import {
  BellIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

// What the primary "New" action does, per role. Each target page reads
// the `?new=1` query param and opens its create modal automatically.
const NEW_ACTION_BY_ROLE = {
  student: { label: "Join Group", path: "/groups" },
  leader: { label: "New Task", path: "/tasks?new=1" },
  rep: { label: "New Class", path: "/classes?new=1" },
  lecturer: { label: "New Unit", path: "/units?new=1" },
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Topbar({ onOpenMobileMenu = () => {} }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, connected, markOneRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  // Click-outside handling so both dropdowns behave like normal UI
  // (open on click, stay open until you click elsewhere or an item).
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials =
    user?.avatar_initials ||
    (user?.first_name?.[0] || "") + (user?.last_name?.[0] || "") ||
    user?.username?.slice(0, 2).toUpperCase();

  const newAction = NEW_ACTION_BY_ROLE[user?.role] || NEW_ACTION_BY_ROLE.student;

  return (
    <header className="sticky top-0 z-40 h-20 bg-surface/80 backdrop-blur-md border-b border-border px-4 sm:px-8 flex items-center justify-between gap-4">
      {/* LEFT */}
      <div className="flex items-center gap-5 flex-1 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg hover:bg-status-todo-bg shrink-0"
          aria-label="Open menu"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>

        <div className="relative w-full max-w-96 hidden sm:block">
          <MagnifyingGlassIcon className="absolute left-4 top-3 w-5 h-5 text-muted" />
          <input
            type="text"
            placeholder="Search tasks, groups, assignments..."
            className="w-full rounded-[--radius-control] border border-border-strong bg-paper py-2.5 pl-11 pr-4 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate(newAction.path)}
          className="hidden md:flex items-center gap-2 bg-accent hover:bg-accent-dark text-surface px-4 py-2 rounded-[--radius-control] transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          {newAction.label}
        </motion.button>

        {/* NOTIFICATIONS */}
        <div className="relative" ref={notifRef}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-[--radius-control] hover:bg-status-todo-bg"
            aria-label="Notifications"
          >
            <BellIcon className="w-6 h-6 text-ink-soft" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-status-overdue text-surface text-xs flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-surface border border-border rounded-[--radius-control] shadow-lg z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="font-semibold text-ink flex items-center gap-2">
                    Notifications
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-status-done" : "bg-border-strong"}`}
                      title={connected ? "Live" : "Reconnecting…"}
                    />
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-accent-dark hover:text-accent-dark font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted">
                    You're all caught up
                  </div>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markOneRead(n.id);
                        setNotifOpen(false);
                        navigate("/notifications");
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-border hover:bg-paper transition-colors ${
                        !n.is_read ? "bg-accent-soft/50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                          <p className="text-xs text-muted line-clamp-2">{n.message}</p>
                          <p className="text-xs text-muted mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}

                <button
                  onClick={() => {
                    setNotifOpen(false);
                    navigate("/notifications");
                  }}
                  className="w-full text-center text-sm text-accent-dark hover:text-accent-dark font-medium py-3"
                >
                  View all
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* USER DROPDOWN — click based, not hover, so it doesn't vanish on the way there */}
        <div className="relative" ref={userMenuRef}>
          <motion.button
            whileHover={{ scale: 1.03 }}
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-3 cursor-pointer rounded-[--radius-control] px-2 py-1 hover:bg-status-todo-bg"
          >
            <div className="w-11 h-11 rounded-full bg-ink flex items-center justify-center text-surface font-display font-semibold shrink-0">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <div className="font-semibold">{user?.first_name || user?.username}</div>
              <div className="text-sm text-muted capitalize">{user?.role}</div>
            </div>
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-[--radius-control] shadow-lg p-2 z-50"
              >
                <div className="px-3 py-2 text-xs text-muted border-b border-border mb-1 capitalize">
                  Signed in as {user?.role}
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg hover:bg-status-overdue-bg text-status-overdue"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
