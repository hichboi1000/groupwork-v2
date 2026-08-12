import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import CodeChip from "../ui/CodeChip";

/**
 * Leader's #1 question: "who's behind, and is anything ready to hand in?"
 * This is the screen that proves the app's worth over a WhatsApp group —
 * it's the first thing a leader should see, not a stat buried in a grid.
 */
export default function LeaderHero({ stats }) {
  const navigate = useNavigate();
  const { group_name, group_code, tasks_total, tasks_done, ready_to_submit, ready_to_submit_count } = stats;
  const pct = tasks_total > 0 ? Math.round((tasks_done / tasks_total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-[--radius-card] border border-border p-6 mb-6"
    >
      <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
        <div>
          <p className="text-sm text-muted uppercase tracking-[0.12em] font-medium mb-1">{group_name}</p>
          <h2 className="font-display text-xl font-semibold text-ink">
            {tasks_total === 0 ? "No tasks assigned yet" : `${pct}% of tasks done`}
          </h2>
        </div>
        {group_code && <CodeChip code={group_code} label="Invite Code" size="sm" />}
      </div>

      {tasks_total > 0 && (
        <div className="h-2 rounded-full bg-status-todo-bg overflow-hidden mb-5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-status-done"
          />
        </div>
      )}

      {ready_to_submit_count > 0 ? (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-accent-soft rounded-[--radius-control] px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="progress">{ready_to_submit_count} ready</Badge>
            <span className="text-sm text-ink-soft">
              {ready_to_submit[0]?.assignment_title}{ready_to_submit_count > 1 ? ` +${ready_to_submit_count - 1} more` : ""} — all tasks done
            </span>
          </div>
          <Button size="sm" onClick={() => navigate("/assignments")}>Submit now</Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => navigate("/groups")}>See who's on track</Button>
      )}
    </motion.div>
  );
}
