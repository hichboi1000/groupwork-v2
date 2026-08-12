import { motion } from "framer-motion";

export default function EmptyState({ icon = "—", title, message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6 bg-surface rounded-[--radius-card] border border-dashed border-border-strong"
    >
      <div className="text-4xl mb-4 text-accent font-display">{icon}</div>
      {title && <h3 className="font-display font-semibold text-ink mb-1">{title}</h3>}
      <p className="text-muted text-sm max-w-sm">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
