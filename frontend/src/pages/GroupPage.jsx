import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { getMyGroup, createGroup, joinGroup, leaveGroup, getGroupProgress, downloadFile } from "../api/client";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import Loading from "../components/ui/Loading";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import CodeChip from "../components/ui/CodeChip";
import SharedFiles from "../components/dashboard/SharedFiles";

// Per-member task breakdown — this used to live on its own "Progress"
// page. It's the single screen that proves the app's worth over a
// WhatsApp group (who's actually behind), so it now lives right here,
// one scroll below the group's own info — not behind an extra nav click.
function MemberBreakdown({ member, index }) {
  const { summary, tasks } = member;
  const pct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const isLagging = summary.total > 0 && pct < 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="bg-surface rounded-[--radius-card] border border-border p-5 mb-3"
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center text-surface font-display font-semibold shrink-0">
            {member.member.avatar_initials}
          </div>
          <div>
            <div className="font-medium text-ink">{member.member.full_name}</div>
            <div className="text-xs text-muted capitalize">{member.member.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isLagging && <Badge variant="overdue">Behind</Badge>}
          <div className="text-right">
            <div className="text-lg font-display font-semibold text-ink">{pct}%</div>
            <div className="text-xs text-muted">{summary.done}/{summary.total} done</div>
          </div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-status-todo-bg overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${isLagging ? "bg-status-overdue" : "bg-status-done"}`}
        />
      </div>

      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between py-1 text-sm gap-2">
              <span className="text-ink-soft truncate">{task.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {task.submission_file && (
                  <button
                    type="button"
                    onClick={() => downloadFile(task.submission_file)}
                    className="text-xs font-semibold text-accent-dark hover:underline"
                  >
                    Evidence
                  </button>
                )}
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

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} icon={copied ? CheckIcon : ClipboardDocumentIcon}>
      {copied ? "Copied" : "Copy Code"}
    </Button>
  );
}

export default function GroupPage() {
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createForm, setCreateForm] = useState({ name: "", description: "", class_code: "" });
  const [joinCode, setJoinCode] = useState("");

  const [breakdown, setBreakdown] = useState(null);

  useEffect(() => {
    loadGroup();
  }, []);

  const loadGroup = () => {
    setLoading(true);
    getMyGroup()
      .then((r) => {
        setGroup(r.data);
        // Leaders get the per-member breakdown right here — no separate
        // Progress page needed for their own group.
        if (user.role === "leader") {
          getGroupProgress().then((res) => setBreakdown(res.data)).catch(() => setBreakdown(null));
        }
      })
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const payload = { ...createForm };
      if (!payload.class_code) delete payload.class_code;
      const r = await createGroup(payload);
      setGroup(r.data);
      setSuccess("Group created successfully!");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create group.");
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const r = await joinGroup({ code: joinCode.toUpperCase() });
      setGroup(r.data.group);
      setSuccess("You joined the group!");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid code or already in a group.");
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await leaveGroup();
      setGroup(null);
      setSuccess("You left the group.");
    } catch (err) {
      setError(err.response?.data?.error || "Could not leave group.");
    }
  };

  if (loading) return <Loading label="Loading group…" />;

  if (!group) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink">My Group</h1>
          <p className="text-muted mt-1">You are not in a group yet.</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <div className="grid md:grid-cols-2 gap-6">
          {user.role === "leader" && (
            <Card title="👑 Create a Group">
              <form onSubmit={handleCreate} className="space-y-4">
                <Input
                  label="Group Name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
                <Textarea
                  label="Description (optional)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                />
                <Input
                  label="Class Code (optional)"
                  value={createForm.class_code}
                  placeholder="e.g. K3J9QZ — ask your class rep"
                  onChange={(e) => setCreateForm({ ...createForm, class_code: e.target.value.toUpperCase() })}
                  className="font-mono tracking-widest"
                  hint="Connects your group to your class (e.g. BBIT 3.2), so your class rep and lecturer can see your group's progress once your class is attached to a unit. You can add this later too."
                />
                <Button type="submit" className="w-full">Create Group</Button>
              </form>
            </Card>
          )}

          {user.role !== "leader" && (
            <Card title="🤝 Join a Group" subtitle="Ask your group leader for the invite code.">
              <form onSubmit={handleJoin} className="space-y-4">
                <Input
                  label="Group Code"
                  value={joinCode}
                  placeholder="e.g. A9PN6G"
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="font-mono tracking-widest text-lg"
                  required
                />
                <Button type="submit" className="w-full">Join Group</Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const prog = group.progress || {};
  const total = prog.total || 0;
  const done = prog.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{group.name}</h1>
          {group.description && <p className="text-muted mt-1">{group.description}</p>}
        </div>
        {user.role !== "leader" && (
          <Button variant="danger" size="sm" onClick={handleLeave}>Leave Group</Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Group Info">
          <div className="mb-4">
            <CodeChip code={group.code} label="Invite Code" copyable />
          </div>
          <div className="mb-3">
            <div className="text-sm text-muted mb-1">Leader</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-surface text-xs font-bold">
                {group.leader?.avatar_initials}
              </div>
              <span className="text-ink-soft">{group.leader?.full_name}</span>
            </div>
          </div>
          {group.class_name && (
            <div>
              <div className="text-sm text-muted mb-1">Class</div>
              <Badge variant="accent">{group.class_name}</Badge>
            </div>
          )}
          {!group.class_name && user.role === "leader" && (
            <Alert type="info">
              This group isn't linked to a class yet. Ask your class rep for their class code, then re-create or contact support to link it.
            </Alert>
          )}
        </Card>

        <Card title="Task Progress">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted text-sm">{done} of {total} tasks done</span>
            <span className="text-accent-dark font-bold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-status-todo-bg overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-status-done rounded-full"
            />
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-muted text-sm">To Do</div>
              <div className="font-bold text-ink">{prog.todo || 0}</div>
            </div>
            <div>
              <div className="text-status-progress text-sm">In Progress</div>
              <div className="font-bold text-status-progress">{prog.in_progress || 0}</div>
            </div>
            <div>
              <div className="text-status-done text-sm">Done</div>
              <div className="font-bold text-status-done">{prog.done || 0}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title={`Members (${group.member_count})`} className="mt-6">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {group.members?.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 bg-paper rounded-[--radius-control] p-3"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-surface font-bold shrink-0 ${
                  m.role === "leader" ? "bg-accent" : "bg-status-progress"
                }`}
              >
                {m.avatar_initials}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{m.full_name}</div>
                <div className="text-xs text-muted capitalize">{m.role}</div>
              </div>
              {m.id === group.leader?.id && (
                <Badge variant="accent" className="ml-auto shrink-0">Leader</Badge>
              )}
            </motion.div>
          ))}
        </div>
      </Card>

      <SharedFiles user={user} group={group} />

      {user.role === "leader" && breakdown && (
        <div className="mt-6">
          <div className="mb-3 font-display font-semibold text-ink text-lg">
            Who's on track
          </div>
          {breakdown.members.length === 0 ? (
            <p className="text-sm text-muted">No tasks assigned yet.</p>
          ) : (
            breakdown.members.map((m, i) => <MemberBreakdown key={m.member.id} member={m} index={i} />)
          )}
        </div>
      )}
    </div>
  );
}
