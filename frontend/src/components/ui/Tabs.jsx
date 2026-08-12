import { motion } from "framer-motion";

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
            active === t.value ? "text-accent-dark" : "text-muted hover:text-ink-soft"
          }`}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className="ml-1.5 opacity-60">({t.count})</span>
          )}
          {active === t.value && (
            <motion.div
              layoutId="tab-underline"
              className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent rounded-full"
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
