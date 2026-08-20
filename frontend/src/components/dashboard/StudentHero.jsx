import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import CodeChip from "../ui/CodeChip";

function formatDue(dateStr) {
  const d = new Date(dateStr);
  const days = Math.ceil((d - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

/**
 * Student's #1 question: "what do I need to do next?" — this answers
 * it in one glance instead of a generic stats grid.
 *
 * Reused as-is for the leader/rep "My Tasks" personal section on the
 * dashboard (see DashboardPage) — same shape of question, same UI.
 * `tasksPath` lets those callers point "Open my tasks" at
 * /tasks?scope=mine instead of the default /tasks (which for a leader/
 * rep means the whole group/class management list, not their own task).
 */
export default function StudentHero({ stats, tasksPath = "/tasks" }) {
  const navigate = useNavigate();
  const { next_task, group_name, group_code } = stats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-[--radius-card] border border-border p-6 mb-6"
    >
      {!group_name ? (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted uppercase tracking-[0.12em] font-medium mb-1">Up next</p>
            <h2 className="font-display text-xl font-semibold text-ink">You're not in a group yet</h2>
            <p className="text-sm text-muted mt-1">Join with the code your leader shared, and your tasks will show up here.</p>
          </div>
          <Button onClick={() => navigate("/groups")}>Join a group</Button>
        </div>
      ) : next_task ? (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted uppercase tracking-[0.12em] font-medium mb-1">Up next</p>
            <h2 className="font-display text-xl font-semibold text-ink">{next_task.title}</h2>
            <div className="mt-2">
              <Badge variant={next_task.is_overdue ? "overdue" : "progress"}>{formatDue(next_task.due_date)}</Badge>
            </div>
          </div>
          <Button onClick={() => navigate(tasksPath)}>Open my tasks</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-muted uppercase tracking-[0.12em] font-medium mb-1">Up next</p>
            <h2 className="font-display text-xl font-semibold text-ink">Nothing pending — you're caught up</h2>
            <p className="text-sm text-muted mt-1">{group_name}{group_code ? " · " : ""}{group_code && <CodeChip code={group_code} size="sm" copyable={false} />}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/groups")}>View my group</Button>
        </div>
      )}
    </motion.div>
  );
}
