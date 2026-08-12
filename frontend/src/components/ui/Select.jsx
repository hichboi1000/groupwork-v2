export default function Select({ label, value, onChange, children, required, className = "", ...props }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-ink-soft">{label}</label>}
      <select
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full rounded-[--radius-control] border border-border-strong px-4 py-3 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition bg-surface ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
