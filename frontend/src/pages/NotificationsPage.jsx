import { motion } from "framer-motion";
import { useNotifications } from "../contexts/NotificationsContext";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import { CheckIcon } from "@heroicons/react/24/outline";

const TYPE_ICONS = {
  task_assigned: "✅",
  task_updated: "🔄",
  task_overdue: "⚠️",
  group_joined: "🤝",
  assignment_posted: "📋",
  submission_made: "📤",
  group_assigned: "🔗",
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markOneRead, markAllAsRead } = useNotifications();

  if (loading) return <Loading label="Loading notifications…" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Notifications</h1>
          <p className="text-muted mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" icon={CheckIcon} onClick={markAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon="🔔" message="No notifications yet. They'll appear here as things happen." />
      ) : (
        <div className="bg-surface rounded-[--radius-card] border border-border divide-y divide-border overflow-hidden">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              onClick={() => markOneRead(n.id)}
              className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-paper ${
                !n.is_read ? "bg-accent-soft/50" : ""
              }`}
            >
              <div className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.notification_type] || "🔔"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink text-sm">{n.title}</div>
                <div className="text-sm text-muted mt-0.5">{n.message}</div>
                <div className="text-xs text-muted mt-1">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
