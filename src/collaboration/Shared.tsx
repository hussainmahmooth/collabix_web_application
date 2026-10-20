import { createContext, useContext, useState } from "react";
import { Download, Eye, Paperclip } from "lucide-react";
import type { WorkspaceData } from "../App";
import { Button, Modal } from "../components/ui";
import { check, supabase } from "../lib/supabase";
import {
  collaborate,
  displayTime,
  type CollaborationData,
  type ResearchFile,
} from "./model";
export interface CollaborationContextValue {
  workspace: WorkspaceData;
  data: CollaborationData;
  userId: string;
  leader: boolean;
  supervisor: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>, message?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  act: (action: string, fields?: Record<string, unknown>) => Promise<string>;
}
export const CollaborationContext =
  createContext<CollaborationContextValue | null>(null);
export function useCollab() {
  const c = useContext(CollaborationContext);
  if (!c) throw new Error("Collaboration context missing");
  return c;
}
export function usePerson() {
  const { workspace } = useCollab();
  return (id: string) =>
    workspace.members.find((x) => x.user_id === id)?.rf_profiles.full_name ||
    "Former member";
}
export function Stamp({ user, at }: { user: string; at: string }) {
  const person = usePerson();
  return (
    <small className="collab-meta">
      {person(user)} · {displayTime(at)}
    </small>
  );
}
export function Status({ children }: { children: React.ReactNode }) {
  return <span className="collab-status">{children}</span>;
}
export function Files({ files }: { files: ResearchFile[] }) {
  const { run } = useCollab();
  const [preview, setPreview] = useState<{
    name: string;
    url?: string;
    text?: string;
  } | null>(null);
  async function open(file: ResearchFile, show: boolean) {
    const result = check(
      await supabase.storage
        .from("researchflow-files")
        .createSignedUrl(
          file.path,
          60,
          show ? undefined : { download: file.name },
        ),
    );
    if (!result) throw new Error("Could not create a secure file link.");
    if (show && file.mime.startsWith("text/")) {
      if (file.bytes > 1024 * 1024)
        throw new Error(
          "Text previews support up to 1 MB. Download this file to view it.",
        );
      const response = await fetch(result.signedUrl);
      if (!response.ok) throw new Error("Could not load the file preview.");
      setPreview({ name: file.name, text: await response.text() });
    } else if (show && file.mime.startsWith("image/"))
      setPreview({ name: file.name, url: result.signedUrl });
    else {
      const link = document.createElement("a");
      link.href = result.signedUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    }
  }
  return (
    <>
      <div className="collab-files">
        {files.map((f) => (
          <div key={f.id} className="collab-file">
            <Paperclip size={14} />
            <span>
              {f.name}
              <small>
                {(f.bytes / 1024).toFixed(1)} KB · {f.mime}
              </small>
            </span>
            {(f.mime.startsWith("text/") ||
              f.mime.startsWith("image/") ||
              f.mime === "application/pdf") && (
              <Button
                variant="ghost"
                onClick={() => void run(() => open(f, true), "Preview ready")}
                aria-label={`Preview ${f.name}`}
              >
                <Eye size={15} />
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => void run(() => open(f, false), "Download opened")}
              aria-label={`Download ${f.name}`}
            >
              <Download size={15} />
            </Button>
          </div>
        ))}
      </div>
      {preview && (
        <Modal
          title={preview.name}
          description="Private preview. Image links expire after one minute."
          onClose={() => setPreview(null)}
        >
          {preview.url ? (
            <img
              className="file-preview"
              src={preview.url}
              alt={preview.name}
            />
          ) : (
            <pre className="text-preview">{preview.text}</pre>
          )}
        </Modal>
      )}
    </>
  );
}
export function useAction() {
  const { workspace } = useCollab();
  return (action: string, fields: Record<string, unknown> = {}) =>
    collaborate(workspace.workspace.id, action, fields);
}
