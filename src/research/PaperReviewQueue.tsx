import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { rows, type Section } from "./model";
export default function PaperReviewQueue({
  workspace,
  user,
}: {
  workspace: string;
  user: string;
}) {
  const q = useQuery({
    queryKey: ["paper-review-queue", workspace, user],
    refetchInterval: 30000,
    queryFn: () => rows<Section>("rf_paper_sections", workspace),
  });
  return (
    <section className="research-card">
      <h3>Paper sections awaiting academic review</h3>
      {q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : q.isPending ? (
        <p>Loading…</p>
      ) : (
        <>
          <ul>
            {q.data
              .filter((s) => s.status === "Supervisor Review")
              .map((s) => (
                <li key={s.id}>
                  <Link to="/papers">
                    {s.title} · Due {s.deadline || "not set"}
                  </Link>
                </li>
              ))}
          </ul>
          {!q.data.some((s) => s.status === "Supervisor Review") && (
            <p>No pending paper sections.</p>
          )}
        </>
      )}
    </section>
  );
}
