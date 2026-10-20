import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Empty, Modal } from "../components/ui";
import { check, supabase } from "../lib/supabase";
import { displayTime, type Submission } from "./model";
import { useCollab, Stamp, Files, Status, usePerson } from "./Shared";
import PaperReviewQueue from "../research/PaperReviewQueue";
export default function Reviews() {
  const { workspace, data, userId, leader, supervisor, busy, run, act } =
    useCollab();
  const person = usePerson();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("pending");
  const projects = useQuery({
    queryKey: ["supervisor-projects", userId],
    queryFn: async () =>
      check(
        await supabase
          .from("rf_workspace_members")
          .select("workspace_id,role,rf_workspaces(name,research_title)")
          .eq("user_id", userId)
          .eq("role", "supervisor"),
      ) as unknown as {
        workspace_id: string;
        role: string;
        rf_workspaces: { name: string; research_title: string };
      }[],
  });
  const title = (s: Submission) =>
    s.phase_id
      ? workspace.phases.find((p) => p.id === s.phase_id)?.name ||
        "Research milestone"
      : data.documents.find(
          (d) =>
            d.id ===
            data.versions.find((v) => v.id === s.version_id)?.document_id,
        )?.title || "Document version";
  const s = data.submissions.find((x) => x.id === selected);
  const v = data.versions.find((x) => x.id === s?.version_id);
  const ownsSubmission =
    s?.requested_by === userId ||
    (supervisor &&
      !!v &&
      (v.author_id === userId ||
        data.documents.find((d) => d.id === v.document_id)?.created_by ===
          userId));
  const submissions = data.submissions
    .filter((x) => filter === "all" || x.status === "Submitted for Review")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      {(supervisor || leader) && (
        <PaperReviewQueue workspace={workspace.workspace.id} user={userId} />
      )}
      {supervisor && (
        <section className="panel collab-panel">
          <h2>Academic supervisor portal</h2>
          <p>
            {
              data.submissions.filter(
                (x) => x.status === "Submitted for Review" && x.version_id,
              ).length
            }{" "}
            pending document reviews ·{" "}
            {
              data.submissions.filter(
                (x) => x.status === "Submitted for Review" && x.phase_id,
              ).length
            }{" "}
            pending milestone reviews
          </p>
          <h3>Your assigned research projects</h3>
          {projects.error ? (
            <p role="alert">{projects.error.message}</p>
          ) : projects.isPending ? (
            <p>Loading assigned projects…</p>
          ) : (
            projects.data?.map((p) => (
              <p key={p.workspace_id}>
                {p.rf_workspaces?.name} · {p.rf_workspaces?.research_title}
                <small>Use the workspace selector to switch projects.</small>
              </p>
            ))
          )}
          <h3>Upcoming meetings</h3>
          {data.meetings
            .filter((m) => !m.cancelled && new Date(m.ends_at) > new Date())
            .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
            .slice(0, 3)
            .map((m) => (
              <p key={m.id}>
                <Link to="/meetings">{m.title}</Link> ·{" "}
                {displayTime(m.starts_at, m.timezone)}
              </p>
            ))}
          <Link to="/activity">Recent team activity</Link>
        </section>
      )}
      <div className="collab-toolbar">
        <label>
          Review history
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">Pending academic reviews</option>
            <option value="all">All submissions and decisions</option>
          </select>
        </label>
        <Link to="/documents">Open documents</Link>
        <Link to="/meetings">Upcoming meetings</Link>
      </div>
      {leader && (
        <section className="panel collab-panel">
          <h2>Submit a research milestone</h2>
          <form
            className="collab-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const phase = new FormData(e.currentTarget).get("phase_id");
              void run(
                () => act("review_request", { phase_id: phase }),
                "Milestone submitted for academic review",
              );
            }}
          >
            <label>
              Research phase
              <select name="phase_id" required>
                <option value="">Choose a phase</option>
                {workspace.phases
                  .filter(
                    (p) =>
                      !data.submissions.some(
                        (s) =>
                          s.phase_id === p.id &&
                          s.status === "Submitted for Review",
                      ),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button disabled={busy}>Request milestone review</Button>
          </form>
          <p className="form-hint">
            Academic review is separate from internal task completion and leader
            approval.
          </p>
        </section>
      )}
      <div className="collab-grid">
        {submissions.map((r) => (
          <article className="panel collab-card" key={r.id}>
            <Status>{r.phase_id ? "Milestone" : "Document"}</Status>
            <h2>{title(r)}</h2>
            {r.version_id && (
              <small>
                Version{" "}
                {data.versions.find((v) => v.id === r.version_id)?.version}
              </small>
            )}
            <p>Academic: {r.status}</p>
            <p>Internal: {r.internal_status}</p>
            <Stamp user={r.requested_by} at={r.created_at} />
            <Button variant="outline" onClick={() => setSelected(r.id)}>
              Open submission
            </Button>
          </article>
        ))}
      </div>
      {!submissions.length && (
        <Empty title="No matching review submissions">
          Submit a document version or research milestone when it is ready.
        </Empty>
      )}
      {s && (
        <Modal
          title={title(s)}
          description={`Requested by ${person(s.requested_by)} · ${displayTime(s.created_at)}`}
          onClose={() => setSelected(null)}
        >
          <p>
            Academic: <Status>{s.status}</Status> Internal:{" "}
            <Status>{s.internal_status}</Status>
          </p>
          {v && (
            <>
              <h3>Submitted version {v.version}</h3>
              <Files files={data.files.filter((f) => f.id === v.file_id)} />
              <p className="collab-body">{v.notes}</p>
            </>
          )}
          {s.phase_id && (
            <p className="collab-body">
              {workspace.phases.find((p) => p.id === s.phase_id)?.objectives}
            </p>
          )}
          <h3>Review decisions</h3>
          {data.reviews
            .filter((r) => r.submission_id === s.id)
            .map((r) => (
              <article className="collab-history" key={r.id}>
                <strong>
                  {r.kind} · {r.decision}
                </strong>
                <Stamp user={r.reviewer_id} at={r.created_at} />
                <p className="collab-body">{r.feedback}</p>
              </article>
            ))}
          {(supervisor || leader) &&
            !ownsSubmission &&
            !data.reviews.some(
              (r) =>
                r.submission_id === s.id &&
                r.kind === (supervisor ? "Academic" : "Internal"),
            ) && (
              <form
                className="collab-subform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(
                    () =>
                      act("review_decide", {
                        submission_id: s.id,
                        kind: supervisor ? "Academic" : "Internal",
                        decision: f.get("decision"),
                        feedback: f.get("feedback"),
                      }),
                    "Review recorded",
                  );
                }}
              >
                <h3>
                  {supervisor
                    ? "Academic supervisor decision"
                    : "Internal leader decision"}
                </h3>
                <label>
                  Decision
                  <select name="decision">
                    <option>Approved</option>
                    <option>Revision Requested</option>
                    <option>Rejected</option>
                  </select>
                </label>
                <label>
                  Written feedback
                  <textarea name="feedback" required maxLength={10000} />
                </label>
                <Button disabled={busy}>Record review</Button>
                <p className="form-hint">
                  Decisions are permanent history. Revised submissions receive a
                  new review record.
                </p>
              </form>
            )}
          {ownsSubmission && (
            <p className="form-hint">You cannot review your own submission.</p>
          )}
        </Modal>
      )}
    </>
  );
}
