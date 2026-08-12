import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

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
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — silently ignore, chip still displays the code
    }
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
          border-2 border-dashed border-accent/50 rounded-[--radius-control]
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
          copied
            ? <CheckIcon className="w-4 h-4 text-status-done shrink-0" />
            : <ClipboardDocumentIcon className="w-4 h-4 text-muted shrink-0" />
        )}
      </motion.button>
    </div>
  );
}
