import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Badge from "../ui/Badge";

/**
 * Lecturer/rep's #1 question: "is there work waiting on me to check?"
 * Submissions needing review is the thing a WhatsApp group genuinely
 * can't do well — surface it first, not buried behind Assignments.
 */
export default function StaffHero({ stats }) {
  const navigate = useNavigate();
  const { pending_review, pending_review_count } = stats;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface rounded-[--radius-card] border border-border p-6 mb-6"
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-muted uppercase tracking-[0.12em] font-medium mb-1">Awaiting your review</p>
          <h2 className="font-display text-xl font-semibold text-ink">
            {pending_review_count === 0
              ? "Nothing waiting on you right now"
              : `${pending_review_count} submission${pending_review_count !== 1 ? "s" : ""} to check`}
          </h2>
        </div>
        {pending_review_count > 0 && (
          <Button onClick={() => navigate("/assignments")}>Review submissions</Button>
        )}
      </div>

      {pending_review_count > 0 && (
        <div className="mt-4 space-y-2">
          {pending_review.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-paper rounded-[--radius-control] px-4 py-2.5">
              <span className="text-sm text-ink-soft">
                <span className="font-medium text-ink">{p.group_name}</span> — {p.assignment_title}
              </span>
              <Badge variant="accent">Submitted</Badge>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
