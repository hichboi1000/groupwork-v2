import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { getTasks, createTask, updateTask, deleteTask, getMyGroup, getAssignments, downloadFile } from "../api/client";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import Tabs from "../components/ui/Tabs";
import Modal, { ModalActions } from "../components/ui/Modal";
import { PlusIcon, PencilIcon, TrashIcon, PaperClipIcon, FolderOpenIcon } from "@heroicons/react/24/outline";

const STATUS_META = {
  todo: { label: "To Do", variant: "todo" },
  progress: { label: "In Progress", variant: "progress" },
  done: { label: "Done", variant: "done" },
};

function StatusBadge({ status, overdue }) {
  if (overdue && status !== "done") return <Badge variant="overdue">Overdue</Badge>;
  const m = STATUS_META[status] || STATUS_META.todo;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/* ── Evidence Modal — shown when a student marks a task done ── */
function EvidenceModal({ task, onClose, onSaved }) {
  const [text, setText] = useState(task.submission_text || "");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !file) {
      setErr("You must attach a written note or upload a file before marking this done.");
      return;
    }
    setSaving(true); setErr("");
    try {
      const payload = { status: "done", submission_text: text };
      if (file) payload.submission_file = file;
      const r = await updateTask(task.id, payload);
      onSaved(r.data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.status?.[0] || e.response?.data?.detail || "Could not save.");
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title="Mark Task as Done" maxWidth="max-w-xl">
      <p className="text-sm text-muted mb-5 leading-relaxed">
        Before this task is marked <strong>Done</strong>, you need to show what you actually did.
        Add a written summary, upload your file, or both — your group leader will see this.
      </p>

      {err && <Alert type="error">{err}</Alert>}

      <div className="bg-paper rounded-[--radius-control] px-4 py-3 mb-5">
        <div className="font-semibold text-sm text-ink">{task.title}</div>
        {task.description && <div className="text-sm text-muted mt-1">{task.description}</div>}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Textarea
          label="Written Summary"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Describe what you did, key findings, or notes for the leader…"
        />

        <div className="space-y-2">
          <label className="text-sm font-medium text-ink-soft">Upload File (optional)</label>
          {file ? (
            <div className="flex items-center gap-3 bg-paper border border-border rounded-[--radius-control] px-4 py-3">
              <PaperClipIcon className="w-5 h-5 text-muted shrink-0" />
              <span className="flex-1 text-sm truncate">{file.name}</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => { setFile(null); fileRef.current.value = ""; }}
              >
                ✕
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
              className="border-2 border-dashed border-border-strong rounded-[--radius-control] px-4 py-6 text-center cursor-pointer hover:border-accent hover:bg-accent-soft/30 transition-colors"
            >
              <FolderOpenIcon className="w-8 h-8 mx-auto text-muted mb-2" />
              <div className="text-sm font-semibold text-ink-soft">Click to browse or drag a file here</div>
              <div className="text-xs text-muted mt-1">PDF, Word, images — any format</div>
            </div>
          )}
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Mark as Done</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

/* ── Create / Edit Task Modal — leader-facing ── */
function TaskModal({ task, group, assignments, onClose, onSave }) {
  const [form, setForm] = useState(task || {
    title: "", description: "", assigned_to: "", status: "todo",
    due_date: "", assignment: "", group: group?.id || "",
  });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const h = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.assignment) delete payload.assignment;
      if (!payload.due_date) delete payload.due_date;
      const r = task?.id ? await updateTask(task.id, payload) : await createTask(payload);
      onSave(r.data); onClose();
    } catch (err) {
      const d = err.response?.data;
      setErr(d ? Object.values(d).flat().join(" ") : "Failed to save task.");
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={task?.id ? "Edit Task" : "Create New Task"}>
      {err && <Alert type="error">{err}</Alert>}
      <form onSubmit={submit} className="space-y-4">
        <Input label="Task Title *" name="title" value={form.title} onChange={h} required autoFocus />

        <Textarea
          label="Description"
          name="description"
          value={form.description}
          onChange={h}
          placeholder="What exactly does this task involve?"
        />

        <Select label="Assign To *" name="assigned_to" value={form.assigned_to} onChange={h} required>
          <option value="">— Select member —</option>
          {group?.members?.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
          ))}
        </Select>

        <Select label="Link to Assignment (optional)" name="assignment" value={form.assignment} onChange={h}>
          <option value="">— Standalone task —</option>
          {assignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Due Date"
            type="datetime-local"
            name="due_date"
            value={form.due_date?.slice(0, 16) || ""}
            onChange={h}
          />
          <Select label="Status" name="status" value={form.status} onChange={h}>
            <option value="todo">To Do</option>
            <option value="progress">In Progress</option>
          </Select>
        </div>

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{task?.id ? "Update Task" : "Create Task"}</Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

/* ── Main page ── */
export default function TasksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState([]);
  const [group, setGroup] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | task obj | null
  const [evidenceTask, setEvidenceTask] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getTasks(),
      getMyGroup().catch(() => ({ data: null })),
      getAssignments().catch(() => ({ data: [] })),
    ]).then(([t, g, a]) => {
      setTasks(t.data); setGroup(g.data); setAssignments(a.data);
      if (searchParams.get("new") && user.role === "leader" && g.data) {
        setModal("create");
      }
      if (searchParams.get("new")) setSearchParams({}, { replace: true });
    }).finally(() => setLoading(false));
  }, []);

  const handleStatusChange = (task, newStatus) => {
    if (newStatus === "done") {
      setEvidenceTask(task);
      return;
    }
    updateTask(task.id, { status: newStatus })
      .then((r) => setTasks(tasks.map((t) => (t.id === task.id ? r.data : t))))
      .catch(() => setError("Could not update status."));
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this task?")) return;
    deleteTask(id)
      .then(() => setTasks(tasks.filter((t) => t.id !== id)))
      .catch(() => setError("Could not delete task."));
  };

  const onSave = (saved) =>
    setTasks((prev) =>
      prev.find((t) => t.id === saved.id) ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]
    );

  const counts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === "todo").length,
    progress: tasks.filter((t) => t.status === "progress").length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter((t) => t.is_overdue).length,
  };
  const filtered = filter === "all" ? tasks
    : filter === "overdue" ? tasks.filter((t) => t.is_overdue)
    : tasks.filter((t) => t.status === filter);

  if (loading) return <Loading label="Loading tasks…" />;

  const tabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "todo", label: "To Do", count: counts.todo },
    { value: "progress", label: "In Progress", count: counts.progress },
    { value: "done", label: "Done", count: counts.done },
    ...(counts.overdue > 0 ? [{ value: "overdue", label: "Overdue", count: counts.overdue }] : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Tasks</h1>
          <p className="text-muted mt-1">
            {counts.done} of {counts.all} done
            {counts.overdue > 0 && <span className="text-status-overdue ml-2">· {counts.overdue} overdue</span>}
          </p>
        </div>
        {user.role === "leader" && group && (
          <Button icon={PlusIcon} onClick={() => setModal("create")}>New Task</Button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Tabs tabs={tabs} active={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState
          icon="✅"
          message={filter === "all" ? "No tasks yet." : `No ${filter} tasks.`}
          action={
            user.role === "leader" && group && filter === "all" ? (
              <Button onClick={() => setModal("create")}>Create the first task</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((task) => {
              const isOwn = task.assigned_to === user.id;
              const canUpdateStatus = user.role === "student" && isOwn;
              const edgeColor = task.is_overdue && task.status !== "done" ? "bg-status-overdue"
                : task.status === "done" ? "bg-status-done"
                : task.status === "progress" ? "bg-status-progress" : "bg-border-strong";

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-surface rounded-[--radius-card] border border-border overflow-hidden flex"
                >
                  <div className={`w-1.5 shrink-0 ${edgeColor}`} />

                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-ink">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-muted mt-1">{task.description}</div>
                        )}
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-surface text-[10px] font-bold">
                              {task.assigned_to_detail?.avatar_initials}
                            </div>
                            <span className="text-sm text-ink-soft">{task.assigned_to_detail?.full_name}</span>
                          </div>
                          {task.assignment_title && (
                            <Badge variant="accent">{task.assignment_title}</Badge>
                          )}
                          {task.due_date && (
                            <span className="text-sm text-muted">
                              Due {new Date(task.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>

                        {task.status === "done" && task.submission_text && (
                          <div className="mt-3 bg-status-done-bg border-l-2 border-status-done rounded-r-lg px-3 py-2 text-sm text-ink-soft">
                            <span className="font-semibold text-status-done">Evidence: </span>
                            {task.submission_text.length > 120
                              ? task.submission_text.slice(0, 120) + "…"
                              : task.submission_text}
                          </div>
                        )}
                        {task.status === "done" && task.submission_file && (
                          <div className="mt-2 flex items-center gap-3">
                            <span className="text-xs text-status-done flex items-center gap-1">
                              <PaperClipIcon className="w-3.5 h-3.5" />
                              {task.submission_file.split("/").pop()}
                            </span>
                            <button
                              type="button"
                              onClick={() => downloadFile(task.submission_file).catch(() =>
                                setError("Couldn't download that file — you may not have access, or it may have been removed.")
                              )}
                              className="text-xs font-semibold text-accent-dark hover:underline"
                            >
                              Download
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-start gap-2 shrink-0">
                        {canUpdateStatus ? (
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className="text-xs font-medium rounded-lg border border-border-strong px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-accent/40"
                          >
                            <option value="todo">To Do</option>
                            <option value="progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                        ) : (
                          <StatusBadge status={task.status} overdue={task.is_overdue} />
                        )}
                        {user.role === "leader" && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setModal(task)}
                              className="p-1.5 rounded-lg hover:bg-status-todo-bg text-muted"
                              aria-label="Edit task"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="p-1.5 rounded-lg hover:bg-status-overdue-bg text-status-overdue"
                              aria-label="Delete task"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {evidenceTask && (
        <EvidenceModal
          task={evidenceTask}
          onClose={() => setEvidenceTask(null)}
          onSaved={(saved) => {
            setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
            setEvidenceTask(null);
          }}
        />
      )}

      {modal && (
        <TaskModal
          task={modal === "create" ? null : modal}
          group={group}
          assignments={assignments}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}
