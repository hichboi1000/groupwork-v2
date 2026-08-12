import { motion } from "framer-motion";
import clsx from "clsx";

export default function Button({
  children,
  type = "button",
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon: Icon,
  className = "",
  ...props
}) {
  const variants = {
    primary:
      "bg-accent hover:bg-accent-dark text-surface",

    secondary:
      "bg-ink hover:bg-ink-soft text-surface",

    outline:
      "border border-border-strong bg-surface hover:bg-paper text-ink",

    ghost:
      "hover:bg-accent-soft text-ink-soft",

    danger:
      "bg-status-overdue hover:opacity-90 text-surface",

    success:
      "bg-status-done hover:opacity-90 text-surface",
  };

  const sizes = {
    sm: "px-3 py-2 text-sm",

    md: "px-5 py-2.5",

    lg: "px-6 py-3 text-lg",
  };

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        "rounded-[--radius-control] font-medium transition-all duration-200 flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-80" />
      )}

      {Icon && !loading && (
        <Icon className="w-5 h-5" />
      )}

      {children}
    </motion.button>
  );
}