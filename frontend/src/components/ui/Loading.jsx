import { motion } from "framer-motion";

export default function Loading({ label = "Loading…", full = false }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-muted ${full ? "min-h-[50vh]" : "py-16"}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
        className="w-5 h-5 rounded-full border-2 border-border-strong border-t-accent"
      />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
