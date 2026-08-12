import { motion, AnimatePresence } from "framer-motion";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";

const STYLES = {
  error: { wrap: "bg-status-overdue-bg border-status-overdue/30 text-status-overdue", Icon: ExclamationTriangleIcon },
  success: { wrap: "bg-status-done-bg border-status-done/30 text-status-done", Icon: CheckCircleIcon },
  info: { wrap: "bg-status-progress-bg border-status-progress/30 text-status-progress", Icon: InformationCircleIcon },
};

export default function Alert({ type = "info", children }) {
  const { wrap, Icon } = STYLES[type] || STYLES.info;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={`flex items-start gap-3 border rounded-[--radius-control] px-4 py-3 mb-5 text-sm font-medium ${wrap}`}
      >
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <span>{children}</span>
      </motion.div>
    </AnimatePresence>
  );
}
