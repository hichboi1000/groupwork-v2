import {
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  BellIcon,
  BookOpenIcon,
  PlusCircleIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function QuickActions({ role }) {
  const navigate = useNavigate();

  const actions = {
    student: [
      {
        title: "My Tasks",
        icon: ClipboardDocumentListIcon,
        color: "bg-accent",
        path: "/tasks",
      },
      {
        title: "Join Group",
        icon: UserGroupIcon,
        color: "bg-status-done-bg0",
        path: "/groups",
      },
      {
        title: "Assignments",
        icon: BookOpenIcon,
        color: "bg-accent-dark",
        path: "/assignments",
      },
      {
        title: "Notifications",
        icon: BellIcon,
        color: "bg-accent",
        path: "/notifications",
      },
    ],

    leader: [
      {
        title: "Manage Group",
        icon: UserGroupIcon,
        color: "bg-status-done-bg0",
        path: "/groups",
      },
      {
        title: "My Tasks",
        icon: ClipboardDocumentListIcon,
        color: "bg-accent",
        path: "/tasks?scope=mine",
      },
      {
        title: "Create Task",
        icon: PlusCircleIcon,
        color: "bg-accent",
        path: "/tasks",
      },
      {
        title: "Progress",
        icon: ChartBarIcon,
        color: "bg-accent-dark",
        path: "/progress",
      },
      {
        title: "Assignments",
        icon: BookOpenIcon,
        color: "bg-accent",
        path: "/assignments",
      },
    ],

    rep: [
      {
        title: "Manage Class",
        icon: BuildingLibraryIcon,
        color: "bg-accent",
        path: "/classes",
      },
      {
        title: "My Group",
        icon: UserGroupIcon,
        color: "bg-status-done-bg0",
        path: "/groups",
      },
      {
        title: "My Tasks",
        icon: ClipboardDocumentListIcon,
        color: "bg-accent",
        path: "/tasks?scope=mine",
      },
      {
        title: "Assignments",
        icon: BookOpenIcon,
        color: "bg-status-done-bg0",
        path: "/assignments",
      },
      {
        title: "Progress",
        icon: ChartBarIcon,
        color: "bg-accent-dark",
        path: "/progress",
      },
      {
        title: "Notifications",
        icon: BellIcon,
        color: "bg-accent",
        path: "/notifications",
      },
    ],

    lecturer: [
      {
        title: "Manage Units",
        icon: BuildingLibraryIcon,
        color: "bg-accent",
        path: "/units",
      },
      {
        title: "Post Assignment",
        icon: BookOpenIcon,
        color: "bg-status-done-bg0",
        path: "/assignments",
      },
      {
        title: "Progress",
        icon: ChartBarIcon,
        color: "bg-accent-dark",
        path: "/progress",
      },
      {
        title: "Notifications",
        icon: BellIcon,
        color: "bg-accent",
        path: "/notifications",
      },
    ],
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold text-ink mb-5">
        Quick Actions
      </h2>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {actions[role]?.map((action) => (
          <motion.div
            whileHover={{
              y: -6,
              scale: 1.03,
            }}
            whileTap={{
              scale: 0.98,
            }}
            key={action.title}
            onClick={() => navigate(action.path)}
            className="cursor-pointer bg-surface rounded-[--radius-card] shadow-sm hover:shadow-xl transition-all p-6"
          >
            <div
              className={`w-14 h-14 rounded-[--radius-control] ${action.color} flex items-center justify-center mb-4`}
            >
              <action.icon className="w-7 h-7 text-surface" />
            </div>

            <h3 className="font-semibold text-ink">
              {action.title}
            </h3>

            <p className="text-sm text-muted mt-2">
              Open {action.title.toLowerCase()}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}