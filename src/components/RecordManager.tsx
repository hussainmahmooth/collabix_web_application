import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "./ui";
import { Editor, formValues, type Field } from "../research/Forms";
import { recordTables } from "../lib/recordLifecycle";
import { check, supabase } from "../lib/supabase";

const groups: Record<string, string[]> = {
  phases: ["phases"],
  discussions: ["channels"],
  documents: ["documents", "document_comments"],
  meetings: ["meetings", "meeting_notes", "meeting_actions"],
  announcements: ["announcements"],
  papers: ["papers", "sections", "references"],
  datasets: ["datasets"],
  github: ["repositories", "links"],
};
const labels: Record<string, string> = {
  phases: "Research phases",
  channels: "Discussion channels",
  documents: "Documents",
  document_comments: "Document comments",
  meetings: "Meetings",
  meeting_notes: "Meeting notes",
  meeting_actions: "Meeting actions",
  announcements: "Announcements",
  papers: "Papers",
  sections: "Paper sections",
  references: "References",
  datasets: "Datasets",
  repositories: "GitHub repositories",
  links: "GitHub links",
};
const text = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
});
const area = (key: string, label: string, required = false): Field => ({
  key,
  label,
  required,
  type: "textarea",
});
const fields: Record<string, Field[]> = {
  phases: [
    text("name", "Name", true),
    area("description", "Description"),
    area("objectives", "Objectives"),
  ],
  channels: [text("name", "Channel name", true)],
  documents: [text("title", "Document title", true)],
  meetings: [
    text("title", "Meeting title", true),
    area("description", "Description"),
    text("location", "Location"),
    area("agenda", "Agenda"),
  ],
  announcements: [
    text("title", "Title", true),
    area("body", "Announcement", true),
  ],
  papers: [
    text("title", "Paper title", true),
    area("abstract", "Abstract"),
    text("keywords", "Keywords"),
    text("venue", "Venue"),
  ],
  sections: [text("title", "Section title", true), area("notes", "Notes")],
  references: [
    text("title", "Reference title", true),
    text("authors", "Authors"),
    { key: "year", label: "Year", type: "number" },
    text("venue", "Venue"),
    text("url", "URL"),
    area("notes", "Notes"),
  ],
  datasets: [
    text("name", "Dataset name", true),
    area("description", "Description"),
  ],
  repositories: [text("url", "Repository HTTPS URL", true)],
  links: [text("url", "GitHub URL", true), area("description", "Description")],
  document_comments: [area("body", "Comment", true)],
  meeting_notes: [area("body", "Note", true)],
  meeting_actions: [
    text("title", "Action title", true),
    { key: "due_date", label: "Due date", type: "date", required: true },
  ],
};
type Row = Record<string, unknown> & {
  id: string;
  deleted_at?: string | null;
  trashed_at?: string | null;
};
export default function RecordManager({
  page,
  workspace,
  leader,
}: {
  page: string;
  workspace: string;
  leader: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [entity, setEntity] = useState(groups[page]?.[0] || "");
  const [trash, setTrash] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["managed-records", workspace, entity],
    enabled: open && leader && !!entity,
    refetchInterval: 30000,
    queryFn: async () => {
      const result: Row[] = [];
      for (let from = 0; ; from += 500) {
        const rows = check(
          await supabase
            .from(recordTables[entity])
            .select("*")
            .eq("workspace_id", workspace)
            .order("id")
            .range(from, from + 499),
        ) as Row[];
        result.push(...rows);
        if (rows.length < 500) return result;
      }
    },
  });
  const changes = useQuery({
    queryKey: ["record-history", workspace, entity, history?.id],
    enabled: !!history && leader,
    queryFn: async () =>
      check(
        await supabase
          .from("rf_record_changes")
          .select("*")
          .eq("workspace_id", workspace)
          .eq("entity", entity)
          .eq("entity_id", history!.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ) as {
        id: string;
        action: string;
        created_at: string;
        before_value: Record<string, unknown>;
        after_value: Record<string, unknown>;
      }[],
  });
  if (!leader || !groups[page]) return null;
  const title = (r: Row) =>
    String(r.title || r.name || r.body || r.url || "Untitled record");
  const protectedRow = (r: Row) =>
    (entity === "sections" && r.status === "Approved") ||
    (entity === "meeting_actions" && !!r.task_id);
  async function save(
    operation: string,
    row: Row,
    changes?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError("");
    try {
      check(
        await supabase.rpc("rf_manage_record", {
          entity,
          operation,
          p: { workspace_id: workspace, id: row.id, changes },
        }),
      );
      await Promise.all(
        [
          "managed-records",
          "record-history",
          "workspace",
          "collaboration",
          "research",
          "research-summary",
          "notifications",
          "activity",
          "paper-review-queue",
          "task-research-links",
          "messages",
        ].map((key) =>
          client.invalidateQueries({ queryKey: [key, workspace] }),
        ),
      );
      setEditing(null);
      setRemoving(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to save";
      setError(message);
      throw Error(message);
    } finally {
      setBusy(false);
    }
  }
  const visible = (query.data || []).filter(
    (r) =>
      !!(r.deleted_at || r.trashed_at) === trash &&
      title(r).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="record-manager">
      <Button
        variant="outline"
        onClick={() => {
          setOpen(!open);
          setError("");
        }}
      >
        Manage records
      </Button>
      {open && (
        <div className="panel" style={{ padding: "1rem", marginTop: "1rem" }}>
          <h2>Manage records</h2>
          <p>
            Create records using this page’s Add controls. Edit details below,
            or use the full editor on the record for assignments, permissions
            and scheduling. Deleted records remain recoverable with their linked
            history.
          </p>
          <div className="record-controls">
            <label>
              Record type
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setSearch("");
                  setError("");
                }}
              >
                {groups[page].map((k) => (
                  <option key={k} value={k}>
                    {labels[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search records
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={trash}
                onChange={(e) => setTrash(e.target.checked)}
              />{" "}
              Show Trash
            </label>
          </div>
          {(error || query.error) && (
            <p role="alert" className="error-box">
              {error || query.error?.message}
            </p>
          )}
          {query.isPending ? (
            <p role="status">Loading records…</p>
          ) : (
            <ul className="managed-record-list">
              {visible.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{title(row)}</strong>
                    {row.kind ? <small> · {String(row.kind)}</small> : null}
                    {protectedRow(row) && (
                      <p>
                        Protected academic decision or converted action. Use its
                        linked workflow for further work.
                      </p>
                    )}
                  </div>
                  <div className="record-controls">
                    <Button variant="outline" onClick={() => setHistory(row)}>
                      History
                    </Button>
                    {!protectedRow(row) &&
                      (trash ? (
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void save("restore", row).catch(() => {})
                          }
                        >
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setEditing(row)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setRemoving(row)}
                          >
                            Delete
                          </Button>
                        </>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!query.isPending && !visible.length && (
            <p>
              {trash
                ? "Trash is empty for this record type."
                : "No matching records."}
            </p>
          )}
          <p>
            <small>
              Restore a parent before restoring its comments, sections or links.
              Versions, approved reviews and audit history are preserved. Task
              deletion uses Tasks → Archived / Trash.
            </small>
          </p>
        </div>
      )}
      {editing && (
        <Editor
          title={`Edit ${labels[entity].toLowerCase()}`}
          fields={fields[entity]}
          initial={formValues(editing)}
          busy={busy}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const changes = Object.fromEntries(
              fields[entity].map((f) => [
                f.key,
                f.key === "year"
                  ? values[f.key]
                    ? Number(values[f.key])
                    : null
                  : values[f.key],
              ]),
            );
            await save("edit", editing, changes);
          }}
        />
      )}
      {removing && (
        <Modal title="Move record to Trash?" onClose={() => setRemoving(null)}>
          <p>{title(removing)}</p>
          <p>
            This removes the record from active views. Linked files, versions
            and decisions stay preserved. You can restore it from Manage records
            → Show Trash.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="record-controls">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Cancel deletion
            </Button>
            <Button
              disabled={busy}
              onClick={() => void save("trash", removing).catch(() => {})}
            >
              Move to Trash
            </Button>
          </div>
        </Modal>
      )}
      {history && (
        <Modal title="Record change history" onClose={() => setHistory(null)}>
          <p>{title(history)}</p>
          <p>
            Changes made through Manage records, newest first (up to 100).
            Existing module history and academic decisions remain in their
            original workflows.
          </p>
          {changes.isPending ? (
            <p>Loading history…</p>
          ) : changes.error ? (
            <p role="alert">{changes.error.message}</p>
          ) : !changes.data?.length ? (
            <p>No changes recorded through this panel yet.</p>
          ) : (
            changes.data.map((change) => (
              <article key={change.id}>
                <h3>
                  {change.action} ·{" "}
                  {new Date(change.created_at).toLocaleString()}
                </h3>
                {fields[entity]
                  .filter(
                    (f) =>
                      change.before_value[f.key] !== change.after_value[f.key],
                  )
                  .map((f) => (
                    <p key={f.key}>
                      <strong>{f.label}</strong>
                      <br />
                      Before:{" "}
                      {String(change.before_value[f.key] ?? "Not specified")}
                      <br />
                      After:{" "}
                      {String(change.after_value[f.key] ?? "Not specified")}
                    </p>
                  ))}
              </article>
            ))
          )}
        </Modal>
      )}
    </section>
  );
}
