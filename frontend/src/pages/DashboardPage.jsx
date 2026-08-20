import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationsContext";
import { getDashboardStats } from "../api/client";

import WelcomeBanner from "../components/dashboard/WelcomeBanner";
import QuickActions from "../components/dashboard/QuickActions";
import StudentHero from "../components/dashboard/StudentHero";
import LeaderHero from "../components/dashboard/LeaderHero";
import StaffHero from "../components/dashboard/StaffHero";import StatCard from "../components/ui/StatCard";
import Loading from "../components/ui/Loading";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import {
  ClipboardDocumentListIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BookOpenIcon,
  DocumentTextIcon,
  InboxArrowDownIcon,
  BellIcon,
} from "@heroicons/react/24/outline";

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications } = useNotifications();

  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboardStats()
      .then((res) => setStats(res.data))
      .catch(() => setError("Could not load dashboard data."));
  }, []);

  const role = user?.role;
  const isStaff = role === "lecturer" || role === "rep";

  const pct = stats?.tasks_total > 0 ? Math.round((stats.tasks_done / stats.tasks_total) * 100) : 0;

  if (error) return <Alert type="error">{error}</Alert>;

  if (!stats) {
    return (
      <>
        <WelcomeBanner />
        <Loading label="Loading dashboard…" />
      </>
    );
  }

  return (
    <div>
      <WelcomeBanner />

      {/* ROLE-SPECIFIC HERO — answers each role's actual #1 question,
          instead of routing everyone through the same generic stats grid. */}
      {role === "student" && <StudentHero stats={stats} />}
      {role === "leader" && <LeaderHero stats={stats} />}
      {isStaff && <StaffHero stats={stats} />}

      {/* PERSONAL WORK — separate from the management view above. A leader
          or rep is still a participant in a group's actual coursework, not
          just its manager, and previously had nowhere on the dashboard that
          showed just "what's on ME" the way a student's dashboard does.
          Reuses StudentHero (same question, same UI) pointed at their own
          group's task data instead of a whole-group/class view. */}
      {(role === "leader" || role === "rep") && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-[0.12em] mb-3">
            Your Personal Work
          </h2>
          <StudentHero
            stats={{ group_name: stats.group_name, group_code: stats.group_code, next_task: stats.my_next_task }}
            tasksPath="/tasks?scope=mine"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <p className="text-muted capitalize">
          Role: {role}
          {stats.group_name && ` · ${stats.group_name}`}
        </p>
      </div>

      {/* STATS — different cards per role, matching what dashboard_stats actually returns */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {isStaff ? (
          <>
            <StatCard icon={<AcademicCapIcon className="w-6 h-6" />} title="Units" value={stats.units_count} change="Assigned units" color="blue" />
            <StatCard icon={<UserGroupIcon className="w-6 h-6" />} title="Groups" value={stats.total_groups} change="Active groups" color="purple" />
            <StatCard icon={<BookOpenIcon className="w-6 h-6" />} title="Students" value={stats.total_users} change="Students managed" color="green" />
            <StatCard icon={<DocumentTextIcon className="w-6 h-6" />} title="Assignments" value={stats.total_assignments} change="Published" color="orange" />
            <StatCard icon={<ClipboardDocumentListIcon className="w-6 h-6" />} title="Tasks" value={stats.total_tasks} change="Across groups" color="blue" />
            <StatCard icon={<InboxArrowDownIcon className="w-6 h-6" />} title="Submissions" value={stats.total_submissions} change="Received" color="green" />
          </>
        ) : (
          <>
            <StatCard icon={<ClipboardDocumentListIcon className="w-6 h-6" />} title="Total Tasks" value={stats.tasks_total} change="Assigned" color="blue" />
            <StatCard icon={<ClipboardDocumentListIcon className="w-6 h-6" />} title="To Do" value={stats.tasks_todo} change="Waiting" color="orange" />
            <StatCard icon={<ClipboardDocumentListIcon className="w-6 h-6" />} title="In Progress" value={stats.tasks_in_progress} change="Active" color="purple" />
            <StatCard icon={<ClipboardDocumentListIcon className="w-6 h-6" />} title="Completed" value={stats.tasks_done} change="Finished" color="green" />
            {role === "leader" && (
              <StatCard icon={<UserGroupIcon className="w-6 h-6" />} title="Members" value={stats.member_count} change="Group size" color="blue" />
            )}
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mt-8">
        {/* PROGRESS — students & leaders only, matches original logic */}
        {!isStaff && stats.tasks_total > 0 && (
          <div className="lg:col-span-2 bg-surface rounded-[--radius-card] border border-border p-6">
            <h3 className="font-semibold text-ink mb-1">Overall Progress</h3>
            <div className="text-3xl font-bold text-accent-dark mb-4">{pct}%</div>
            <div className="h-2.5 rounded-full bg-status-todo-bg overflow-hidden mb-5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full bg-status-done rounded-full"
              />
            </div>
            <div className="flex items-center gap-6 text-sm">
              <span className="text-status-done">✅ {stats.tasks_done} completed</span>
              <span className="text-status-progress">⏳ {stats.tasks_in_progress} in progress</span>
              <span className="text-muted">📋 {stats.tasks_todo} remaining</span>
            </div>
          </div>
        )}

        {/* RECENT NOTIFICATIONS — live, feeds from the same context as the topbar bell */}
        <div className={`bg-surface rounded-[--radius-card] border border-border p-6 ${isStaff ? "lg:col-span-3" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-muted" />
              Recent Activity
            </h3>
            <button
              onClick={() => navigate("/notifications")}
              className="text-sm text-accent-dark hover:text-accent-dark font-medium"
            >
              View all
            </button>
          </div>

          {notifications.length === 0 ? (
            <EmptyState icon="🔔" message="Nothing yet — you'll see updates here as things happen." />
          ) : (
            <div className="divide-y divide-border">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-3">
                  {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                  <div className={`min-w-0 ${n.is_read ? "ml-5" : ""}`}>
                    <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                    <p className="text-xs text-muted mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QuickActions role={role} />
    </div>
  );
}
