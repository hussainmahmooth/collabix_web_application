import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { WorkspaceData } from "../App";
import type { Audit, Member } from "../lib/types";
import { Button, Empty, OperationFeedbackContext } from "../components/ui";
import { supabase } from "../lib/supabase";
import { loadCollaboration, collaborate, displayTime } from "./model";
import { CollaborationContext, useCollab, usePerson } from "./Shared";
import Documents from "./Documents";
import Discussions from "./Discussions";
import Meetings from "./Meetings";
import Reviews from "./Reviews";
import Announcements from "./Announcements";
import "./collaboration.css";
interface Props {
  workspace: WorkspaceData;
  userId: string;
  page: string;
  busy: boolean;
  mutate: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
}
export default function CollaborationView({
  workspace,
  userId,
  page,
  busy,
  mutate,
}: Props) {
  const client = useQueryClient();
  const w = workspace.workspace.id;
  const query = useQuery({
    queryKey: ["collaboration", w, userId],
    queryFn: () => loadCollaboration(w),
    refetchInterval: 30000,
  });
  const [realtime, setRealtime] = useState("Connecting");
  const [operationError, setOperationError] = useState("");
  const role = workspace.members.find((x) => x.user_id === userId)?.role;
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["collaboration", w] });
    await client.invalidateQueries({ queryKey: ["messages", w] });
  }
  useEffect(() => {
    if (!role) return;
    let active = true;
    const channel = supabase
      .channel(`rf-collab-${w}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rf_messages",
          filter: `workspace_id=eq.${w}`,
        },
        () => {
          void client.invalidateQueries({ queryKey: ["messages", w] });
          void client.invalidateQueries({ queryKey: ["collaboration", w] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rf_channels",
          filter: `workspace_id=eq.${w}`,
        },
        () => void client.invalidateQueries({ queryKey: ["collaboration", w] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rf_files",
          filter: `workspace_id=eq.${w}`,
        },
        () => void client.invalidateQueries({ queryKey: ["collaboration", w] }),
      )
      .on("system", "*", (payload) => {
        if (!active) return;
        if (
          payload.extension === "postgres_changes" &&
          payload.status === "ok"
        ) {
          setRealtime("Live");
          void client.invalidateQueries({ queryKey: ["messages", w] });
          void client.invalidateQueries({ queryKey: ["collaboration", w] });
        } else if (payload.status === "error")
          setRealtime("Reconnecting — refreshing every 30 seconds");
      })
      .subscribe((status) => {
        if (active && status !== "SUBSCRIBED")
          setRealtime(
            status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
              ? "Reconnecting — refreshing every 30 seconds"
              : "Connecting",
          );
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [w, userId, role, client]);
  const titles: Record<string, string> = {
    discussions: "Team discussions",
    documents: "Research documents",
    meetings: "Meetings & decisions",
    reviews: "Supervisor reviews",
    announcements: "Team announcements",
    activity: "Activity history",
  };
  if (query.isPending)
    return (
      <div className="loading-screen">Loading collaboration workspace…</div>
    );
  if (query.error)
    return (
      <div className="error-box" role="alert">
        {query.error.message}
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </div>
    );
  if (!query.data || !role)
    return (
      <Empty title="Workspace access required">
        Choose an assigned workspace.
      </Empty>
    );
  const run = (fn: () => Promise<unknown>, message = "Changes saved") =>
    mutate(async () => {
      setOperationError("");
      try {
        await fn();
      } catch (error) {
        setOperationError(
          error instanceof Error
            ? error.message
            : "The operation failed. Try again.",
        );
        throw error;
      } finally {
        await refresh();
      }
    }, message);
  return (
    <OperationFeedbackContext.Provider value={operationError}>
      <CollaborationContext.Provider
        value={{
          workspace,
          data: query.data,
          userId,
          leader: role === "leader",
          supervisor: role === "supervisor",
          busy,
          run,
          refresh,
          act: (action, fields = {}) => collaborate(w, action, fields),
        }}
      >
        <div className="page-heading">
          <span className="eyebrow">{workspace.workspace.name}</span>
          <h1>{titles[page]}</h1>
          <p>
            {workspace.workspace.research_title ||
              "A shared space for your next discovery."}
          </p>
        </div>
        {operationError && (
          <p role="alert" className="error-box">
            {operationError}
          </p>
        )}
        <div className="collaboration">
          {page === "documents" ? (
            <Documents />
          ) : page === "discussions" ? (
            <Discussions connection={realtime} />
          ) : page === "meetings" ? (
            <Meetings />
          ) : page === "reviews" ? (
            <Reviews />
          ) : page === "announcements" ? (
            <Announcements />
          ) : (
            <Activity />
          )}
        </div>
      </CollaborationContext.Provider>
    </OperationFeedbackContext.Provider>
  );
}
function Activity() {
  const { workspace } = useCollab();
  const person = usePerson();
  const [who, setWho] = useState("");
  const [type, setType] = useState("");
  const [after, setAfter] = useState("");
  const query = useQuery({
    queryKey: ["activity", workspace.workspace.id, who, type, after],
    queryFn: async () => {
      let q = supabase
        .from("rf_audit_events")
        .select("*")
        .eq("workspace_id", workspace.workspace.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (who) q = q.eq("actor_id", who);
      if (type) q = q.like("action", `${type}.%`);
      if (after)
        q = q.gte("created_at", new Date(after + "T00:00:00").toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data as {
        id: string;
        actor_id: string;
        action: string;
        created_at: string;
        entity_id: string;
      }[];
    },
    refetchInterval: 30000,
  });
  return (
    <>
      <div className="collab-toolbar">
        <label>
          Member
          <select value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">All members</option>
            {workspace.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {person(m.user_id)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All activity</option>
            {[
              "rf_documents",
              "rf_document_versions",
              "rf_submissions",
              "rf_reviews",
              "rf_meetings",
              "rf_meeting_actions",
              "rf_announcements",
              "rf_channels",
              "rf_tasks",
            ].map((t) => (
              <option key={t} value={t}>
                {t.replace("rf_", "").replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          From date
          <input
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
          />
        </label>
      </div>
      {query.isPending ? (
        <p>Loading activity…</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : (
        <section className="panel collab-panel">
          {query.data?.length ? (
            query.data.map((e) => (
              <article className="collab-history" key={e.id}>
                <strong>{person(e.actor_id)}</strong> ·{" "}
                {e.action
                  .replace("rf_", "")
                  .replaceAll("_", " ")
                  .replace(".", " · ")}
                <small>
                  {displayTime(e.created_at)} · Resource {e.entity_id}
                </small>
              </article>
            ))
          ) : (
            <Empty title="No matching activity">
              Try another date or member.
            </Empty>
          )}
          <p className="form-hint">
            Most recent 200 matching events. Activity contains resource
            identifiers, never document contents or message bodies.
          </p>
        </section>
      )}
    </>
  );
}
export function CollaborationSummary({
  workspaceId,
  userId,
  activity,
  members,
}: {
  workspaceId: string;
  userId: string;
  activity: Audit[];
  members: Member[];
}) {
  const q = useQuery({
    queryKey: ["collaboration", workspaceId, userId],
    queryFn: () => loadCollaboration(workspaceId),
    refetchInterval: 30000,
  });
  if (q.isPending)
    return <p className="form-hint">Loading collaboration updates…</p>;
  if (q.error)
    return (
      <p className="form-hint">
        Collaboration updates unavailable.{" "}
        <Link to="/documents">Open collaboration</Link>
      </p>
    );
  const d = q.data;
  if (!d) return null;
  const upcoming = d.meetings
    .filter((m) => !m.cancelled && new Date(m.ends_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <section className="panel collab-dashboard">
      <div className="panel-heading">
        <div>
          <h2>Research, together</h2>
          <p>Reviews, meetings and team updates</p>
        </div>
        <Link className="text-link" to="/activity">
          Activity history
        </Link>
      </div>
      <div className="collab-summary-links">
        <Link to="/reviews">
          <strong>
            {
              d.submissions.filter((s) => s.status === "Submitted for Review")
                .length
            }
          </strong>{" "}
          pending academic reviews
        </Link>
        <Link to="/documents">
          <strong>{d.documents.filter((x) => !x.archived).length}</strong>{" "}
          research documents
        </Link>
        <Link to="/discussions">
          <strong>
            {d.unread.reduce((n, x) => n + Number(x.unread_count), 0)}
          </strong>{" "}
          unread messages
        </Link>
      </div>
      {upcoming.slice(0, 2).map((m) => (
        <p key={m.id}>
          <Link to="/meetings">{m.title}</Link> ·{" "}
          {displayTime(m.starts_at, m.timezone)} ({m.timezone})
        </p>
      ))}
      {d.announcements
        .filter((a) => !a.archived)
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.created_at.localeCompare(a.created_at),
        )
        .slice(0, 2)
        .map((a) => (
          <p key={a.id}>
            <Link to="/announcements">
              {a.pinned ? "Pinned · " : ""}
              {a.title}
            </Link>{" "}
            · {a.priority}
          </p>
        ))}
      {activity.length > 0 && (
        <>
          <h3>Recent team activity</h3>
          {activity.slice(0, 5).map((e) => (
            <p key={e.id}>
              {members.find((m) => m.user_id === e.actor_id)?.rf_profiles
                .full_name || "Former member"}{" "}
              ·{" "}
              {e.action
                .replace("rf_", "")
                .replaceAll("_", " ")
                .replace(".", " · ")}{" "}
              · {displayTime(e.created_at)}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
