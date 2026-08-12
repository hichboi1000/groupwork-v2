export default function Textarea({ label, value, onChange, placeholder, rows = 4, className = "", ...props }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-ink-soft">{label}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-[--radius-control] border border-border-strong bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition resize-y ${className}`}
        {...props}
      />
    </div>
  );
}
