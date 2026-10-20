import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { statuses } from "../lib/types";
import { choices } from "./Forms";
import {
  completion,
  emptyFilters,
  filterTasks,
  localDay,
  taskMetrics,
  type Filters,
} from "./model";
import { useResearch } from "./ResearchView";
export function ResearchFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
}) {
  const { workspace } = useResearch();
  const field = (
    key: keyof Filters,
    label: string,
    options?: { value: string; label: string }[],
  ) => (
    <label key={key}>
      {label}
      {options ? (
        <select
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        >
          <option value="">All</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="date"
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <div className="research-filter">
      {field("from", "Created from")}
      {field("to", "Created through")}
      {field(
        "member",
        "Member",
        workspace.members.map((m) => ({
          value: m.user_id,
          label: m.rf_profiles.full_name,
        })),
      )}
      {field(
        "phase",
        "Research phase",
        workspace.phases.map((p) => ({ value: p.id, label: p.name })),
      )}
      {field("status", "Task status", choices([...statuses]))}
    </div>
  );
}
export default function Analytics() {
  const c = useResearch();
  const [filter, setFilter] = useState(emptyFilters);
  const tasks = filterTasks(c.workspace.tasks, filter);
  const m = taskMetrics(tasks);
  const members = c.workspace.members.map((p) => ({
    name: p.rf_profiles.full_name,
    total: tasks.filter((t) => t.assignee_id === p.user_id).length,
    open: tasks.filter(
      (t) => t.assignee_id === p.user_id && t.status !== "Completed",
    ).length,
  }));
  const phase = c.workspace.phases.map((p) => {
    const ts = tasks.filter((t) => t.phase_id === p.id);
    return { name: p.name, ...taskMetrics(ts), state: p.status };
  });
  const activity = c.audit.filter(
    (a) =>
      (!filter.member || a.actor_id === filter.member) &&
      (!filter.from || localDay(a.created_at) >= filter.from) &&
      (!filter.to || localDay(a.created_at) <= filter.to),
  );
  const weekly = Object.entries(
    activity.reduce<Record<string, number>>((all, a) => {
      const d = new Date(a.created_at);
      const dow = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - dow);
      const key = d.toLocaleDateString("en-CA");
      all[key] = (all[key] || 0) + 1;
      return all;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, events]) => ({ week, events }));
  const actions = c.collaboration.actions.filter(
    (a) =>
      (!filter.member || a.assignee_id === filter.member) &&
      (!filter.from || a.due_date >= filter.from) &&
      (!filter.to || a.due_date <= filter.to),
  );
  const completedActions = actions.filter((a) =>
    tasks.some((t) => t.id === a.task_id && t.status === "Completed"),
  ).length;
  return (
    <>
      <h2>Research analytics</h2>
      <ResearchFilters value={filter} onChange={setFilter} />
      {filter.from && filter.to && filter.from > filter.to && (
        <p role="alert">The start date must precede the end date.</p>
      )}
      <p className="research-notice">
        Task metrics use active tasks created within the selected date range, in
        your current timezone for overdue checks. Member, phase and task-status
        filters apply to task metrics. Other summaries are explicitly
        workspace-wide and permission-filtered. Counts measure workflow state,
        not research quality or academic contribution.
      </p>
      <div className="research-grid">
        {Object.entries({
          Tasks: m.total,
          Completed: m.completed,
          Overdue: m.overdue,
          Blocked: m.blocked,
          "Task completion": m.percent === null ? "No tasks" : `${m.percent}%`,
          "Pending supervisor reviews": c.collaboration.submissions.filter(
            (s) => s.status === "Submitted for Review",
          ).length,
          "Datasets ready": c.data.datasets.filter(
            (d) =>
              d.status === "Ready for Analysis" &&
              d.permission_status === "Granted",
          ).length,
          "Meeting actions completed": `${completedActions} / ${actions.length}`,
        }).map(([label, value]) => (
          <article className="research-card" key={label}>
            <small>{label}</small>
            <div className="research-stat">{value}</div>
          </article>
        ))}
      </div>
      <section className="research-card">
        <h3>Member workload</h3>
        {tasks.length ? (
          <div
            className="research-chart"
            role="img"
            aria-label="Open tasks by assigned member; table follows"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={members}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="open" fill="#168e88" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No tasks match these filters.</p>
        )}
        <div className="research-table-wrap">
          <table className="research-table">
            <caption>Filtered member workload</caption>
            <thead>
              <tr>
                <th>Member</th>
                <th>Tasks</th>
                <th>Open tasks</th>
              </tr>
            </thead>
            <tbody>
              {members.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.total}</td>
                  <td>{p.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="research-card">
        <h3>Phase progress</h3>
        <small>
          Percent = completed filtered tasks / all filtered tasks in this phase.
          Phase state is tracked separately.
        </small>
        <div className="research-table-wrap">
          <table className="research-table">
            <thead>
              <tr>
                <th>Phase / milestone</th>
                <th>State</th>
                <th>Completed / total tasks</th>
                <th>Task completion</th>
              </tr>
            </thead>
            <tbody>
              {phase.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.state}</td>
                  <td>
                    {p.completed} / {p.total}
                  </td>
                  <td>{p.percent === null ? "No tasks" : `${p.percent}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="research-grid">
        <section className="research-card">
          <h3>Paper approvals · workspace-wide</h3>
          {c.data.papers.map((p) => (
            <p key={p.id}>
              {p.title}:{" "}
              {completion(c.data.sections.filter((s) => s.paper_id === p.id)) ??
                "—"}
              % sections approved
            </p>
          ))}
          {!c.data.papers.length && <p>No papers yet.</p>}
        </section>
        <section className="research-card">
          <h3>Dataset readiness · accessible entries</h3>
          {[
            "Proposed",
            "Permission Pending",
            "Approved for Use",
            "Collected",
            "Under Validation",
            "Ready for Analysis",
            "Restricted",
            "Archived",
          ].map((s) => (
            <p key={s}>
              {s}: {c.data.datasets.filter((d) => d.status === s).length}
            </p>
          ))}
        </section>
      </div>
      <section className="research-card">
        <h3>Weekly activity trend</h3>
        <small>
          Recorded audit events by local Monday-starting week; date/member
          filters apply. Event volume is not a contribution score.
        </small>
        {weekly.length ? (
          <>
            <div
              className="research-chart"
              role="img"
              aria-label="Audit event trend by week; table follows"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly}>
                  <XAxis dataKey="week" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="events" fill="#168e88" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="research-table">
              <thead>
                <tr>
                  <th>Week starting</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.week}>
                    <td>{w.week}</td>
                    <td>{w.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p>Insufficient activity for a trend.</p>
        )}
      </section>
    </>
  );
}
