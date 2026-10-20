import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Empty } from "../components/ui";
import { Editor, choices, formValues, type Field } from "./Forms";
import {
  completion,
  downloadText,
  importReferences,
  paperStatuses,
  referenceBib,
  referenceCsv,
  sectionStatuses,
  wordCount,
  type Paper,
  type Section,
} from "./model";
import { useResearch } from "./ResearchView";
export default function Papers() {
  const c = useResearch();
  const {
    data,
    workspace,
    leader,
    supervisor,
    act,
    run,
    busy,
    userId,
    collaboration,
  } = c;
  const [selected, setSelected] = useState("");
  const [edit, setEdit] = useState<Paper | "new" | null>(null);
  const [section, setSection] = useState<Section | "new" | null>(null);
  const [feedback, setFeedback] = useState<Section | null>(null);
  const [reference, setReference] = useState(false);
  const paper = data.papers.find((p) => p.id === selected) || data.papers[0];
  const sections = data.sections
    .filter((s) => s.paper_id === paper?.id)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const refs = data.references.filter((r) => r.paper_id === paper?.id);
  const people = workspace.members.map((m) => ({
    value: m.user_id,
    label: m.rf_profiles.full_name,
  }));
  const person = (id: string) =>
    people.find((p) => p.value === id)?.label || "Former member";
  const fields: Field[] = [
    { key: "title", label: "Paper title", required: true },
    { key: "abstract", label: "Abstract", type: "textarea" },
    { key: "keywords", label: "Keywords" },
    {
      key: "authors",
      label: "Authors",
      type: "multi",
      options: people,
      hint: "Use the reorder buttons in the paper overview to set publication order.",
    },
    {
      key: "corresponding_author",
      label: "Corresponding author",
      type: "select",
      options: people,
    },
    {
      key: "supervisor_id",
      label: "Supervisor",
      type: "select",
      options: people.filter((p) =>
        workspace.members.some(
          (m) => m.user_id === p.value && m.role === "supervisor",
        ),
      ),
    },
    { key: "venue", label: "Target publication or symposium" },
    { key: "deadline", label: "Submission deadline", type: "date" },
    {
      key: "publication_date",
      label: "Publication or symposium date",
      type: "date",
    },
    {
      key: "status",
      label: "Paper status",
      type: "select",
      options: choices(paperStatuses),
      required: true,
    },
  ];
  const sectionFields: Field[] = [
    { key: "title", label: "Section title", required: true, disabled: !leader },
    {
      key: "position",
      label: "Outline position",
      type: "number",
      disabled: !leader,
    },
    { key: "notes", label: "Section notes", type: "textarea" },
    {
      key: "assignees",
      label: "Assigned members",
      type: "multi",
      options: people.filter(
        (p) =>
          !workspace.members.some(
            (m) => m.user_id === p.value && m.role === "supervisor",
          ),
      ),
      disabled: !leader,
    },
    {
      key: "deadline",
      label: "Section deadline",
      type: "date",
      disabled: !leader,
    },
    {
      key: "status",
      label: "Section status",
      type: "select",
      required: true,
      options: choices(sectionStatuses),
    },
    {
      key: "task_id",
      label: "Related task",
      type: "select",
      options: workspace.tasks.map((t) => ({ value: t.id, label: t.title })),
      disabled: !leader,
    },
    {
      key: "version_id",
      label: "Draft document version",
      type: "select",
      options: collaboration.versions.map((v) => ({
        value: v.id,
        label: `${collaboration.documents.find((d) => d.id === v.document_id)?.title || "Document"} · v${v.version}`,
      })),
      hint: "Upload a draft in Documents, then select its immutable version here. Editing a section resets prior approval.",
    },
  ];
  return (
    <>
      <div className="research-toolbar">
        <h2>Research papers</h2>
        {leader && <Button onClick={() => setEdit("new")}>New paper</Button>}
      </div>
      <p className="research-notice">
        Completion = supervisor-approved sections ÷ all outline sections. This
        tracks workflow approval, not scientific quality. Project:{" "}
        {workspace.workspace.research_title || "Not configured"}.
      </p>
      {!paper ? (
        <Empty title="Plan your first paper">
          A team leader can create a paper and assign its outline.
        </Empty>
      ) : (
        <>
          <label>
            Choose paper
            <select
              aria-label="Choose paper"
              value={paper.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {data.papers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <article className="research-card">
            <div className="research-toolbar">
              <h2>{paper.title}</h2>
              {leader && (
                <Button variant="outline" onClick={() => setEdit(paper)}>
                  Edit paper
                </Button>
              )}
            </div>
            <p>{paper.abstract || "Abstract not recorded"}</p>
            <span className="research-status">{paper.status}</span>
            <p>
              {paper.venue || "Publication not configured"} · Due{" "}
              {paper.deadline || "not set"} · {completion(sections) ?? "—"}%
              approved
            </p>
            <progress
              max="100"
              value={completion(sections) ?? 0}
              aria-label="Paper section approval progress"
            />
            <ol>
              {paper.authors.map((id, i) => (
                <li key={id}>
                  {person(id)}
                  {id === paper.corresponding_author
                    ? " · Corresponding author"
                    : ""}
                  {leader && i > 0 && (
                    <Button
                      variant="ghost"
                      aria-label={`Move ${person(id)} up`}
                      onClick={() =>
                        void run(async () => {
                          const authors = [...paper.authors];
                          [authors[i - 1], authors[i]] = [
                            authors[i],
                            authors[i - 1],
                          ];
                          await act("paper_save", { ...paper, authors });
                        })
                      }
                    >
                      Move up
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            <small>
              Supervisor:{" "}
              {paper.supervisor_id
                ? person(paper.supervisor_id)
                : "Not assigned"}{" "}
              · Keywords: {paper.keywords || "Not recorded"}
            </small>
          </article>
          <div className="research-toolbar">
            <h3>Outline & section checklist</h3>
            {leader && (
              <Button variant="outline" onClick={() => setSection("new")}>
                Add section
              </Button>
            )}
            <Link to="/documents">Upload paper drafts</Link>
          </div>
          <div className="research-grid">
            {sections.map((s) => (
              <article className="research-card" key={s.id}>
                <h3>
                  {s.position}. {s.title}
                </h3>
                <span className="research-status">{s.status}</span>
                <p>
                  {wordCount(s.notes)} note words · Due{" "}
                  {s.deadline || "not set"}
                </p>
                <small>
                  {s.assignees.map(person).join(", ") || "Unassigned"}
                  {s.version_id &&
                    ` · Linked draft ${collaboration.versions.some((v) => v.id === s.version_id) ? "available in Documents" : "restricted or unavailable"}`}
                </small>
                <p className="research-detail">{s.notes || "No notes yet."}</p>
                {s.task_id && (
                  <Link to={`/tasks?task=${s.task_id}`}>Related task</Link>
                )}
                <div className="research-toolbar">
                  {(leader || s.assignees.includes(userId)) && !supervisor && (
                    <Button variant="outline" onClick={() => setSection(s)}>
                      Edit section
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => setFeedback(s)}>
                    Feedback & history
                  </Button>
                </div>
                {data.feedback
                  .filter((f) => f.section_id === s.id)
                  .slice(-2)
                  .map((f) => (
                    <p key={f.id}>
                      <strong>{f.kind}</strong> · {f.body}
                      <small>
                        {person(f.author_id)} ·{" "}
                        {new Date(f.created_at).toLocaleString()}
                      </small>
                    </p>
                  ))}
              </article>
            ))}
          </div>
          <section className="research-card">
            <div className="research-toolbar">
              <h3>References</h3>
              {!supervisor && (
                <Button onClick={() => setReference(true)}>
                  Add reference
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(referenceCsv(refs), "references.csv", "text/csv")
                }
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  downloadText(referenceBib(refs), "references.bib")
                }
              >
                Export BibTeX
              </Button>
              {!supervisor && (
                <label>
                  Import CSV
                  <input
                    type="file"
                    accept=".csv"
                    aria-label="Import reference CSV"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        void run(async () => {
                          if (file.size > 200000)
                            throw Error("Import limit: 200 KB");
                          await act("reference_save", {
                            paper_id: paper.id,
                            references: importReferences(await file.text()),
                          });
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <small>
              CSV headers: authors,title,year,venue,url,notes. Entries are
              researcher supplied; citations are never generated or verified
              automatically.
            </small>
            <ul className="research-list">
              {refs.map((r) => (
                <li key={r.id}>
                  <strong>{r.title}</strong>
                  <p>
                    {r.authors} · {r.year || "Year unavailable"} · {r.venue}
                  </p>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer">
                      DOI / source
                    </a>
                  )}
                  <p>{r.notes}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      {edit && (
        <Editor
          title={edit === "new" ? "New research paper" : "Edit research paper"}
          fields={fields}
          busy={busy}
          initial={
            edit === "new"
              ? { status: "Planning", authors: [] }
              : formValues(edit)
          }
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            await act("paper_save", {
              ...(edit === "new" ? {} : { id: edit.id }),
              ...v,
            });
            setEdit(null);
          }}
        />
      )}
      {section && paper && (
        <Editor
          title={section === "new" ? "New paper section" : "Edit paper section"}
          fields={sectionFields}
          busy={busy}
          initial={
            section === "new"
              ? {
                  position: String(sections.length + 1),
                  status: "Not Started",
                  assignees: [],
                }
              : formValues({
                  ...section,
                  status:
                    section.status === "Approved" ? "Drafting" : section.status,
                })
          }
          onClose={() => setSection(null)}
          onSave={async (v) => {
            await act("section_save", {
              ...(section === "new" ? {} : section),
              ...v,
              paper_id: paper.id,
            });
            setSection(null);
          }}
        />
      )}
      {feedback && (
        <Editor
          title={`Feedback: ${feedback.title}`}
          fields={[
            {
              key: "kind",
              label: "Feedback type",
              type: "select",
              options: choices(
                supervisor && feedback.status === "Supervisor Review"
                  ? ["Comment", "Approved", "Revision Requested"]
                  : ["Comment"],
              ),
              required: true,
            },
            {
              key: "body",
              label: "Feedback",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{ kind: "Comment" }}
          busy={busy}
          onClose={() => setFeedback(null)}
          onSave={async (v) => {
            await act("section_feedback", { ...v, section_id: feedback.id });
            setFeedback(null);
          }}
        >
          <ul className="research-list">
            {data.feedback
              .filter((f) => f.section_id === feedback.id)
              .map((f) => (
                <li key={f.id}>
                  <strong>{f.kind}</strong>
                  <p>{f.body}</p>
                  <small>
                    {person(f.author_id)} ·{" "}
                    {new Date(f.created_at).toLocaleString()}
                  </small>
                </li>
              ))}
          </ul>
        </Editor>
      )}
      {reference && paper && (
        <Editor
          title="Add research reference"
          fields={[
            { key: "authors", label: "Authors" },
            { key: "title", label: "Reference title", required: true },
            { key: "year", label: "Year", type: "number" },
            { key: "venue", label: "Publication venue" },
            { key: "url", label: "HTTPS DOI or source URL" },
            { key: "notes", label: "Citation notes", type: "textarea" },
          ]}
          busy={busy}
          onClose={() => setReference(false)}
          onSave={async (v) => {
            await act("reference_save", {
              paper_id: paper.id,
              references: [v],
            });
            setReference(false);
          }}
        />
      )}
    </>
  );
}
