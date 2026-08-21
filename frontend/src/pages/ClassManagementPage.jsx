import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  getClasses, createClass, getAllGroups,
  getUnitOfferings, getUnitOfferingsHistory,
  attachClassToUnit, detachClass,
  addRepToClass, removeRepFromClass,
} from "../api/client";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import Tabs from "../components/ui/Tabs";
import Modal, { ModalActions } from "../components/ui/Modal";
import CodeChip from "../components/ui/CodeChip";

const STAGES = [
  ["1.1", "Year 1, Sem 1"], ["1.2", "Year 1, Sem 2"],
  ["2.1", "Year 2, Sem 1"], ["2.2", "Year 2, Sem 2"],
  ["3.1", "Year 3, Sem 1"], ["3.2", "Year 3, Sem 2"],
  ["4.1", "Year 4, Sem 1"], ["4.2", "Year 4, Sem 2"],
];

export default function ClassManagementPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState(searchParams.get("new") ? "create" : "classes");

  const [createForm, setCreateForm] = useState({ name: "", program: "", stage: "3.1", cohort_year: new Date().getFullYear() });
  const [attachForm, setAttachForm] = useState({ unit_code: "", class_id: "" });
  const [pendingDetach, setPendingDetach] = useState(null);

  useEffect(() => {
    loadAll();
    // Clear the ?new=1 param once we've honored it, keeps the URL clean
    if (searchParams.get("new")) setSearchParams({}, { replace: true });
  }, []);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      getClasses().catch(() => ({ data: [] })),
      getAllGroups().catch(() => ({ data: [] })),
      getUnitOfferings().catch(() => ({ data: [] })),
      getUnitOfferingsHistory().catch(() => ({ data: [] })),
    ]).then(([c, g, o, h]) => {
      setClasses(c.data); setGroups(g.data); setOfferings(o.data); setHistory(h.data);
    }).finally(() => setLoading(false));
  };

  const handleCreateClass = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      const r = await createClass(createForm);
      setClasses([r.data, ...classes]);
      setSuccess(`Class "${r.data.name}" created. Share code ${r.data.code} with your group leaders.`);
      setCreateForm({ name: "", program: "", stage: "3.1", cohort_year: new Date().getFullYear() });
      setTab("classes");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create class.");
    }
  };

  const handleAttach = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      await attachClassToUnit({
        unit_code: attachForm.unit_code.toUpperCase(),
        class_id: attachForm.class_id,
      });
      setSuccess("Class attached to unit successfully!");
      setAttachForm({ unit_code: "", class_id: "" });
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error || "Could not attach — check the unit code.");
    }
  };

  const handleDetach = async (offering, confirm = false) => {
    setError(""); setSuccess("");
    try {
      await detachClass(offering.id, confirm);
      setSuccess(`Detached ${offering.class_detail?.name} from ${offering.unit_detail?.code}.`);
      setPendingDetach(null);
      loadAll();
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.needs_confirmation) {
        setPendingDetach({ offering, message: err.response.data.message });
      } else {
        setError(err.response?.data?.error || "Could not detach.");
      }
    }
  };

  // Rep handover — promote a classmate or step down, without recreating
  // the class. `repBusyId` disables both controls on a class card mid-request
  // instead of a separate flag per action, since only one can run at a time.
  const [promoteChoice, setPromoteChoice] = useState({}); // { [classId]: userId }
  const [repBusyId, setRepBusyId] = useState(null);

  const handleRepChange = async (cls, action, userId) => {
    setError(""); setSuccess("");
    setRepBusyId(cls.id);
    try {
      const r = await action(cls.id, userId);
      setClasses((cs) => cs.map((c) => (c.id === cls.id ? r.data : c)));
      return true;
    } catch (err) {
      setError(err.response?.data?.error || "Could not update reps.");
      return false;
    } finally {
      setRepBusyId(null);
    }
  };

  const handlePromoteRep = async (cls) => {
    const userId = promoteChoice[cls.id];
    if (!userId) return;
    if (await handleRepChange(cls, addRepToClass, userId)) {
      setSuccess("New rep added — they can now co-manage this class.");
      setPromoteChoice((p) => ({ ...p, [cls.id]: "" }));
    }
  };

  const handleStepDownRep = async (cls, repUser) => {
    const isSelf = repUser.id === user.id;
    if (!window.confirm(
      isSelf ? "Step down as rep of this class? You'll lose management access unless someone re-adds you."
             : `Remove ${repUser.full_name} as a rep of this class?`
    )) return;
    if (await handleRepChange(cls, removeRepFromClass, repUser.id)) {
      setSuccess(isSelf ? "You stepped down as rep." : `${repUser.full_name} is no longer a rep.`);
    }
  };

  if (user.role !== "rep") {
    return <EmptyState icon="🚫" message="Class management is only available to class representatives." />;
  }

  if (loading) return <Loading label="Loading…" />;

  const tabs = [
    { value: "classes", label: "My Classes", count: classes.length },
    { value: "create", label: "Create Class" },
    { value: "attach", label: "Attach to Unit" },
    { value: "history", label: "Past Offerings", count: history.length },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Class Management</h1>
        <p className="text-muted mt-1">Create your class, attach it to units, and manage its groups.</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "classes" && (
        classes.length === 0 ? (
          <EmptyState
            icon="📚"
            message="You haven't created a class yet."
            action={<Button onClick={() => setTab("create")}>Create your first class</Button>}
          />
        ) : (
          <div className="grid gap-4">
            {classes.map((cls, i) => {
              const classGroups = groups.filter((g) => g.class_name === cls.name);
              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                  className="bg-surface rounded-[--radius-card] border border-border p-6"
                >
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <div className="font-bold text-ink">{cls.name}</div>
                      <div className="text-sm text-muted">{cls.cohort_year} intake · {cls.group_count} group(s)</div>
                    </div>
                    <CodeChip code={cls.code} size="sm" copyable />
                  </div>

                  {cls.active_offering ? (
                    <Alert type="info">
                      Currently attached to <strong>{cls.active_offering.unit_code}</strong> — {cls.active_offering.unit_name}
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted mb-3">Not attached to any unit right now.</p>
                  )}

                  {classGroups.length > 0 && (
                    <div>
                      <div className="text-sm text-muted mb-2">Groups in this class</div>
                      <div className="flex flex-wrap gap-2">
                        {classGroups.map((g) => (
                          <Badge key={g.id} variant="accent">{g.name} ({g.member_count})</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="text-sm text-muted mb-2">Class reps</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {cls.reps?.map((r) => (
                        <Badge key={r.id} variant="todo" className="flex items-center gap-2">
                          {r.full_name}
                          <button
                            type="button"
                            onClick={() => handleStepDownRep(cls, r)}
                            disabled={repBusyId === cls.id}
                            className="text-muted hover:text-status-overdue text-xs"
                            title={r.id === user.id ? "Step down" : "Remove rep"}
                          >
                            ✕
                          </button>
                        </Badge>
                      ))}
                    </div>
                    {(() => {
                      const repIds = new Set((cls.reps || []).map((r) => r.id));
                      const candidates = [...new Map(
                        classGroups.flatMap((g) => g.members || [])
                          .filter((m) => !repIds.has(m.id))
                          .map((m) => [m.id, m])
                      ).values()];
                      if (!candidates.length) return null;
                      return (
                        <div className="flex gap-2">
                          <Select
                            value={promoteChoice[cls.id] || ""}
                            onChange={(e) => setPromoteChoice((p) => ({ ...p, [cls.id]: e.target.value }))}
                            className="flex-1"
                          >
                            <option value="">— Promote a classmate to rep —</option>
                            {candidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                          </Select>
                          <Button
                            size="sm" variant="outline"
                            loading={repBusyId === cls.id}
                            disabled={!promoteChoice[cls.id]}
                            onClick={() => handlePromoteRep(cls)}
                          >
                            Add
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {tab === "create" && (
        <div className="bg-surface rounded-[--radius-card] border border-border p-6 max-w-lg">
          <h2 className="font-semibold text-ink mb-5">Create a New Class</h2>
          <form onSubmit={handleCreateClass} className="space-y-4">
            <Input
              label="Display Name *"
              placeholder="e.g. BBIT 3.2"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <Input
              label="Program *"
              placeholder="e.g. BBIT"
              value={createForm.program}
              onChange={(e) => setCreateForm({ ...createForm, program: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Stage *"
                value={createForm.stage}
                onChange={(e) => setCreateForm({ ...createForm, stage: e.target.value })}
              >
                {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Input
                label="Cohort Intake Year *"
                type="number"
                value={createForm.cohort_year}
                onChange={(e) => setCreateForm({ ...createForm, cohort_year: e.target.value })}
                required
              />
            </div>
            <p className="text-muted text-sm">
              This represents one specific cohort, not a reusable label — next year's "BBIT 3.2" will be a separate class with a different intake year.
            </p>
            <Button type="submit" className="w-full">Create Class</Button>
          </form>
        </div>
      )}

      {tab === "attach" && (
        <div className="bg-surface rounded-[--radius-card] border border-border p-6 max-w-lg">
          <h2 className="font-semibold text-ink mb-2">Attach a Class to a Unit</h2>
          <p className="text-muted text-sm mb-5">
            Enter the unit code your lecturer shared with you (e.g. CS302). Your class's groups will then be able to do assignments under that unit for this semester.
          </p>
          <form onSubmit={handleAttach} className="space-y-4">
            <Select
              label="Class *"
              value={attachForm.class_id}
              onChange={(e) => setAttachForm({ ...attachForm, class_id: e.target.value })}
              required
            >
              <option value="">— Select your class —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.cohort_year})</option>)}
            </Select>
            <Input
              label="Unit Code *"
              placeholder="e.g. CS302"
              value={attachForm.unit_code}
              onChange={(e) => setAttachForm({ ...attachForm, unit_code: e.target.value.toUpperCase() })}
              className="font-mono tracking-widest"
              required
            />
            <Button type="submit" className="w-full">Attach</Button>
          </form>

          {offerings.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border">
              <div className="font-medium text-sm text-ink-soft mb-3">Currently Active Offerings</div>
              <div className="space-y-2">
                {offerings.map((o) => (
                  <div key={o.id} className="bg-paper rounded-[--radius-control] p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-ink text-sm">{o.class_detail?.name} → {o.unit_detail?.code}</div>
                      <div className="text-xs text-muted">{o.unit_detail?.name}</div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleDetach(o)}>Detach</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Modal open={!!pendingDetach} onClose={() => setPendingDetach(null)} title="Confirm Detach">
            <p className="text-sm text-ink-soft">{pendingDetach?.message}</p>
            <ModalActions>
              <Button variant="outline" onClick={() => setPendingDetach(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleDetach(pendingDetach.offering, true)}>Detach Anyway</Button>
            </ModalActions>
          </Modal>
        </div>
      )}

      {tab === "history" && (
        history.length === 0 ? (
          <EmptyState icon="🗄" message="No past offerings yet. Detached classes will show up here." />
        ) : (
          <div className="grid gap-3">
            {history.map((o) => (
              <div key={o.id} className="bg-surface rounded-[--radius-card] border border-border p-5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-ink">{o.class_detail?.name} → {o.unit_detail?.code}</div>
                  <div className="text-sm text-muted">{o.unit_detail?.name}</div>
                </div>
                <Badge variant="todo">Closed</Badge>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
