import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  CartesianGrid,
} from "recharts";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListTodo,
  Target,
  CalendarDays,
  MoreHorizontal,
  LayoutGrid,
  List,
  Archive,
  ExternalLink,
  Users,
  Layers3,
  Pencil,
  Upload,
  Copy,
  GitBranch,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { WorkspaceData } from "./App";
import { Button, Empty, Modal } from "./components/ui";
import { check, supabase } from "./lib/supabase";
import { workspaceCapacity } from "./lib/capacity";
import { CollaborationSummary } from "./collaboration/CollaborationView";
import {
  initials,
  isOverdue,
  priorities,
  progress,
  statuses,
  type Phase,
  type Task,
  type Role,
  type Invitation,
} from "./lib/types";
interface Props {
  data: WorkspaceData;
  userId: string;
  name: string;
  page: string;
  search: string;
  busy: boolean;
  mutate: (
    action: () => Promise<unknown>,
    message?: string,
  ) => Promise<boolean>;
}
const taskSchema = z.object({
  title: z.string().trim().min(1, "A title is required").max(200),
  description: z.string().max(10000),
  phase_id: z.string(),
  assignee_id: z.string(),
  priority: z.enum(priorities),
  due_date: z.string(),
  estimated_hours: z
    .string()
    .refine(
      (v) => !v || (Number(v) > 0 && Number.isFinite(Number(v))),
      "Use a positive number",
    ),
});
type TaskValues = z.infer<typeof taskSchema>;
const date = (value: string | null) =>
  value
    ? new Date(value + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "No date";
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase().replaceAll(" ", "-")}`}>
      <span />
      {value}
    </span>
  );
}
function TaskForm({
  data,
  task,
  busy,
  onSave,
  onClose,
}: {
  data: WorkspaceData;
  task: Task | null;
  busy: boolean;
  onSave: (values: TaskValues) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      phase_id: task?.phase_id || "",
      assignee_id: task?.assignee_id || "",
      priority: task?.priority || "Medium",
      due_date: task?.due_date || "",
      estimated_hours: task?.estimated_hours?.toString() || "",
    },
  });
  return (
    <Modal
      title={task ? "Edit research task" : "One step closer to discovery"}
      description="Give your team a clear outcome, an owner, and a deadline."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit(onSave)}>
        <label>
          Task title
          <input {...register("title")} placeholder="What needs to happen?" />
          {errors.title && (
            <small className="field-error">{errors.title.message}</small>
          )}
        </label>
        <label>
          Description
          <textarea
            {...register("description")}
            rows={3}
            placeholder="Add context, deliverables, and acceptance criteria…"
          />
        </label>
        <div className="form-grid">
          <label>
            Research phase
            <select {...register("phase_id")}>
              <option value="">No phase</option>
              {data.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignee
            <select {...register("assignee_id")}>
              <option value="">Unassigned</option>
              {data.members
                .filter((m) => m.role !== "supervisor")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.rf_profiles.full_name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Priority
            <select {...register("priority")}>
              {priorities.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" {...register("due_date")} />
          </label>
          <label>
            Estimated hours
            <input
              type="number"
              step="0.5"
              min="0.5"
              {...register("estimated_hours")}
            />
            {errors.estimated_hours && (
              <small className="field-error">
                {errors.estimated_hours.message}
              </small>
            )}
          </label>
        </div>
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : task ? "Save task" : "Create task"}
          <ArrowUpRight size={16} />
        </Button>
      </form>
    </Modal>
  );
}
export default function WorkspaceView({
  data,
  userId,
  name,
  page,
  search,
  busy,
  mutate,
}: Props) {
  const { workspace: w, members, phases, tasks, audit, invitations } = data;
  const role = members.find((m) => m.user_id === userId)?.role;
  const leader = role === "leader";
  const [taskDialog, setTaskDialog] = useState<Task | null | undefined>(
    undefined,
  );
  const [phaseDialog, setPhaseDialog] = useState<Phase | null | undefined>(
    undefined,
  );
  const [invite, setInvite] = useState(false);
  const [deleteInvite, setDeleteInvite] = useState<Invitation | null>(null);
  const [editResearch, setEditResearch] = useState(false);
  const capacity = workspaceCapacity(members);
  const [view, setView] = useState("board");
  const [status, setStatus] = useState("All statuses");
  const [memberFilter, setMemberFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [logo, setLogo] = useState("");
  const [copied, setCopied] = useState("");
  const [profile, setProfile] = useState(false);
  useEffect(() => {
    let alive = true;
    if (w.logo_path)
      supabase.storage
        .from("researchflow-logos")
        .createSignedUrl(w.logo_path, 3600)
        .then(({ data }) => {
          if (alive) setLogo(data?.signedUrl || "");
        });
    return () => {
      alive = false;
    };
  }, [w.logo_path]);
  const activeTasks = tasks.filter((t) => !t.archived);
  const done = activeTasks.filter((t) => t.status === "Completed");
  const overdue = activeTasks.filter((t) => isOverdue(t));
  const review = activeTasks.filter((t) => t.status === "In Review");
  const overall = progress(tasks);
  const activePhase =
    phases.find((p) => p.status === "In Progress") ||
    phases.find((p) => p.status !== "Completed");
  const memberName = (id: string | null) =>
    members.find((m) => m.user_id === id)?.rf_profiles.full_name ||
    "Unassigned";
  const filtered = tasks.filter(
    (t) =>
      t.archived === showArchived &&
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (status === "All statuses" || t.status === status) &&
      (!memberFilter || t.assignee_id === memberFilter) &&
      (!priorityFilter || t.priority === priorityFilter) &&
      (!phaseFilter || t.phase_id === phaseFilter),
  );
  async function saveTask(values: TaskValues) {
    await mutate(
      async () => {
        const payload = {
          ...values,
          workspace_id: w.id,
          phase_id: values.phase_id || null,
          assignee_id: values.assignee_id || null,
          due_date: values.due_date || null,
          estimated_hours: values.estimated_hours
            ? Number(values.estimated_hours)
            : null,
        };
        if (taskDialog)
          check(
            await supabase
              .from("rf_tasks")
              .update(payload)
              .eq("id", taskDialog.id),
          );
        else check(await supabase.from("rf_tasks").insert(payload));
        setTaskDialog(undefined);
      },
      taskDialog ? "Task updated" : "Task created",
    );
  }
  async function savePhase(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(async () => {
      const payload = {
        workspace_id: w.id,
        name: f.get("name"),
        description: f.get("description"),
        objectives: f.get("objectives"),
        start_date: f.get("start_date") || null,
        deadline: f.get("deadline") || null,
        owner_id: f.get("owner_id") || null,
        status: f.get("status"),
        position: phaseDialog?.position ?? phases.length,
      };
      if (phaseDialog)
        check(
          await supabase
            .from("rf_research_phases")
            .update(payload)
            .eq("id", phaseDialog.id),
        );
      else check(await supabase.from("rf_research_phases").insert(payload));
      setPhaseDialog(undefined);
    }, "Research phase saved");
  }
  const canUpdate = (t: Task) =>
    leader ||
    (role === "member" && t.assignee_id === userId && t.status !== "Completed");
  const TaskCard = ({ task: t }: { task: Task }) => (
    <article className="task-card">
      <div className="task-card-top">
        <span className={`priority priority-${t.priority.toLowerCase()}`}>
          {t.priority}
        </span>
        {leader && (
          <button
            className="icon-button"
            aria-label={`Edit ${t.title}`}
            onClick={() => setTaskDialog(t)}
          >
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>
      <h3>{t.title}</h3>
      {t.description && <p>{t.description}</p>}
      <span className="task-phase">
        <Layers3 size={12} />
        {phases.find((p) => p.id === t.phase_id)?.name || "Independent task"}
      </span>
      <div className="task-card-bottom">
        <span className={isOverdue(t) ? "overdue-text" : ""}>
          <CalendarDays size={13} />
          {date(t.due_date)}
        </span>
        <span className="avatar tiny" title={memberName(t.assignee_id)}>
          {t.assignee_id ? initials(memberName(t.assignee_id)) : "–"}
        </span>
      </div>
      {canUpdate(t) && (
        <div className="task-actions">
          <select
            aria-label={`Status for ${t.title}`}
            disabled={busy}
            value={t.status}
            onChange={(e) =>
              void mutate(async () => {
                check(
                  await supabase
                    .from("rf_tasks")
                    .update({ status: e.target.value })
                    .eq("id", t.id),
                );
              }, "Task status updated")
            }
          >
            {statuses
              .filter((s) => leader || s !== "Completed")
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
          {leader && (
            <button
              className="icon-button"
              disabled={busy}
              aria-label={t.archived ? "Restore task" : "Archive task"}
              onClick={() =>
                void mutate(
                  async () => {
                    check(
                      await supabase
                        .from("rf_tasks")
                        .update({ archived: !t.archived })
                        .eq("id", t.id),
                    );
                  },
                  t.archived ? "Task restored" : "Task archived",
                )
              }
            >
              <Archive size={15} />
            </button>
          )}
        </div>
      )}
    </article>
  );
  const heading = (
    eyebrow: string,
    title: string,
    desc: string,
    action?: React.ReactNode,
  ) => (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
  return (
    <>
      {page === "dashboard" || page === "" ? (
        <>
          {heading(
            "YOUR RESEARCH, AT A GLANCE",
            `Let’s make progress, ${name.split(" ")[0]}.`,
            "Every small step brings your next breakthrough closer.",
            leader ? (
              <Button onClick={() => setTaskDialog(null)}>
                <Plus size={17} />
                Create task
              </Button>
            ) : undefined,
          )}
          <section className="project-banner">
            <div className="banner-copy">
              <span className="banner-tag">
                <span className="status-dot" />
                {w.institution || "YOUR RESEARCH WORKSPACE"}
              </span>
              <h2>{w.research_title || w.name}</h2>
              <p>
                {w.description ||
                  "One shared direction. A team ready to discover what comes next."}
              </p>
              <div className="banner-meta">
                <span>
                  <Users size={15} />
                  {members.length} team member{members.length !== 1 ? "s" : ""}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {w.deadline
                    ? `Target: ${date(w.deadline)}`
                    : "Set a research deadline in settings"}
                </span>
              </div>
              <Link to="/phases">
                Explore research phases <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="progress-orbit">
              <svg viewBox="0 0 140 140" aria-label={`${overall}% complete`}>
                <circle className="orbit-track" cx="70" cy="70" r="59" />
                <circle
                  className="orbit-fill"
                  cx="70"
                  cy="70"
                  r="59"
                  pathLength="100"
                  strokeDasharray={`${overall} 100`}
                />
              </svg>
              <div>
                <strong>
                  {overall}
                  <span>%</span>
                </strong>
                <small>Overall progress</small>
              </div>
            </div>
          </section>
          <div className="stats-grid">
            {[
              {
                label: "Total tasks",
                value: activeTasks.length,
                detail: `${done.length} completed`,
                icon: ListTodo,
                color: "blue",
              },
              {
                label: "In progress",
                value: activeTasks.filter((t) => t.status === "In Progress")
                  .length,
                detail: "Moving research forward",
                icon: Clock3,
                color: "teal",
              },
              {
                label: "Pending review",
                value: review.length,
                detail: "Ready for a second look",
                icon: CheckCircle2,
                color: "purple",
              },
              {
                label: "Overdue tasks",
                value: overdue.length,
                detail: overdue.length
                  ? "A little attention needed"
                  : "You’re right on track",
                icon: Target,
                color: "orange",
              },
            ].map((s) => (
              <section className="stat-card" key={s.label}>
                <div>
                  <span>{s.label}</span>
                  <span className={`stat-icon ${s.color}`}>
                    <s.icon size={18} />
                  </span>
                </div>
                <strong>{s.value.toString().padStart(2, "0")}</strong>
                <small>{s.detail}</small>
              </section>
            ))}
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Research roadmap</h2>
                  <p>A clear path from question to contribution.</p>
                </div>
                <Link to="/phases">
                  View all <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="roadmap">
                {phases.slice(0, 4).map((p, i) => (
                  <div className="roadmap-row" key={p.id}>
                    <span
                      className={`phase-number ${p.status === "Completed" ? "complete" : p.id === activePhase?.id ? "current" : ""}`}
                    >
                      {p.status === "Completed" ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      <small>
                        {p.deadline
                          ? `Due ${date(p.deadline)}`
                          : "Deadline not set"}
                      </small>
                    </div>
                    <Badge value={p.status} />
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Workspace activity</h2>
                  <p>Recorded changes over the past 7 days.</p>
                </div>
                <span className="subtle-tag">THIS WEEK</span>
              </div>
              {audit.length ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={190}>
                    <AreaChart
                      data={Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - 6 + i);
                        return {
                          day: d.toLocaleDateString(undefined, {
                            weekday: "short",
                          }),
                          changes: audit.filter(
                            (a) =>
                              new Date(a.created_at).toDateString() ===
                              d.toDateString(),
                          ).length,
                        };
                      })}
                    >
                      <defs>
                        <linearGradient
                          id="activityFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#168e88"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="#168e88"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 5"
                        stroke="#dce5e9"
                      />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#84909f" }}
                      />
                      <Tooltip />
                      <Area
                        dataKey="changes"
                        stroke="#168e88"
                        strokeWidth={2.5}
                        fill="url(#activityFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <small>
                    Latest 20 audit records · activity is not a measure of
                    contribution.
                  </small>
                </div>
              ) : (
                <Empty title="Your story is just beginning">
                  Create a task or update a phase to record your first activity.
                </Empty>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Coming up next</h2>
                  <p>The next steps that deserve your focus.</p>
                </div>
                <Link to="/tasks">
                  All tasks <ArrowUpRight size={14} />
                </Link>
              </div>
              {activeTasks
                .filter((t) => t.status !== "Completed")
                .sort((a, b) =>
                  (a.due_date || "9999").localeCompare(b.due_date || "9999"),
                )
                .slice(0, 4)
                .map((t) => (
                  <div className="upcoming-row" key={t.id}>
                    <span className="task-checkbox" />
                    <div>
                      <strong>{t.title}</strong>
                      <small>
                        {memberName(t.assignee_id)} <span>·</span>{" "}
                        {date(t.due_date)}
                      </small>
                    </div>
                    <Badge value={t.status} />
                  </div>
                ))}
              {!activeTasks.some((t) => t.status !== "Completed") && (
                <Empty title="A fresh page for your research">
                  {leader
                    ? "Add your first task to give your team a clear next step."
                    : "Your leader’s assigned tasks will appear here."}
                </Empty>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Team contributions</h2>
                  <p>Completed tasks with a recorded owner.</p>
                </div>
                <Link to="/team">
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="contributions">
                {members.map((m) => {
                  const assigned = activeTasks.filter(
                    (t) => t.assignee_id === m.user_id,
                  );
                  return (
                    <div className="contribution-row" key={m.user_id}>
                      <span className="avatar">
                        {initials(m.rf_profiles.full_name)}
                      </span>
                      <div>
                        <strong>{m.rf_profiles.full_name}</strong>
                        <small>{m.role}</small>
                      </div>
                      <div className="contribution-bar">
                        <span style={{ width: `${progress(assigned)}%` }} />
                      </div>
                      <span>
                        {
                          assigned.filter((t) => t.status === "Completed")
                            .length
                        }
                        <small>/{assigned.length}</small>
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <CollaborationSummary
            workspaceId={w.id}
            userId={userId}
            activity={audit}
            members={members}
          />
        </>
      ) : page === "tasks" ? (
        <>
          {heading(
            "A SHARED PLAN, ONE STEP AT A TIME",
            "The work that moves you forward.",
            "Keep responsibilities clear and your research in motion.",
            leader ? (
              <Button onClick={() => setTaskDialog(null)}>
                <Plus size={17} />
                Create task
              </Button>
            ) : undefined,
          )}
          <div className="toolbar">
            <div className="view-toggle">
              <button
                className={view === "board" ? "selected" : ""}
                onClick={() => setView("board")}
              >
                <LayoutGrid size={16} />
                Board
              </button>
              <button
                className={view === "list" ? "selected" : ""}
                onClick={() => setView("list")}
              >
                <List size={16} />
                List
              </button>
            </div>
            <div className="filters">
              <select
                aria-label="Filter status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>All statuses</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter assignee"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
              >
                <option value="">All members</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.rf_profiles.full_name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">All priorities</option>
                {priorities.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select
                aria-label="Filter phase"
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
              >
                <option value="">All phases</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className={`icon-button ${showArchived ? "selected" : ""}`}
                aria-label={
                  showArchived ? "Show active tasks" : "Show archived tasks"
                }
                title="Toggle archive"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive size={17} />
              </button>
            </div>
          </div>
          {!filtered.length ? (
            <Empty
              title={
                search ? "No matching tasks" : "Make the next step a clear one"
              }
              action={
                leader ? (
                  <Button onClick={() => setTaskDialog(null)}>
                    <Plus size={16} />
                    Add a task
                  </Button>
                ) : undefined
              }
            >
              {search
                ? "Try another search or adjust the filters."
                : "Tasks in this view will appear here. Start with a focused, achievable outcome."}
            </Empty>
          ) : view === "board" ? (
            <div className="kanban">
              {statuses.map((s) => (
                <section className="kanban-column" key={s}>
                  <h2>
                    <span
                      className={`column-dot dot-${s.toLowerCase().replaceAll(" ", "-")}`}
                    />
                    {s}
                    <span>{filtered.filter((t) => t.status === s).length}</span>
                  </h2>
                  {filtered
                    .filter((t) => t.status === s)
                    .map((t) => (
                      <TaskCard key={t.id} task={t} />
                    ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="task-list">
              {filtered.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          )}
        </>
      ) : page === "phases" ? (
        <>
          {heading(
            "FROM THE FIRST QUESTION TO THE FINAL PAPER",
            "Give your research direction.",
            "Editable phases keep everyone aligned on what comes next.",
            leader ? (
              <Button onClick={() => setPhaseDialog(null)}>
                <Plus size={17} />
                Add phase
              </Button>
            ) : undefined,
          )}
          <div className="phase-grid">
            {phases.map((p, i) => (
              <section className="phase-card panel" key={p.id}>
                <div className="phase-card-top">
                  <span className="eyebrow">
                    PHASE {String(i + 1).padStart(2, "0")}
                  </span>
                  {leader && (
                    <button
                      className="icon-button"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setPhaseDialog(p)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </div>
                <h2>{p.name}</h2>
                <p>
                  {p.description ||
                    "Add a description to give this phase a shared direction."}
                </p>
                {p.objectives && (
                  <p className="phase-objectives">{p.objectives}</p>
                )}
                <div className="phase-progress-label">
                  <span>
                    {
                      tasks.filter(
                        (t) =>
                          t.phase_id === p.id &&
                          !t.archived &&
                          t.status === "Completed",
                      ).length
                    }{" "}
                    /{" "}
                    {
                      tasks.filter((t) => t.phase_id === p.id && !t.archived)
                        .length
                    }{" "}
                    tasks complete
                  </span>
                  <strong>
                    {progress(tasks.filter((t) => t.phase_id === p.id))}%
                  </strong>
                </div>
                <div className="progress-track">
                  <span
                    style={{
                      width: `${progress(tasks.filter((t) => t.phase_id === p.id))}%`,
                    }}
                  />
                </div>
                <div className="phase-card-meta">
                  <span>
                    <CalendarDays size={14} />
                    {date(p.deadline)}
                  </span>
                  <Badge value={p.status} />
                </div>
                <div className="phase-owner">
                  <span className="avatar tiny">
                    {p.owner_id ? initials(memberName(p.owner_id)) : "–"}
                  </span>
                  {memberName(p.owner_id)}
                  <span>Review: {p.review_state}</span>
                </div>
              </section>
            ))}
          </div>
        </>
      ) : page === "team" ? (
        <>
          {heading(
            "BETTER QUESTIONS. SHARED DISCOVERIES.",
            "Meet the minds behind the research.",
            `${capacity.team}/6 team members (including leaders) · ${capacity.supervisors}/1 supervisor · ${members.length}/7 total`,
            leader ? (
              <Button disabled={capacity.full} onClick={() => setInvite(true)}>
                <Plus size={17} />
                {capacity.full ? "Workspace full (7/7)" : "Invite teammate"}
              </Button>
            ) : undefined,
          )}
          <section className="panel team-research">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">RESEARCH TITLE</span>
                <h2>{w.research_title || "Add your research title"}</h2>
                <p>{w.name}</p>
              </div>
              {leader && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setEditResearch(true)}
                >
                  <Pencil size={14} /> Edit research title
                </Button>
              )}
            </div>
          </section>
          <div className="member-grid">
            {members.map((m) => (
              <section className="panel member-card" key={m.user_id}>
                <span className="avatar large">
                  {initials(m.rf_profiles.full_name)}
                </span>
                <h2>
                  {m.rf_profiles.full_name}
                  {m.user_id === userId && <small> (you)</small>}
                </h2>
                <Badge value={m.role} />
                <p>
                  {m.rf_profiles.skills ||
                    "Skills and interests not added yet."}
                </p>
                <small>
                  {m.responsibilities ||
                    `${activeTasks.filter((t) => t.assignee_id === m.user_id).length} assigned tasks`}
                </small>
                {leader && m.user_id !== w.created_by && (
                  <div className="member-actions">
                    <select
                      aria-label={`Role for ${m.rf_profiles.full_name}`}
                      disabled={busy}
                      value={m.role}
                      onChange={(e) =>
                        void mutate(async () => {
                          check(
                            await supabase.rpc("rf_manage_member", {
                              w: w.id,
                              target: m.user_id,
                              new_role: e.target.value as Role,
                            }),
                          );
                        }, "Member role updated")
                      }
                    >
                      <option
                        value="member"
                        disabled={
                          m.role === "supervisor" && !capacity.canInviteMember
                        }
                      >
                        Member
                      </option>
                      <option
                        value="supervisor"
                        disabled={
                          m.role !== "supervisor" &&
                          !capacity.canInviteSupervisor
                        }
                      >
                        Supervisor
                      </option>
                      <option
                        value="leader"
                        disabled={
                          m.role === "supervisor" && !capacity.canInviteMember
                        }
                      >
                        Leader
                      </option>
                    </select>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${m.rf_profiles.full_name} from this workspace? Their tasks will become unassigned.`,
                          )
                        )
                          void mutate(async () => {
                            check(
                              await supabase.rpc("rf_manage_member", {
                                w: w.id,
                                target: m.user_id,
                                new_role: null,
                              }),
                            );
                          }, "Member removed");
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>
          {leader && (
            <section className="panel invite-list">
              <div className="panel-heading">
                <div>
                  <h2>Workspace invitations</h2>
                  <p>
                    All invitees, including pending, accepted and expired
                    invitations. Deleting an invitation does not remove an
                    existing member.
                  </p>
                </div>
              </div>
              {invitations.length === 0 && (
                <Empty title="No invitations yet">
                  Invite a teammate to generate a secure, email-bound link.
                </Empty>
              )}
              {invitations.map((i) => (
                <div className="invitation-row" key={i.id}>
                  <div>
                    <strong>{i.email}</strong>
                    <small>
                      {i.role} ·{" "}
                      {i.accepted_at
                        ? "Accepted"
                        : new Date(i.expires_at) < new Date()
                          ? "Expired"
                          : `Pending · Expires ${new Date(i.expires_at).toLocaleDateString()}`}
                    </small>
                  </div>
                  {!i.accepted_at && new Date(i.expires_at) > new Date() && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void mutate(async () => {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/?invite=${i.token}`,
                            );
                            setCopied(i.id);
                          }, "Invitation link copied")
                        }
                      >
                        <Copy size={14} />
                        {copied === i.id ? "Copied" : "Copy link"}
                      </Button>
                    </>
                  )}
                  <Button
                    variant="destructive"
                    aria-label={`Delete invitation for ${i.email}`}
                    disabled={busy}
                    onClick={() => setDeleteInvite(i)}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </div>
              ))}
            </section>
          )}
        </>
      ) : page === "settings" ? (
        <>
          {heading(
            "MAKE THIS SPACE YOUR OWN",
            "A workspace that feels like your team.",
            "Your team’s identity can evolve. ResearchFlow remains your shared home.",
          )}
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Team & research</h2>
                <p>
                  {leader
                    ? "Update your team’s identity and research details."
                    : "Only team leaders can update workspace settings."}
                </p>
              </div>
              <Badge value={role || "member"} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void mutate(async () => {
                  const payload = Object.fromEntries(f.entries());
                  check(
                    await supabase
                      .from("rf_workspaces")
                      .update({
                        ...payload,
                        start_date: f.get("start_date") || null,
                        deadline: f.get("deadline") || null,
                      })
                      .eq("id", w.id),
                  );
                }, "Workspace settings saved");
              }}
            >
              <fieldset disabled={!leader || busy}>
                <div className="form-grid">
                  <label>
                    Team name
                    <input
                      name="name"
                      defaultValue={w.name}
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    Research title
                    <input
                      name="research_title"
                      defaultValue={w.research_title}
                      maxLength={300}
                    />
                  </label>
                  <label>
                    Institution
                    <input
                      name="institution"
                      defaultValue={w.institution}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Department
                    <input
                      name="department"
                      defaultValue={w.department}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Programme
                    <input
                      name="programme"
                      defaultValue={w.programme}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    Supervisor details
                    <input
                      name="supervisor_details"
                      defaultValue={w.supervisor_details}
                      maxLength={300}
                    />
                  </label>
                  <label>
                    Research start
                    <input
                      name="start_date"
                      type="date"
                      defaultValue={w.start_date || ""}
                    />
                  </label>
                  <label>
                    Research deadline
                    <input
                      name="deadline"
                      type="date"
                      defaultValue={w.deadline || ""}
                    />
                  </label>
                  <label>
                    Accent color
                    <input
                      name="accent_color"
                      type="color"
                      defaultValue={w.accent_color}
                    />
                  </label>
                </div>
                <label>
                  Research description
                  <textarea
                    name="description"
                    defaultValue={w.description}
                    rows={4}
                    maxLength={10000}
                  />
                </label>
                {leader && (
                  <Button disabled={busy} type="submit">
                    Save workspace settings <ArrowRight size={16} />
                  </Button>
                )}
              </fieldset>
            </form>
            <div className="logo-upload">
              {logo ? (
                <img src={logo} alt={`${w.name} logo`} />
              ) : (
                <span className="workspace-avatar">
                  <GitBranch size={22} />
                </span>
              )}
              <div>
                <h3>Team logo</h3>
                <p>
                  PNG, JPEG or WebP · Maximum 2 MB · Visible to workspace
                  members.
                </p>
                {leader && (
                  <label className="upload-label">
                    <Upload size={15} />
                    Upload new logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        void mutate(async () => {
                          if (
                            file.size > 2097152 ||
                            !["image/png", "image/jpeg", "image/webp"].includes(
                              file.type,
                            )
                          )
                            throw new Error(
                              "Choose a PNG, JPEG or WebP image smaller than 2 MB",
                            );
                          const path = `${w.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
                          check(
                            await supabase.storage
                              .from("researchflow-logos")
                              .upload(path, file),
                          );
                          check(
                            await supabase
                              .from("rf_workspaces")
                              .update({ logo_path: path })
                              .eq("id", w.id),
                          );
                        }, "Team logo updated");
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </section>
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Your profile & security</h2>
                <p>
                  Manage your name, research interests, and individual account.
                </p>
              </div>
              <Button variant="outline" onClick={() => setProfile(true)}>
                <Pencil size={14} />
                Edit profile
              </Button>
            </div>
            <p>
              Signed in as {name}. Workspace permissions are assigned by your
              team leader.
            </p>
            <Link
              className="text-link"
              to="/reset-password"
              onClick={() =>
                void mutate(async () => {
                  const { data } = await supabase.auth.getUser();
                  if (data.user?.email)
                    check(
                      await supabase.auth.resetPasswordForEmail(
                        data.user.email,
                        {
                          redirectTo: `${window.location.origin}/reset-password`,
                        },
                      ),
                    );
                }, "Check your email for the password reset link")
              }
            >
              Send a password reset link <ExternalLink size={14} />
            </Link>
          </section>
        </>
      ) : (
        <Empty title="This page is not available">
          Choose Overview, Tasks, Research phases, Team members, or Settings
          from the navigation.
        </Empty>
      )}
      {taskDialog !== undefined && (
        <TaskForm
          data={data}
          task={taskDialog}
          busy={busy}
          onSave={saveTask}
          onClose={() => setTaskDialog(undefined)}
        />
      )}
      {phaseDialog !== undefined && (
        <Modal
          title={phaseDialog ? "Edit research phase" : "Create research phase"}
          onClose={() => setPhaseDialog(undefined)}
        >
          <form onSubmit={savePhase}>
            <label>
              Phase name
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={phaseDialog?.name}
              />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={phaseDialog?.description}
              />
            </label>
            <label>
              Objectives
              <textarea
                name="objectives"
                defaultValue={phaseDialog?.objectives}
              />
            </label>
            <div className="form-grid">
              <label>
                Start date
                <input
                  type="date"
                  name="start_date"
                  defaultValue={phaseDialog?.start_date || ""}
                />
              </label>
              <label>
                Deadline
                <input
                  type="date"
                  name="deadline"
                  defaultValue={phaseDialog?.deadline || ""}
                />
              </label>
              <label>
                Phase owner
                <select
                  name="owner_id"
                  defaultValue={phaseDialog?.owner_id || ""}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.rf_profiles.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  name="status"
                  defaultValue={phaseDialog?.status || "To Do"}
                >
                  <option>To Do</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </label>
            </div>
            <p className="form-hint">
              Progress is calculated from completed, non-archived tasks.
              Submit this phase in Supervisor Reviews for academic feedback.
            </p>
            <Button disabled={busy}>Save phase</Button>
          </form>
        </Modal>
      )}
      {editResearch && leader && (
        <Modal
          title="Edit research title"
          onClose={() => setEditResearch(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = String(
                new FormData(e.currentTarget).get("research_title") || "",
              ).trim();
              if (!title) return;
              void mutate(async () => {
                check(
                  await supabase
                    .from("rf_workspaces")
                    .update({ research_title: title })
                    .eq("id", w.id)
                    .select("id")
                    .single(),
                );
                setEditResearch(false);
              }, "Research title saved");
            }}
          >
            <label>
              Research title
              <input
                name="research_title"
                required
                pattern={".*\\S.*"}
                maxLength={300}
                defaultValue={w.research_title}
              />
            </label>
            <Button type="submit" disabled={busy}>
              Save research title
            </Button>
          </form>
        </Modal>
      )}
      {deleteInvite && leader && (
        <Modal
          title="Delete workspace invitation?"
          description={`Delete the invitation for ${deleteInvite.email}? An unused link will stop working. Existing workspace members will keep their access.`}
          onClose={() => setDeleteInvite(null)}
        >
          <div className="member-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteInvite(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  check(
                    await supabase
                      .from("rf_workspace_invitations")
                      .delete()
                      .eq("workspace_id", w.id)
                      .eq("id", deleteInvite.id)
                      .select("id")
                      .single(),
                  );
                  setDeleteInvite(null);
                }, "Invitation deleted")
              }
            >
              Delete invitation
            </Button>
          </div>
        </Modal>
      )}
      {invite && (
        <Modal
          title="Research is better together"
          description="Create a secure invitation for a teammate or academic supervisor."
          onClose={() => setInvite(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate(async () => {
                check(
                  await supabase.from("rf_workspace_invitations").insert({
                    workspace_id: w.id,
                    email: String(f.get("email")).trim().toLowerCase(),
                    role: f.get("role"),
                  }),
                );
                setInvite(false);
              }, "Invitation created. Copy the link from the invitations list.");
            }}
          >
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@university.edu"
              />
            </label>
            <label>
              Workspace role
              <select
                name="role"
                defaultValue={
                  capacity.canInviteMember ? "member" : "supervisor"
                }
              >
                <option value="member" disabled={!capacity.canInviteMember}>
                  Team member
                </option>
                <option
                  value="supervisor"
                  disabled={!capacity.canInviteSupervisor}
                >
                  Academic supervisor
                </option>
              </select>
            </label>
            <p className="form-hint">
              An invitation link will be generated. Share it with this person
              directly. They must sign in with this verified email address. Each
              workspace has six team places, including the leader, plus one
              supervisor place (seven people total). Pending invitations do not
              reserve places.
            </p>
            <Button disabled={busy || capacity.full}>
              Create invitation <ArrowUpRight size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {profile && (
        <Modal title="Your research profile" onClose={() => setProfile(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutate(async () => {
                check(
                  await supabase
                    .from("rf_profiles")
                    .update({
                      full_name: f.get("name"),
                      skills: f.get("skills"),
                    })
                    .eq("id", userId),
                );
                setProfile(false);
              }, "Profile updated");
            }}
          >
            <label>
              Full name
              <input name="name" required maxLength={120} defaultValue={name} />
            </label>
            <label>
              Skills & research interests
              <textarea
                name="skills"
                maxLength={2000}
                defaultValue={
                  members.find((m) => m.user_id === userId)?.rf_profiles.skills
                }
              />
            </label>
            <Button disabled={busy}>Save profile</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
