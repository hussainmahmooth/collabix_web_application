import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { rows, type GithubLink, type Section } from "./model";
export default function TaskResearchLinks({
  workspace,
  task,
}: {
  workspace: string;
  task: string;
}) {
  const q = useQuery({
    queryKey: ["task-research-links", workspace, task],
    queryFn: async () => {
      const [links, sections] = await Promise.all([
        rows<GithubLink>("rf_github_links", workspace),
        rows<Section>("rf_paper_sections", workspace),
      ]);
      return {
        links: links.filter((l) => l.task_id === task),
        sections: sections.filter((s) => s.task_id === task),
      };
    },
  });
  return (
    <section className="research-card">
      <h3>Research & development links</h3>
      {q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : (
        <>
          <ul>
            {q.data?.links.map((l) => (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.kind}: {l.description || l.url}
                </a>
              </li>
            ))}
          </ul>
          {q.data?.sections.map((s) => (
            <p key={s.id}>
              <Link to="/papers">
                {s.title} · {s.status}
              </Link>
            </p>
          ))}
        </>
      )}
      <Link to="/github">Manage GitHub task links</Link>
    </section>
  );
}
