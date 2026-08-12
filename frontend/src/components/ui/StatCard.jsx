import { motion } from "framer-motion";

const colors = {
  blue: { bg: "bg-status-progress-bg", text: "text-status-progress", border: "border-status-progress/25" },
  green: { bg: "bg-status-done-bg", text: "text-status-done", border: "border-status-done/25" },
  orange: { bg: "bg-accent-soft", text: "text-accent-dark", border: "border-accent/25" },
  purple: { bg: "bg-status-todo-bg", text: "text-ink-soft", border: "border-border-strong" },
};

export default function StatCard({ icon, title, value, change, color = "blue" }) {
  const c = colors[color] || colors.blue;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`rounded-[--radius-card] border ${c.border} ${c.bg} p-6`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">{title}</p>
        <div className="text-2xl">{icon}</div>
      </div>

      <h2 className="font-display mt-4 text-3xl font-semibold text-ink">{value}</h2>

      <p className={`mt-3 text-sm font-semibold ${c.text}`}>{change}</p>
    </motion.div>
  );
}
