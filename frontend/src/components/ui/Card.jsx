import { motion } from "framer-motion";
import clsx from "clsx";

export default function Card({
  children,
  title,
  subtitle,
  action,
  hover = true,
  className = "",
}) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : {}}
      transition={{ duration: 0.2 }}
      className={clsx(
        "bg-surface rounded-[--radius-card] border border-border",
        "overflow-hidden",
        className
      )}
    >
      {(title || subtitle || action) && (
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            {title && (
              <h2 className="font-display text-lg font-semibold text-ink">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="text-sm text-muted mt-1">
                {subtitle}
              </p>
            )}
          </div>

          {action}
        </div>
      )}

      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}
