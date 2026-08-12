import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import { useAuth } from "../../contexts/AuthContext";

// Same role → action mapping as the Topbar's "New" button, so the
// primary CTA is consistent wherever it shows up in the app.
const CTA_BY_ROLE = {
  student: { label: "Join a Group", path: "/groups" },
  leader: { label: "Create Task", path: "/tasks?new=1" },
  rep: { label: "Create Class", path: "/classes?new=1" },
  lecturer: { label: "Create Unit", path: "/units?new=1" },
};

export default function WelcomeBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cta = CTA_BY_ROLE[user?.role] || CTA_BY_ROLE.student;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[--radius-card] bg-ink text-surface p-8 sm:p-10 mb-8"
    >
      <div className="flex justify-between items-center flex-wrap gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.15em] text-surface/50 font-medium mb-2">{today}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold">
            {greeting}, {user?.first_name || user?.username}
          </h1>
          <p className="mt-3 text-surface/70">Here's where your group work stands today.</p>
        </div>

        <Button
          onClick={() => navigate(cta.path)}
          className="bg-accent hover:bg-accent-dark text-surface"
        >
          + {cta.label}
        </Button>
      </div>
    </motion.div>
  );
}
