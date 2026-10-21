import { createContext, lazy, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { WorkspaceData } from "../App";
import type { Audit } from "../lib/types";
import { Button, OperationFeedbackContext } from "../components/ui";
import {
  loadCollaboration,
  type CollaborationData,
} from "../collaboration/model";
import {
  completion,
  loadResearch,
  operate,
  rows,
  type Paper,
  type Dataset,
  type ResearchData,
} from "./model";
import Papers from "./Papers";
import Datasets from "./Datasets";
import Notifications from "./Notifications";
const Analytics = lazy(() => import("./Analytics"));
import Github from "./Github";
import Timeline from "./Timeline";
const Reports = lazy(() => import("./Reports"));
import "./research.css";
interface Props {
  workspace: WorkspaceData;
  userId: string;
  page: string;
  busy: boolean;
  mutate: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
}
interface Context extends Omit<Props, "page" | "mutate"> {
  data: ResearchData;
  collaboration: CollaborationData;
  audit: Audit[];
  leader: boolean;
  supervisor: boolean;
  act: (action: string, p?: Record<string, unknown>) => Promise<void>;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
}
const ResearchContext = createContext<Context | null>(null);
export function useResearch() {
  const c = useContext(ResearchContext);
  if (!c) throw Error("Research workspace not available");
  return c;
}
export default function ResearchView(props: Props) {
  const { workspace, userId, page, mutate, busy } = props;
  const w = workspace.workspace.id;
  const client = useQueryClient();
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["research", w, userId],
    refetchInterval: 30000,
    queryFn: async () => {
      const [data, collaboration, audit] = await Promise.all([
        loadResearch(w),
        loadCollaboration(w),
        rows<Audit>("rf_audit_events", w),
      ]);
      return { data, collaboration, audit };
    },
  });
  async function act(action: string, p: Record<string, unknown> = {}) {
    await operate(w, action, p);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["research", w] }),
      client.invalidateQueries({ queryKey: ["research-summary", w] }),
      client.invalidateQueries({ queryKey: ["notifications", w] }),
      client.invalidateQueries({ queryKey: ["workspace", w] }),
    ]);
  }
  async function run(fn: () => Promise<unknown>, message = "Changes saved") {
    setError("");
    return mutate(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operation failed");
        throw e;
      }
    }, message);
  }
  if (query.isPending) return <p role="status">Loading research operations…</p>;
  if (query.error)
    return (
      <div role="alert" className="error-box">
        {query.error.message}
        <Button onClick={() => void query.refetch()}>
          Retry research data
        </Button>
      </div>
    );
  const role = workspace.members.find((m) => m.user_id === userId)?.role;
  const c: Context = {
    workspace,
    userId,
    busy,
    data: query.data.data,
    collaboration: query.data.collaboration,
    audit: query.data.audit,
    leader: role === "leader",
    supervisor: role === "supervisor",
    act: async (a, p) => {
      try {
        setError("");
        await act(a, p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to save");
        throw e;
      }
    },
    run,
  };
  return (
    <ResearchContext.Provider value={c}>
      <OperationFeedbackContext.Provider value={error}>
        <div className="research-page">
          <div className="page-heading">
            <span className="eyebrow">RESEARCH OPERATIONS</span>
            <h1>
              {
                {
                  papers: "Research papers",
                  datasets: "Datasets",
                  notifications: "Notifications",
                  analytics: "Analytics",
                  reports: "Research reports",
                  github: "GitHub tracking",
                  timeline: "Research timeline",
                }[page]
              }
            </h1>
            <p>
              {workspace.workspace.name} ·{" "}
              {workspace.workspace.research_title || "Research project"}
            </p>
          </div>
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          {page === "papers" ? (
            <Papers />
          ) : page === "datasets" ? (
            <Datasets />
          ) : page === "notifications" ? (
            <Notifications workspace={w} user={userId} />
          ) : page === "analytics" ? (
            <Analytics />
          ) : page === "github" ? (
            <Github />
          ) : page === "timeline" ? (
            <Timeline />
          ) : (
            <Reports />
          )}
        </div>
      </OperationFeedbackContext.Provider>
    </ResearchContext.Provider>
  );
}
export function ResearchSummary({
  workspace,
  userId,
}: {
  workspace: string;
  userId: string;
}) {
  const q = useQuery({
    queryKey: ["research-summary", workspace, userId],
    refetchInterval: 30000,
    queryFn: async () => {
      const [papers, sections, datasets] = await Promise.all([
        rows<Paper>("rf_papers", workspace),
        rows<ResearchData["sections"][number]>("rf_paper_sections", workspace),
        rows<Dataset>("rf_datasets", workspace),
      ]);
      return { papers, sections, datasets };
    },
  });
  return (
    <section className="research-card">
      <div className="research-toolbar">
        <h3>Research operations</h3>
        <Link to="/analytics">Explore analytics</Link>
      </div>
      {q.error ? (
        <p role="alert">{q.error.message}</p>
      ) : q.isPending ? (
        <p>Loading paper and dataset progress…</p>
      ) : (
        <div className="research-grid">
          <div>
            <Link to="/papers">Research papers · {q.data.papers.length}</Link>
            {q.data.papers.map((p) => (
              <p key={p.id}>
                {p.title}:{" "}
                {completion(
                  q.data.sections.filter((s) => s.paper_id === p.id),
                ) ?? "—"}
                % sections approved
              </p>
            ))}
          </div>
          <div>
            <Link to="/datasets">
              Datasets · {q.data.datasets.length} accessible
            </Link>
            <p>
              {
                q.data.datasets.filter(
                  (d) =>
                    d.status === "Ready for Analysis" &&
                    d.permission_status === "Granted",
                ).length
              }{" "}
              marked ready with granted permission
            </p>
            <small>
              Readiness is researcher-entered, not automated quality
              certification.
            </small>
          </div>
        </div>
      )}
    </section>
  );
}
