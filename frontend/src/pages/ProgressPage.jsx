import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { getGroupProgress, getAllGroups } from "../api/client";

import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";

function MemberCard({ member, index }) {
  const { summary, tasks } = member;
  const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="bg-surface rounded-[--radius-card] border border-border p-6 mb-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-surface font-bold">
            {member.member.avatar_initials}
          </div>
          <div>
            <div className="font-semibold text-ink">{member.member.full_name}</div>
            <div className="text-xs text-muted capitalize">{member.member.role}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-accent-dark">{pct}%</div>
          <div className="text-xs text-muted">{summary.done}/{summary.total} done</div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-status-todo-bg overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full bg-status-done rounded-full"
        />
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm">
        <span className="text-muted">📋 {summary.todo} to do</span>
        <span className="text-status-progress">⏳ {summary.in_progress} in progress</span>
        <span className="text-status-done">✅ {summary.done} done</span>
        {summary.overdue > 0 && <span className="text-status-overdue">⚠ {summary.overdue} overdue</span>}
      </div>

      {tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between py-1.5">
              <div className="min-w-0">
                <span className="font-medium text-sm text-ink-soft">{task.title}</span>
                {task.assignment_title && (
                  <span className="text-xs text-muted ml-2">({task.assignment_title})</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.is_overdue && <Badge variant="overdue">Overdue</Badge>}
                <Badge variant={task.status === "done" ? "done" : task.status === "progress" ? "progress" : "todo"}>
                  {task.status === "todo" ? "To Do" : task.status === "progress" ? "In Progress" : "Done"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isLecturerOrRep = ["lecturer", "rep"].includes(user?.role);

  useEffect(() => {
    if (isLecturerOrRep) {
      getAllGroups()
        .then((r) => { setGroups(r.data); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      loadProgress();
    }
  }, []);

  const loadProgress = (groupId) => {
    setLoading(true);
    setError("");
    getGroupProgress(groupId)
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.error || "Could not load progress."))
      .finally(() => setLoading(false));
  };

  const handleGroupSelect = (e) => {
    const id = e.target.value;
    setSelectedGroup(id);
    if (id) loadProgress(id);
    else setData(null);
  };

  if (loading && !isLecturerOrRep) return <Loading label="Loading progress…" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">
          {isLecturerOrRep ? "All Groups Progress" : "Group Progress"}
        </h1>
        <p className="text-muted mt-1">See who is on track and who needs attention.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {isLecturerOrRep && (
        <div className="bg-surface rounded-[--radius-card] border border-border p-5 mb-6 max-w-sm">
          <Select label="Select a Group to Inspect" value={selectedGroup} onChange={handleGroupSelect}>
            <option value="">— Choose a group —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (Leader: {g.leader?.full_name})
              </option>
            ))}
          </Select>
        </div>
      )}

      {loading && isLecturerOrRep && <Loading label="Loading…" />}

      {data && (
        <>
          <div className="bg-surface rounded-[--radius-card] border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-bold text-lg text-ink">{data.group.name}</div>
                <div className="text-sm text-muted">Leader: {data.group.leader?.full_name}</div>
              </div>
              <span className="font-mono tracking-widest bg-status-todo-bg text-ink-soft rounded-lg px-3 py-1.5 text-sm">
                {data.group.code}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Tasks", value: data.overall.total, color: "text-ink" },
                { label: "To Do", value: data.overall.todo, color: "text-muted" },
                { label: "In Progress", value: data.overall.in_progress, color: "text-status-progress" },
                { label: "Done", value: data.overall.done, color: "text-status-done" },
              ].map((s) => (
                <div key={s.label} className="bg-paper rounded-[--radius-control] p-4">
                  <div className="text-xs text-muted">{s.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3 font-semibold text-ink-soft">
            Member Breakdown ({data.members.length} members)
          </div>

          {data.members.length === 0 ? (
            <EmptyState icon="👥" message="No members in this group yet." />
          ) : (
            data.members.map((m, i) => <MemberCard key={m.member.id} member={m} index={i} />)
          )}
        </>
      )}

      {!data && !loading && !isLecturerOrRep && (
        <EmptyState icon="📊" message="No progress data available yet. Create tasks first." />
      )}
    </div>
  );
}
