import { useState } from "react";
import { FileText, Plus, Upload, LockKeyhole } from "lucide-react";
import { Button, Empty, Modal } from "../components/ui";
import {
  acceptFiles,
  uploadAttachment,
  type ResearchDocument,
  type Version,
} from "./model";
import { useCollab, usePerson, Files, Stamp, Status } from "./Shared";
export default function Documents() {
  const { workspace, data, userId, leader, supervisor, busy, run, act } =
    useCollab();
  const person = usePerson();
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState("newest");
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [create, setCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [access, setAccess] = useState(false);
  const current = data.documents.find((x) => x.id === selected);
  const versions = (id: string) =>
    data.versions
      .filter((x) => x.document_id === id)
      .sort((a, b) => b.version - a.version);
  function reviewStatus(v: Version | undefined) {
    return v
      ? data.submissions
          .filter((s) => s.version_id === v.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          ?.status || "Draft"
      : "Draft";
  }
  const docs = data.documents
    .filter(
      (x) =>
        x.archived === archived &&
        x.title.toLowerCase().includes(query.toLowerCase()) &&
        (!folder || x.folder_id === folder) &&
        (!status || reviewStatus(versions(x.id)[0]) === status),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.updated_at.localeCompare(b.updated_at)
          : b.updated_at.localeCompare(a.updated_at),
    );
  async function upload(form: HTMLFormElement, doc: string) {
    const f = new FormData(form);
    const file = f.get("file");
    if (!(file instanceof File) || !file.size)
      throw new Error("Choose a file to upload.");
    await uploadAttachment(workspace.workspace.id, userId, file, {
      document_id: doc,
      notes: String(f.get("notes") || ""),
    });
  }
  function accessForm(doc: ResearchDocument) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await act("document_access", {
              id: doc.id,
              restricted: f.get("restricted") === "on",
              readers: f.getAll("readers"),
            });
            setAccess(false);
          }, "Document access saved");
        }}
      >
        <label className="collab-check">
          <input
            type="checkbox"
            name="restricted"
            defaultChecked={doc.restricted}
          />
          Restricted document
        </label>
        <p className="form-hint">
          Restricted materials are visible to the creator, team leaders, the
          assigned supervisor, and selected readers.
        </p>
        <div className="collab-checkboxes">
          {workspace.members
            .filter((x) => x.role === "member" && x.user_id !== doc.created_by)
            .map((m) => (
              <label key={m.user_id}>
                <input
                  type="checkbox"
                  name="readers"
                  value={m.user_id}
                  defaultChecked={data.access.some(
                    (a) => a.document_id === doc.id && a.user_id === m.user_id,
                  )}
                />
                {person(m.user_id)}
              </label>
            ))}
        </div>
        <Button disabled={busy}>Save document access</Button>
      </form>
    );
  }
  return (
    <>
      <div className="collab-toolbar">
        <label>
          Search documents
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by document title"
          />
        </label>
        <label>
          Folder
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {data.folders.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Recently updated</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title</option>
          </select>
        </label>
        <label>
          Review status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {[
              "Draft",
              "Submitted for Review",
              "Revision Requested",
              "Approved",
              "Rejected",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="collab-check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archived
        </label>
        {!supervisor && (
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            Upload document
          </Button>
        )}
      </div>
      <div className="collab-grid">
        {docs.map((d) => {
          const v = versions(d.id)[0];
          const f = data.files.find((x) => x.id === v?.file_id);
          return (
            <article className="panel collab-card" key={d.id}>
              <div className="collab-card-top">
                <FileText size={22} />
                {d.restricted && (
                  <LockKeyhole size={16} aria-label="Restricted document" />
                )}
                <Status>{reviewStatus(v)}</Status>
              </div>
              <h2>
                <button
                  className="collab-title-button"
                  onClick={() => setSelected(d.id)}
                >
                  {d.title}
                </button>
              </h2>
              <p>{data.folders.find((x) => x.id === d.folder_id)?.name}</p>
              <small>
                {v
                  ? `Version ${v.version} · ${f?.name || "File"}`
                  : "No file uploaded yet"}
              </small>
              <Stamp
                user={v?.author_id || d.created_by}
                at={v?.created_at || d.updated_at}
              />
              {d.phase_id && (
                <small>
                  Phase:{" "}
                  {workspace.phases.find((p) => p.id === d.phase_id)?.name}
                </small>
              )}
              {d.task_id && (
                <small>
                  Task: {workspace.tasks.find((t) => t.id === d.task_id)?.title}
                </small>
              )}
              <Button variant="outline" onClick={() => setSelected(d.id)}>
                Open document
              </Button>
            </article>
          );
        })}
      </div>
      {!docs.length && (
        <Empty title="No documents found">
          Upload your first document, or change the folder and search filters.
        </Empty>
      )}
      {create && (
        <Modal
          title="Upload research document"
          description="Private files, up to 20 MB. Previous versions are always preserved."
          onClose={() => setCreate(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              void run(async () => {
                const id = await act("document_create", {
                  title: f.get("title"),
                  folder_id: f.get("folder"),
                  restricted: f.get("restricted") === "on",
                  phase_id: f.get("phase") || null,
                  task_id: f.get("task") || null,
                });
                setSelected(id);
                setCreate(false);
                await upload(form, id);
              }, "Document uploaded");
            }}
          >
            <label>
              Document title
              <input name="title" required maxLength={200} />
            </label>
            <label>
              Folder
              <select name="folder" required>
                <option value="">Choose a folder</option>
                {data.folders.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Research phase
                <select name="phase">
                  <option value="">Not linked</option>
                  {workspace.phases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Related task
                <select name="task">
                  <option value="">Not linked</option>
                  {workspace.tasks
                    .filter((t) => !t.archived)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label className="collab-check">
              <input type="checkbox" name="restricted" />
              Restricted to creator, leaders and supervisor
            </label>
            <label>
              File
              <input name="file" type="file" accept={acceptFiles} required />
            </label>
            <label>
              Version notes
              <textarea name="notes" maxLength={2000} />
            </label>
            <Button disabled={busy}>Upload document</Button>
          </form>
        </Modal>
      )}
      {current && (
        <Modal
          title={current.title}
          description={`${data.folders.find((f) => f.id === current.folder_id)?.name || "Research document"} · ${current.restricted ? "Restricted" : "Workspace access"}`}
          onClose={() => {
            setSelected(null);
            setAccess(false);
          }}
        >
          <div className="collab-toolbar">
            {(leader || current.created_by === userId) && (
              <Button variant="outline" onClick={() => setAccess(!access)}>
                <LockKeyhole size={14} />
                Manage access
              </Button>
            )}
            {leader && !current.archived && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await act("document_archive", { id: current.id });
                    setSelected(null);
                  }, "Document archived; versions preserved")
                }
              >
                Archive document
              </Button>
            )}
          </div>
          {access ? (
            accessForm(current)
          ) : (
            <>
              {!supervisor && !current.archived && (
                <form
                  className="collab-subform"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    void run(async () => {
                      await upload(form, current.id);
                      form.reset();
                    }, "New version uploaded");
                  }}
                >
                  <h3>
                    <Upload size={16} /> Add a new version
                  </h3>
                  <label>
                    New version file
                    <input
                      type="file"
                      name="file"
                      accept={acceptFiles}
                      required
                    />
                  </label>
                  <label>
                    Version notes
                    <textarea name="notes" maxLength={2000} />
                  </label>
                  <Button disabled={busy}>Upload new version</Button>
                </form>
              )}
              <h3>Version history</h3>
              {versions(current.id).map((v) => (
                <section className="collab-history" key={v.id}>
                  <strong>Version {v.version}</strong>{" "}
                  <Status>{reviewStatus(v)}</Status>
                  <Stamp user={v.author_id} at={v.created_at} />
                  {v.notes && <p className="collab-body">{v.notes}</p>}
                  <Files files={data.files.filter((f) => f.id === v.file_id)} />
                  {!supervisor &&
                    !current.archived &&
                    (leader || v.author_id === userId) &&
                    reviewStatus(v) !== "Submitted for Review" && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => act("review_request", { version_id: v.id }),
                            "Academic review requested",
                          )
                        }
                      >
                        Submit version {v.version} for review
                      </Button>
                    )}
                  {data.submissions
                    .filter((s) => s.version_id === v.id)
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((s) => (
                      <div className="collab-review" key={s.id}>
                        <strong>
                          Academic: {s.status} · Internal: {s.internal_status}
                        </strong>
                        {data.reviews
                          .filter((r) => r.submission_id === s.id)
                          .map((r) => (
                            <div key={r.id}>
                              <p>
                                {r.kind} · {r.decision}
                              </p>
                              <p className="collab-body">{r.feedback}</p>
                              <Stamp user={r.reviewer_id} at={r.created_at} />
                            </div>
                          ))}
                      </div>
                    ))}
                </section>
              ))}
              <h3>Comments & feedback</h3>
              {data.comments
                .filter((c) => c.document_id === current.id)
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((c) => (
                  <article className="collab-history" key={c.id}>
                    <Stamp user={c.author_id} at={c.created_at} />
                    <p className="collab-body">{c.body}</p>
                  </article>
                ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const body = new FormData(form).get("body");
                  void run(async () => {
                    await act("document_comment", {
                      document_id: current.id,
                      body,
                    });
                    form.reset();
                  }, "Comment added");
                }}
              >
                <label>
                  Document comment
                  <textarea name="body" required maxLength={5000} />
                </label>
                <Button disabled={busy}>Post comment</Button>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
