import { supabase, check } from "../lib/supabase";

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  archived: boolean;
}
export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  body: string;
  reply_to: string | null;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}
export interface Folder {
  id: string;
  name: string;
}
export interface ResearchDocument {
  id: string;
  title: string;
  folder_id: string;
  created_by: string;
  restricted: boolean;
  archived: boolean;
  trashed_at?: string | null;
  phase_id: string | null;
  task_id: string | null;
  updated_at: string;
}
export interface ResearchFile {
  id: string;
  name: string;
  path: string;
  mime: string;
  bytes: number;
  owner_id: string;
  document_id: string | null;
  message_id: string | null;
  announcement_id: string | null;
  created_at: string;
}
export interface Version {
  id: string;
  document_id: string;
  file_id: string;
  version: number;
  notes: string;
  author_id: string;
  created_at: string;
}
export interface Comment {
  id: string;
  document_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
export interface Meeting {
  id: string;
  title: string;
  description: string;
  type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location: string;
  agenda: string;
  organizer_id: string;
  cancelled: boolean;
  created_at: string;
}
export interface MeetingNote {
  id: string;
  meeting_id: string;
  author_id: string;
  kind: string;
  body: string;
  created_at: string;
}
export interface MeetingAction {
  id: string;
  meeting_id: string;
  title: string;
  assignee_id: string;
  due_date: string;
  task_id: string | null;
}
export interface Submission {
  correction_reason?: string | null;
  withdrawn_at?: string | null;
  withdrawn_by?: string | null;
  replaces_submission_id?: string | null;
  id: string;
  version_id: string | null;
  phase_id: string | null;
  requested_by: string;
  status: string;
  internal_status: string;
  created_at: string;
}
export interface Review {
  id: string;
  submission_id: string;
  reviewer_id: string;
  kind: string;
  decision: string;
  feedback: string;
  created_at: string;
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  pinned: boolean;
  archived: boolean;
  author_id: string;
  created_at: string;
}
export interface CollaborationData {
  channels: Channel[];
  folders: Folder[];
  documents: ResearchDocument[];
  files: ResearchFile[];
  versions: Version[];
  comments: Comment[];
  access: { document_id: string; user_id: string }[];
  meetings: Meeting[];
  participants: { meeting_id: string; user_id: string }[];
  notes: MeetingNote[];
  actions: MeetingAction[];
  submissions: Submission[];
  reviews: Review[];
  announcements: Announcement[];
  announcementReads: { announcement_id: string }[];
  unread: { channel_id: string; unread_count: number }[];
}
const tables = {
  channels: "rf_channels",
  folders: "rf_document_folders",
  documents: "rf_documents",
  files: "rf_files",
  versions: "rf_document_versions",
  comments: "rf_document_comments",
  access: "rf_document_access",
  meetings: "rf_meetings",
  participants: "rf_meeting_participants",
  notes: "rf_meeting_notes",
  actions: "rf_meeting_actions",
  submissions: "rf_submissions",
  reviews: "rf_reviews",
  announcements: "rf_announcements",
  announcementReads: "rf_announcement_reads",
  unread: "rf_channel_unread",
} as const;
export async function loadCollaboration(
  workspace: string,
): Promise<CollaborationData> {
  const results = await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      // Page through metadata rather than silently truncating at PostgREST's row limit.
      const rows: unknown[] = [];
      for (let start = 0; ; start += 500) {
        const order =
          key === "access"
            ? "document_id"
            : key === "participants"
              ? "meeting_id"
              : key === "announcementReads"
                ? "announcement_id"
                : key === "unread"
                  ? "channel_id"
                  : "id";
        let request = supabase
          .from(table)
          .select("*")
          .eq("workspace_id", workspace)
          .order(order);
        if (key === "access" || key === "participants")
          request = request.order("user_id");
        const page = check(await request.range(start, start + 499)) || [];
        rows.push(...page);
        if (page.length < 500) break;
      }
      return [key, rows];
    }),
  );
  return Object.fromEntries(results) as unknown as CollaborationData;
}
export async function collaborate(
  workspace_id: string,
  action: string,
  fields: Record<string, unknown> = {},
): Promise<string> {
  const data = check(
    await supabase.rpc("rf_collaborate", {
      action,
      p: { ...fields, workspace_id },
    }),
  );
  return data.id as string;
}
export const fileTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
export const acceptFiles = Object.keys(fileTypes)
  .map((x) => `.${x}`)
  .join(",");
export function validateFile(file: Pick<File, "name" | "size" | "type">) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!fileTypes[ext])
    throw new Error(
      "Choose PDF, DOCX, XLSX, CSV, TXT, Markdown, PNG, JPEG, WebP or GIF.",
    );
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Files must be between 1 byte and 20 MB.");
  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    file.type !== fileTypes[ext] &&
    !(
      ext === "csv" &&
      ["application/vnd.ms-excel", "text/plain"].includes(file.type)
    ) &&
    !(ext === "md" && file.type === "text/plain")
  )
    throw new Error("The file type does not match its extension.");
  return { ext, mime: fileTypes[ext] };
}
export async function uploadAttachment(
  workspace: string,
  user: string,
  file: File,
  target: Record<string, unknown>,
) {
  const { ext, mime } = validateFile(file);
  const path = `${workspace}/${user}/${crypto.randomUUID()}.${ext}`;
  check(
    await supabase.storage
      .from("researchflow-files")
      .upload(path, file, { contentType: mime, upsert: false }),
  );
  try {
    return await collaborate(workspace, "file_register", {
      ...target,
      path,
      name: file.name,
    });
  } catch (error) {
    await supabase.storage.from("researchflow-files").remove([path]);
    throw error;
  }
}
export const displayTime = (iso: string, timezone?: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(new Date(iso));
export function zonedInput(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function toInstant(local: string, timezone: string) {
  const target = Date.parse(local + ":00Z");
  if (!Number.isFinite(target))
    throw new Error("Choose a valid meeting date and time.");
  let guess = target;
  for (let i = 0; i < 4; i++) {
    const rendered = Date.parse(
      zonedInput(new Date(guess).toISOString(), timezone) + ":00Z",
    );
    guess += target - rendered;
  }
  const iso = new Date(guess).toISOString();
  if (zonedInput(iso, timezone) !== local)
    throw new Error(
      "That time does not exist in this timezone because of daylight saving. Choose another time.",
    );
  return iso;
}
export function safeLink(value: string) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
