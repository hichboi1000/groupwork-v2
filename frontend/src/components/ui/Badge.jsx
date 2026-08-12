import clsx from "clsx";

const VARIANTS = {
  todo: "bg-status-todo-bg text-status-todo",
  progress: "bg-status-progress-bg text-status-progress",
  done: "bg-status-done-bg text-status-done",
  overdue: "bg-status-overdue-bg text-status-overdue",
  accent: "bg-accent-soft text-accent-dark",
  info: "bg-status-progress-bg text-status-progress",
  neutral: "bg-status-todo-bg text-ink-soft",
  success: "bg-status-done-bg text-status-done",
  danger: "bg-status-overdue-bg text-status-overdue",
  warning: "bg-accent-soft text-accent-dark",
};

export default function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-1 rounded-[--radius-pill] text-xs font-semibold whitespace-nowrap",
        VARIANTS[variant] || VARIANTS.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
