import { useState } from "react";
import { Link } from "react-router-dom";
import { useResearch } from "./ResearchView";
export default function Timeline() {
  const c = useResearch();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [project, setProject] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  const events = [
    ...c.workspace.phases.map((p) => ({
      id: p.id,
      title: p.name,
      date: p.deadline,
      start: p.start_date,
      state: p.status,
      kind: "Research phase / milestone",
      url: "/phases",
      project: "",
    })),
    ...c.data.papers.flatMap((p) => [
      {
        id: p.id,
        title: p.title,
        date: p.deadline,
        start: null,
        state: p.status,
        kind: "Paper submission",
        url: "/papers",
        project: p.id,
      },
      {
        id: p.id + "-publication",
        title: p.venue || p.title,
        date: p.publication_date,
        start: null,
        state: p.status,
        kind: "Publication / symposium",
        url: "/papers",
        project: p.id,
      },
    ]),
    ...c.data.sections
      .filter((s) => s.status === "Supervisor Review")
      .map((s) => ({
        id: s.id,
        title: s.title,
        date: s.deadline,
        start: null,
        state: s.status,
        kind: "Section review deadline",
        url: "/papers",
        project: s.paper_id,
      })),
    ...c.data.datasets.map((d) => ({
      id: d.id,
      title: d.name,
      date: d.checkpoint_date,
      start: null,
      state: d.status,
      kind: "Dataset readiness checkpoint",
      url: "/datasets",
      project: "",
    })),
  ]
    .filter(
      (e) =>
        e.date &&
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        (!project || e.project === project),
    )
    .sort((a, b) => a.date!.localeCompare(b.date!));
  return (
    <>
      <h2>Research timeline</h2>
      <p className="research-notice">
        Workspace project:{" "}
        {c.workspace.workspace.research_title || "Not configured"}. The
        workspace selector switches independent research projects. Entries reuse
        existing records; nothing is copied into a second task or milestone
        system. Review dates use section deadlines explicitly entered by your
        team.
      </p>
      <div className="research-filter">
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          Paper filter
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Entire research project</option>
            {c.data.papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="research-list">
        {events.map((e) => (
          <li key={e.id}>
            <small>
              {e.kind} · {e.start && `${e.start} → `}
              {e.date}
            </small>
            <h3>
              <Link to={e.url}>{e.title}</Link>
            </h3>
            <span
              className={
                e.date! < today &&
                !["Completed", "Approved", "Published", "Archived"].includes(
                  e.state,
                )
                  ? "research-overdue"
                  : ""
              }
            >
              {e.state}
              {e.date! < today &&
              !["Completed", "Approved", "Published", "Archived"].includes(
                e.state,
              )
                ? " · Past planned date"
                : ""}
            </span>
          </li>
        ))}
      </ol>
      {!events.length && (
        <p>
          No dated checkpoints match the selected range. Dates that have not
          been configured are omitted.
        </p>
      )}
    </>
  );
}
