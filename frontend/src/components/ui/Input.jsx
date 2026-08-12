export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  className = "",
  hint,
  ...props
}) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-ink-soft">{label}</label>}

      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-[--radius-control] border border-border-strong bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition ${className}`}
        {...props}
      />

      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
