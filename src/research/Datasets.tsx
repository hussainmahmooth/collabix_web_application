import { useState } from "react";
import { Button, Empty, Modal } from "../components/ui";
import { check, supabase } from "../lib/supabase";
import { validateFile } from "../collaboration/model";
import { Editor, choices, formValues, type Field } from "./Forms";
import { datasetStatuses, type Dataset } from "./model";
import { useResearch } from "./ResearchView";
const metadataFields = [
  "source_organization",
  "custodian",
  "collection_method",
  "date_from",
  "date_to",
  "record_count",
  "file_format",
  "dictionary",
  "version_label",
  "permission_evidence",
  "usage_scope",
  "missing_values",
  "duplicates",
  "date_coverage",
  "quality_assessment",
  "notes",
  "related_document_id",
];
export default function Datasets() {
  const {
    data,
    workspace,
    leader,
    supervisor,
    userId,
    act,
    run,
    busy,
    collaboration,
  } = useResearch();
  const [edit, setEdit] = useState<Dataset | "new" | null>(null);
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [upload, setUpload] = useState<Dataset | null>(null);
  const person = (id: string) =>
    workspace.members.find((m) => m.user_id === id)?.rf_profiles.full_name ||
    "Former member";
  const fields: Field[] = [
    { key: "name", label: "Dataset name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    {
      key: "classification",
      label: "Confidentiality classification",
      type: "select",
      required: true,
      options: choices([
        "Public",
        "Internal",
        "Confidential",
        "Highly Confidential",
      ]),
      disabled: !leader,
    },
    {
      key: "restricted",
      label: "Restrict to selected readers and managers",
      type: "checkbox",
      disabled: !leader,
    },
    {
      key: "readers",
      label: "Permitted readers",
      type: "multi",
      options: workspace.members.map((m) => ({
        value: m.user_id,
        label: m.rf_profiles.full_name,
      })),
      disabled: !leader,
    },
    {
      key: "permission_status",
      label: "Permission status",
      type: "select",
      required: true,
      options: choices([
        "Not requested",
        "Pending",
        "Granted",
        "Denied",
        "Expired",
      ]),
      disabled: !leader,
    },
    {
      key: "status",
      label: "Dataset status",
      type: "select",
      options: choices(datasetStatuses),
      required: true,
    },
    {
      key: "assignee_id",
      label: "Assigned researcher",
      type: "select",
      options: workspace.members
        .filter((m) => m.role !== "supervisor")
        .map((m) => ({ value: m.user_id, label: m.rf_profiles.full_name })),
      disabled: !leader,
    },
    {
      key: "phase_id",
      label: "Research phase",
      type: "select",
      options: workspace.phases.map((p) => ({ value: p.id, label: p.name })),
    },
    { key: "checkpoint_date", label: "Readiness checkpoint", type: "date" },
    {
      key: "retention_date",
      label: "Retention / deletion due date",
      type: "date",
    },
    ...metadataFields.map(
      (key) =>
        ({
          key,
          label: key.replaceAll("_", " ").replace(/^./, (s) => s.toUpperCase()),
          type:
            key === "date_from" || key === "date_to"
              ? "date"
              : key === "record_count"
                ? "number"
                : key === "related_document_id"
                  ? "select"
                  : "textarea",
          options:
            key === "related_document_id"
              ? collaboration.documents.map((d) => ({
                  value: d.id,
                  label: d.title,
                }))
              : undefined,
        }) as Field,
    ),
  ];
  const target = selected
    ? data.datasets.find((d) => d.id === selected.id)
    : null;
  return (
    <>
      <div className="research-toolbar">
        <h2>Dataset registry</h2>
        {leader && (
          <Button onClick={() => setEdit("new")}>Register dataset</Button>
        )}
      </div>
      <p className="research-notice">
        Registry entries do not grant legal permission. Record actual evidence
        and usage restrictions. Raw files require granted permission, an active
        status and an unexpired retention date. Quality findings are
        researcher-entered, never automatically certified.
      </p>
      {!data.datasets.length && (
        <Empty title="No accessible datasets">
          A leader can register a dataset. Restricted entries are hidden from
          unauthorized members.
        </Empty>
      )}
      <div className="research-grid">
        {data.datasets.map((d) => (
          <article className="research-card" key={d.id}>
            <h3>{d.name}</h3>
            <span className="research-status">{d.status}</span>
            <p>
              {d.classification} · Permission: {d.permission_status}
            </p>
            <small>Dataset ID: {d.id}</small>
            <p>{d.description}</p>
            <p>
              Custodian: {d.metadata.custodian || "Not recorded"} · Assigned:{" "}
              {d.assignee_id ? person(d.assignee_id) : "Not assigned"}
            </p>
            <div className="research-toolbar">
              <Button variant="outline" onClick={() => setSelected(d)}>
                Versions & governance
              </Button>
              {!supervisor &&
                (leader ||
                  d.created_by === userId ||
                  d.assignee_id === userId) && (
                  <Button variant="ghost" onClick={() => setEdit(d)}>
                    Edit dataset
                  </Button>
                )}
            </div>
          </article>
        ))}
      </div>
      {edit && (
        <Editor
          title={
            edit === "new" ? "Register dataset" : "Edit dataset governance"
          }
          fields={fields}
          busy={busy}
          initial={
            edit === "new"
              ? {
                  classification: "Confidential",
                  permission_status: "Not requested",
                  status: "Proposed",
                  restricted: true,
                  readers: [],
                }
              : formValues({ ...edit, ...edit.metadata })
          }
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            const metadata = Object.fromEntries(
              metadataFields.map((k) => [k, v[k] || ""]),
            );
            await act("dataset_save", {
              ...(edit === "new" ? {} : edit),
              ...v,
              metadata,
            });
            setEdit(null);
          }}
        />
      )}
      {target && (
        <Modal
          title={target.name}
          description="Private registry metadata and immutable version history"
          onClose={() => setSelected(null)}
        >
          <dl>
            {metadataFields.map((k) => (
              <div key={k}>
                <dt>{k.replaceAll("_", " ")}</dt>
                <dd className="research-detail">
                  {target.metadata[k] || "Not recorded"}
                </dd>
              </div>
            ))}
          </dl>
          <p>
            Retention due: {target.retention_date || "Not recorded"} · Readiness
            checkpoint: {target.checkpoint_date || "Not recorded"}
          </p>
          {!supervisor && (
            <Button
              onClick={() => {
                setSelected(null);
                setUpload(target);
              }}
            >
              Add version or evidence
            </Button>
          )}
          <ul className="research-list">
            {data.datasetVersions
              .filter((v) => v.dataset_id === target.id)
              .sort((a, b) => b.version - a.version)
              .map((v) => (
                <li key={v.id}>
                  <strong>
                    v{v.version} · {v.kind} · {v.name}
                  </strong>
                  <p>{v.notes}</p>
                  <small>
                    {new Date(v.created_at).toLocaleString()} ·{" "}
                    {person(v.author_id)}
                  </small>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        const response = check(
                          await supabase.functions.invoke(
                            "rf-dataset-download",
                            {
                              body: {
                                workspace_id: workspace.workspace.id,
                                id: v.id,
                              },
                            },
                          ),
                        );
                        const url = response?.url as string | undefined;
                        if (!url || !url.startsWith("https://"))
                          throw Error("Secure download unavailable");
                        const a = document.createElement("a");
                        a.href = url;
                        a.target = "_blank";
                        a.rel = "noopener noreferrer";
                        a.click();
                      }, "Download link issued; access logged")
                    }
                  >
                    Secure download
                  </Button>
                </li>
              ))}
          </ul>
          <h3>Download link issuance history</h3>
          <small>
            Records authorization/link issuance, not proof that bytes were
            downloaded. External providers enforce their own access.
          </small>
          <ul>
            {data.accessEvents
              .filter((e) =>
                data.datasetVersions.some(
                  (v) => v.id === e.version_id && v.dataset_id === target.id,
                ),
              )
              .map((e) => (
                <li key={e.id}>
                  {person(e.user_id)} ·{" "}
                  {new Date(e.created_at).toLocaleString()}
                </li>
              ))}
          </ul>
          <h3>Dataset metadata & permission change history</h3>
          <ul className="research-list">
            {data.datasetChanges
              .filter((change) => change.dataset_id === target.id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((change) => (
                <li key={change.id}>
                  <strong>
                    {change.after_value.status} ·{" "}
                    {change.after_value.permission_status}
                  </strong>
                  <small>
                    {person(change.actor_id)} ·{" "}
                    {new Date(change.created_at).toLocaleString()}
                  </small>
                  <details>
                    <summary>Recorded metadata snapshot</summary>
                    <pre className="research-detail">
                      {JSON.stringify(change.after_value.metadata, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
          </ul>
        </Modal>
      )}
      {upload && (
        <Modal
          title="Add dataset version"
          description="Metadata-only external links and private uploads are supported. No overwrite or public sharing."
          onClose={() => setUpload(null)}
        >
          <form
            className="research-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const file = f.get("file");
                const external = String(f.get("external_url") || "").trim();
                let path: string | undefined;
                if (file instanceof File && file.size) {
                  if (external)
                    throw Error("Choose a file or an external URL, not both");
                  const { ext, mime } = validateFile(file);
                  if (
                    !["csv", "txt", "pdf", "xlsx", "docx", "md"].includes(ext)
                  )
                    throw Error("Use CSV, TXT, PDF, XLSX, DOCX or Markdown");
                  path = `${workspace.workspace.id}/${upload.id}/${userId}/${f.get("kind") === "Permission evidence" ? "evidence-" : ""}${crypto.randomUUID()}.${ext}`;
                  check(
                    await supabase.storage
                      .from("researchflow-datasets")
                      .upload(path, file, { contentType: mime, upsert: false }),
                  );
                } else if (!/^https:\/\/[^\s]+$/.test(external))
                  throw Error("Upload a file or provide an HTTPS URL");
                try {
                  await act("dataset_version", {
                    dataset_id: upload.id,
                    path,
                    external_url: external,
                    name:
                      file instanceof File && file.size
                        ? file.name
                        : String(f.get("name") || "External dataset"),
                    kind: f.get("kind"),
                    notes: f.get("notes"),
                  });
                } catch (err) {
                  if (path)
                    await supabase.storage
                      .from("researchflow-datasets")
                      .remove([path]);
                  throw err;
                }
                setUpload(null);
              });
            }}
          >
            <label>
              Attachment kind
              <select name="kind">
                {[
                  "Dataset",
                  "Data dictionary",
                  "Quality report",
                  "Permission evidence",
                ].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label>
              Private file (maximum 20 MB)
              <input
                name="file"
                type="file"
                accept=".csv,.txt,.pdf,.xlsx,.docx,.md"
              />
            </label>
            <label>
              External HTTPS URL
              <input name="external_url" type="url" />
            </label>
            <label>
              External version name
              <input name="name" maxLength={255} />
            </label>
            <label>
              Version change notes
              <textarea name="notes" maxLength={10000} />
            </label>
            <Button disabled={busy}>Save version</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
