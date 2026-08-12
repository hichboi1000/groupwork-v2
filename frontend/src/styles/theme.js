// Kept in sync with the @theme tokens in src/index.css.
// Use this only where a JS value is unavoidable (e.g. chart libraries
// that don't read CSS variables) — everything else should use the
// Tailwind utility classes (bg-ink, text-accent, etc.) instead.
export const colors = {
  ink: "#241f19",
  inkSoft: "#4a4238",
  muted: "#8a8071",
  paper: "#f7f4ec",
  surface: "#fffdf8",
  border: "#e4ddcc",
  borderStrong: "#d3c9b3",

  accent: "#9c6b2e",
  accentDark: "#7d5423",
  accentSoft: "#f1e4cd",

  statusTodo: "#8a8071",
  statusTodoBg: "#efeae0",
  statusProgress: "#4c6b8a",
  statusProgressBg: "#e4ebf1",
  statusDone: "#4b7357",
  statusDoneBg: "#e5eee7",
  statusOverdue: "#a6493f",
  statusOverdueBg: "#f3e3e0",
};
