import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardDocumentIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { copyToClipboard } from "../../utils/clipboard";

/**
 * The app's signature visual element.
 *
 * A group/unit/class code is the literal handshake moment in this app —
 * it's how a leader hands off to a student, how a rep attaches to a unit.
 * Instead of styling it like a generic <input>/<span>, it gets its own
 * ticket/stamp motif: a notched card in mono type, so it reads as a
 * physical object worth copying and sharing, not a database field.
 */
export default function CodeChip({ code, label, size = "md", copyable = true }) {
  const [state, setState] = useState("idle"); // idle | copied | failed

  const handleCopy = async () => {
    if (!copyable) return;
    const ok = await copyToClipboard(code);
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), ok ? 1500 : 2200);
  };

  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-lg px-4 py-2.5",
    lg: "text-2xl px-6 py-4",
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      {label && (
        <span className="text-xs uppercase tracking-[0.14em] text-muted font-medium">{label}</span>
      )}

      <motion.button
        type="button"
        onClick={handleCopy}
        whileTap={copyable ? { scale: 0.97 } : {}}
        className={`relative font-code font-semibold tracking-[0.08em] text-ink bg-surface
          border-2 border-dashed rounded-[--radius-control]
          ${state === "failed" ? "border-status-overdue/60" : "border-accent/50"}
          ${sizes[size]}
          ${copyable ? "cursor-pointer hover:border-accent hover:bg-accent-soft/40" : "cursor-default"}
          transition-colors flex items-center gap-3`}
        aria-label={copyable ? `Copy code ${code}` : code}
      >
        {/* ticket notches */}
        <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-paper border-2 border-dashed border-accent/50" />
        <span className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-paper border-2 border-dashed border-accent/50" />

        <span>{code}</span>

        {copyable && (
          state === "copied" ? <CheckIcon className="w-4 h-4 text-status-done shrink-0" />
          : state === "failed" ? <XMarkIcon className="w-4 h-4 text-status-overdue shrink-0" />
          : <ClipboardDocumentIcon className="w-4 h-4 text-muted shrink-0" />
        )}
      </motion.button>
      {state === "failed" && (
        <span className="text-xs text-status-overdue">
          Couldn't copy automatically — select and copy the code above.
        </span>
      )}
    </div>
  );
}

