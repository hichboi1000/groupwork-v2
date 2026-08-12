import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import {
  getAssignments,
  createAssignment,
  getUnits,
  createUnit,
  getGroupAssignments,
  createGroupAssignment,
  markGroupAssignmentReviewed,
  getAllGroups,
  getSubmissions,
  createSubmission,
  getMyGroup,
  downloadFile,
} from "../api/client";

import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Textarea from "../components/ui/Textarea";
import Badge from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import Loading from "../components/ui/Loading";
import Tabs from "../components/ui/Tabs";
import { ArrowDownTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

function DeadlineBadge({ assignment }) {
  if (assignment.is_overdue) return <Badge variant="overdue">Overdue</Badge>;
  if (assignment.days_remaining <= 2) return <Badge variant="progress">{assignment.days_remaining}d left</Badge>;
  return <Badge variant="done">{assignment.days_remaining}d left</Badge>;
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [assignments, setAssignments] = useState([]);
  const [units, setUnits] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [myGroup, setMyGroup] = useState(null);

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("assignments");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [assignmentForm, setAssignmentForm] = useState({ title: "", description: "", unit: "", deadline: "" });
  const [newUnitMode, setNewUnitMode] = useState(false);
  const [newUnitFields, setNewUnitFields] = useState({ code: "", name: "" });
  const [unitForm, setUnitForm] = useState({ name: "", code: "" });
  const [groupAssignmentForm, setGroupAssignmentForm] = useState({ group: "", assignment: "" });
  const [submissionForm, setSubmissionForm] = useState({ assignment: "", content: "", file: null });

  const isLecturerOrRep = ["lecturer", "rep"].includes(user?.role);
  const isLeader = user?.role === "leader";

  useEffect(() => {
    loadData();
    if (searchParams.get("new")) {
      setTab(isLecturerOrRep ? "post" : "assignments");
      setSearchParams({}, { replace: true });
    }
  }, []);

  const loadData = async () => {
    const requests = [
      getAssignments().catch(() => ({ data: [] })),
      getUnits().catch(() => ({ data: [] })),
      getGroupAssignments().catch(() => ({ data: [] })),
    ];

    if (isLecturerOrRep) requests.push(getAllGroups().catch(() => ({ data: [] })));
    if (isLecturerOrRep || isLeader) requests.push(getSubmissions().catch(() => ({ data: [] })));
    if (isLeader) requests.push(getMyGroup().catch(() => ({ data: null })));

    try {
      const result = await Promise.all(requests);
      setAssignments(result[0].data);
      setUnits(result[1].data);
      setGroupAssignments(result[2].data);

      let index = 3;
      if (isLecturerOrRep) { setGroups(result[index].data); index++; }
      if (isLecturerOrRep || isLeader) { setSubmissions(result[index].data); index++; }
      if (isLeader) { setMyGroup(result[index].data); }
    } finally {
      setLoading(false);
    }
  };

  const markReviewed = async (groupAssignmentId) => {
    try {
      const r = await markGroupAssignmentReviewed(groupAssignmentId);
      setGroupAssignments(groupAssignments.map((ga) => (ga.id === r.data.id ? r.data : ga)));
      setSuccess("Marked as reviewed.");
    } catch (err) {
      setError(err.response?.data?.error || "Could not mark as reviewed.");
    }
  };

  const postAssignment = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    let unitId = assignmentForm.unit;

    // Collapsed flow: if the unit doesn't exist yet, create it right here
    // instead of sending the lecturer to a separate Units screen first.
    if (newUnitMode) {
      if (!newUnitFields.code.trim() || !newUnitFields.name.trim()) {
        setError("Enter the new unit's code and name.");
        return;
      }
      try {
        const unitResponse = await createUnit(newUnitFields);
        unitId = unitResponse.data.unit.id;
        setUnits([...units, unitResponse.data.unit]);
      } catch (err) {
        const data = err.response?.data;
        if (data?.needs_confirmation) {
          setError(data.message);
        } else {
          setError(data ? Object.values(data).flat().join(" ") : "Failed to create the unit.");
        }
        return;
      }
    }

    if (!unitId) {
      setError("Select a unit, or switch to 'New unit' and enter one.");
      return;
    }

    try {
      const response = await createAssignment({ ...assignmentForm, unit: unitId });
      setAssignments([response.data, ...assignments]);
      setAssignmentForm({ title: "", description: "", unit: "", deadline: "" });
      setNewUnitFields({ code: "", name: "" });
      setNewUnitMode(false);
      setSuccess("Assignment posted successfully.");
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to create assignment.");
    }
  };

  const postUnit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const response = await createUnit(unitForm);
      setUnits([...units, response.data]);
      setUnitForm({ name: "", code: "" });
      setSuccess("Unit created successfully.");
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to create unit.");
    }
  };

  const linkGroup = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      const response = await createGroupAssignment(groupAssignmentForm);
      setGroupAssignments([...groupAssignments, response.data]);
      setGroupAssignmentForm({ group: "", assignment: "" });
      setSuccess("Assignment linked to group.");
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to link assignment.");
    }
  };

  const submitWork = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!myGroup) { setError("You must belong to a group before submitting."); return; }
    try {
      const payload = { ...submissionForm, group: myGroup.id };
      if (!payload.file) delete payload.file;
      await createSubmission(payload);
      setSubmissionForm({ assignment: "", content: "", file: null });
      setSuccess("Submission uploaded successfully.");
    } catch (err) {
      setError(err.response?.data ? Object.values(err.response.data).flat().join(" ") : "Failed to submit work.");
    }
  };

  if (loading) return <Loading label="Loading assignments…" />;

  const tabs = [
    { value: "assignments", label: "Assignments", count: assignments.length },
    ...(isLecturerOrRep ? [
      { value: "submissions", label: "Submissions", count: submissions.length },
      { value: "post", label: "Post Assignment" },
      { value: "units", label: "Units" },
      { value: "link", label: "Link Group" },
    ] : []),
    ...(isLeader ? [{ value: "submit", label: "Submit Work" }] : []),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Assignments</h1>
        <p className="text-muted mt-1">
          {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "assignments" && (
        assignments.length === 0 ? (
          <EmptyState icon="📋" message="No assignments available." />
        ) : (
          <div className="grid gap-4">
            {assignments.map((assignment, i) => (
              <motion.div
                key={assignment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="bg-surface rounded-[--radius-card] border border-border p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-ink">{assignment.title}</div>
                    <div className="text-sm text-muted mt-1">
                      {assignment.unit_detail?.code} — {assignment.unit_detail?.name}
                    </div>
                  </div>
                  <DeadlineBadge assignment={assignment} />
                </div>

                <p className="text-sm text-muted mt-3">{assignment.description}</p>

                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <span className="text-sm text-muted">
                    📅{" "}
                    {new Date(assignment.deadline).toLocaleString("en-KE", {
                      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="text-sm text-muted">Posted by {assignment.created_by?.full_name}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {tab === "submissions" && (
        submissions.length === 0 ? (
          <EmptyState
            icon="—"
            title="No submissions yet"
            message="Once a group leader submits work, it'll show up here with a download link — no more digging through group chats for attachments."
          />
        ) : (
          <div className="grid gap-4">
            {submissions.map((sub, i) => {
              const ga = groupAssignments.find(
                (g) => g.group === sub.group && g.assignment === sub.assignment
              );
              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                  className="bg-surface rounded-[--radius-card] border border-border p-5"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold text-ink">{sub.assignment_title}</div>
                      <div className="text-sm text-muted mt-1">
                        {sub.group_name} — submitted by {sub.submitted_by?.full_name}
                      </div>
                    </div>
                    <Badge variant={ga?.status === "reviewed" ? "done" : "accent"}>
                      {ga?.status === "reviewed" ? "Reviewed" : "Awaiting review"}
                    </Badge>
                  </div>

                  {sub.content && (
                    <p className="text-sm text-ink-soft mt-3 bg-paper rounded-[--radius-control] p-3">
                      {sub.content}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                    <span className="text-xs text-muted">
                      {new Date(sub.submitted_at).toLocaleString("en-KE", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      {sub.file && (
                        <Button
                          variant="outline" size="sm" icon={ArrowDownTrayIcon}
                          onClick={() => downloadFile(sub.file).catch(() => setError("Couldn't download that file."))}
                        >
                          Download
                        </Button>
                      )}
                      {ga && ga.status === "submitted" && (
                        <Button size="sm" icon={CheckCircleIcon} onClick={() => markReviewed(ga.id)}>
                          Mark Reviewed
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {tab === "post" && (
        <div className="bg-surface rounded-[--radius-card] border border-border p-6 max-w-xl">
          <h2 className="font-semibold text-ink mb-5">Post Assignment</h2>
          <form onSubmit={postAssignment} className="space-y-4">
            <Input
              label="Title *"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
              required
            />
            <Textarea
              label="Description *"
              value={assignmentForm.description}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
              required
            />
            {units.length === 0 && !newUnitMode && (
              <Alert type="info">
                You haven't taught a unit yet — switch to "New unit" below to create one in the same step.
              </Alert>
            )}

            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setNewUnitMode(false)}
                className={`px-3 py-1.5 rounded-[--radius-pill] font-medium transition ${
                  !newUnitMode ? "bg-ink text-surface" : "bg-paper text-ink-soft border border-border"
                }`}
              >
                Existing unit
              </button>
              <button
                type="button"
                onClick={() => setNewUnitMode(true)}
                className={`px-3 py-1.5 rounded-[--radius-pill] font-medium transition ${
                  newUnitMode ? "bg-ink text-surface" : "bg-paper text-ink-soft border border-border"
                }`}
              >
                New unit
              </button>
            </div>

            {newUnitMode ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Unit Code *"
                  placeholder="CS302"
                  value={newUnitFields.code}
                  onChange={(e) => setNewUnitFields({ ...newUnitFields, code: e.target.value.toUpperCase() })}
                  className="font-code"
                />
                <Input
                  label="Unit Name *"
                  placeholder="Database Systems"
                  value={newUnitFields.name}
                  onChange={(e) => setNewUnitFields({ ...newUnitFields, name: e.target.value })}
                />
              </div>
            ) : (
              <Select
                label="Unit *"
                value={assignmentForm.unit}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, unit: e.target.value })}
                required={!newUnitMode}
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>
                ))}
              </Select>
            )}
            <Input
              label="Deadline *"
              type="datetime-local"
              value={assignmentForm.deadline}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, deadline: e.target.value })}
              required
            />
            <Button type="submit" className="w-full">Post Assignment</Button>
          </form>
        </div>
      )}

      {tab === "units" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-surface rounded-[--radius-card] border border-border p-6">
            <h2 className="font-semibold text-ink mb-5">Create Unit</h2>
            <form onSubmit={postUnit} className="space-y-4">
              <Input
                label="Unit Code *"
                placeholder="Example: CS302"
                value={unitForm.code}
                onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value.toUpperCase() })}
                required
              />
              <Input
                label="Unit Name *"
                placeholder="Database Systems"
                value={unitForm.name}
                onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                required
              />
              <Button type="submit" className="w-full">Create Unit</Button>
            </form>
          </div>

          <div className="bg-surface rounded-[--radius-card] border border-border p-6">
            <h2 className="font-semibold text-ink mb-5">Existing Units ({units.length})</h2>
            {units.length === 0 ? (
              <p className="text-muted text-sm">No units available.</p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <div key={unit.id} className="bg-paper rounded-[--radius-control] p-3">
                    <Badge variant="accent">{unit.code}</Badge>
                    <span className="ml-2 text-ink-soft text-sm">{unit.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "link" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-surface rounded-[--radius-card] border border-border p-6">
            <h2 className="font-semibold text-ink mb-5">Link Assignment To Group</h2>
            <form onSubmit={linkGroup} className="space-y-4">
              <Select
                label="Group *"
                value={groupAssignmentForm.group}
                onChange={(e) => setGroupAssignmentForm({ ...groupAssignmentForm, group: e.target.value })}
                required
              >
                <option value="">Select group</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </Select>
              <Select
                label="Assignment *"
                value={groupAssignmentForm.assignment}
                onChange={(e) => setGroupAssignmentForm({ ...groupAssignmentForm, assignment: e.target.value })}
                required
              >
                <option value="">Select assignment</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
                ))}
              </Select>
              <Button type="submit" className="w-full">Link Assignment</Button>
            </form>
          </div>

          <div className="bg-surface rounded-[--radius-card] border border-border p-6">
            <h2 className="font-semibold text-ink mb-5">Linked Assignments ({groupAssignments.length})</h2>
            {groupAssignments.length === 0 ? (
              <p className="text-muted text-sm">No linked assignments.</p>
            ) : (
              <div className="space-y-2">
                {groupAssignments.map((item) => (
                  <div key={item.id} className="bg-paper rounded-[--radius-control] p-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-ink text-sm">{item.assignment_detail?.title}</div>
                      <div className="text-xs text-muted">{item.group_name}</div>
                    </div>
                    <Badge variant={
                      item.status === "reviewed" ? "done"
                      : item.status === "submitted" ? "accent"
                      : item.status === "ready_to_submit" ? "progress"
                      : "todo"
                    }>
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "submit" && (
        <div className="bg-surface rounded-[--radius-card] border border-border p-6 max-w-xl">
          <h2 className="font-semibold text-ink mb-5">Submit Assignment Work</h2>

          {!myGroup && <Alert type="error">You need to join a group first.</Alert>}

          <form onSubmit={submitWork} className="space-y-4">
            <Select
              label="Assignment *"
              value={submissionForm.assignment}
              onChange={(e) => setSubmissionForm({ ...submissionForm, assignment: e.target.value })}
              required
            >
              <option value="">Select assignment</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>{assignment.title}</option>
              ))}
            </Select>
            <Textarea
              label="Notes"
              value={submissionForm.content}
              onChange={(e) => setSubmissionForm({ ...submissionForm, content: e.target.value })}
            />
            <Input
              label="Upload File"
              type="file"
              onChange={(e) => setSubmissionForm({ ...submissionForm, file: e.target.files[0] })}
            />
            <Button type="submit" className="w-full" disabled={!myGroup}>Submit Work</Button>
          </form>
        </div>
      )}
    </div>
  );
}
