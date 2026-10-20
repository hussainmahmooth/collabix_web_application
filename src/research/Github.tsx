import { useState } from "react";
import { Button } from "../components/ui";
import { Editor, choices } from "./Forms";
import { emptyFilters, githubUrl, localDay } from "./model";
import { ResearchFilters } from "./Analytics";
import { useResearch } from "./ResearchView";
export default function Github() {
  const c = useResearch();
  const [repo, setRepo] = useState(false);
  const [link, setLink] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const taskIds = c.workspace.tasks
    .filter(
      (t) =>
        (!filters.phase || t.phase_id === filters.phase) &&
        (!filters.status || t.status === filters.status),
    )
    .map((t) => t.id);
  return (
    <>
      <div className="research-toolbar">
        <h2>GitHub development tracking</h2>
        {c.leader && (
          <Button onClick={() => setRepo(true)}>Register repository</Button>
        )}
        {!c.supervisor && (
          <Button variant="outline" onClick={() => setLink(true)}>
            Link development work
          </Button>
        )}
      </div>
      <p className="research-notice">
        Manual links only. No GitHub API credentials or live synchronization are
        configured. Links are researcher-supplied and do not prove authorship or
        academic contribution.
      </p>
      <ResearchFilters value={filters} onChange={setFilters} />
      <section className="research-card">
        <h3>Registered repositories</h3>
        {c.data.repositories.map((r) => (
          <p key={r.id}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.url}
            </a>
          </p>
        ))}
        {!c.data.repositories.length && <p>No repositories registered.</p>}
      </section>
      <ul className="research-list">
        {c.data.links
          .filter(
            (l) =>
              taskIds.includes(l.task_id) &&
              (!filters.member || l.member_id === filters.member) &&
              (!filters.from || localDay(l.created_at) >= filters.from) &&
              (!filters.to || localDay(l.created_at) <= filters.to),
          )
          .map((l) => (
            <li key={l.id}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.kind}: {l.url}
              </a>
              <p>{l.description}</p>
              <small>
                {c.workspace.tasks.find((t) => t.id === l.task_id)?.title} ·{" "}
                {
                  c.workspace.members.find((m) => m.user_id === l.member_id)
                    ?.rf_profiles.full_name
                }
              </small>
            </li>
          ))}
      </ul>
      {repo && (
        <Editor
          title="Register GitHub repository"
          busy={c.busy}
          fields={[
            { key: "url", label: "Repository HTTPS URL", required: true },
          ]}
          onClose={() => setRepo(false)}
          onSave={async (v) => {
            const url = githubUrl(String(v.url));
            if (!url) throw Error("Use https://github.com/owner/repository");
            await c.act("repository_save", { url });
            setRepo(false);
          }}
        />
      )}
      {link && (
        <Editor
          title="Link development work"
          busy={c.busy}
          initial={{ member_id: c.userId, kind: "Issue" }}
          fields={[
            {
              key: "repository_id",
              label: "Repository",
              type: "select",
              required: true,
              options: c.data.repositories.map((r) => ({
                value: r.id,
                label: r.url,
              })),
            },
            {
              key: "task_id",
              label: "Related task",
              type: "select",
              required: true,
              options: c.workspace.tasks
                .filter((t) => !t.archived)
                .map((t) => ({ value: t.id, label: t.title })),
            },
            {
              key: "member_id",
              label: "Researcher",
              type: "select",
              required: true,
              options: c.workspace.members
                .filter((m) => c.leader || m.user_id === c.userId)
                .map((m) => ({
                  value: m.user_id,
                  label: m.rf_profiles.full_name,
                })),
            },
            {
              key: "kind",
              label: "Link type",
              type: "select",
              required: true,
              options: choices(["Issue", "Pull request", "Commit", "Branch"]),
            },
            { key: "url", label: "GitHub link URL", required: true },
            { key: "description", label: "Description", type: "textarea" },
          ]}
          onClose={() => setLink(false)}
          onSave={async (v) => {
            const url = githubUrl(
              String(v.url),
              String(v.kind),
              c.data.repositories.find((r) => r.id === v.repository_id)?.url,
            );
            if (!url)
              throw Error(
                "URL must match the selected repository and link type",
              );
            await c.act("github_link", { ...v, url });
            setLink(false);
          }}
        />
      )}
    </>
  );
}
