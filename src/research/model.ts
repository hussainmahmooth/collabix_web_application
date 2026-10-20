import { z } from "zod";
import { check, supabase } from "../lib/supabase";
import type { Task } from "../lib/types";
import { isOverdue } from "../lib/types";
export interface Paper {
  id: string;
  title: string;
  abstract: string;
  keywords: string;
  authors: string[];
  corresponding_author: string | null;
  supervisor_id: string | null;
  venue: string;
  deadline: string | null;
  publication_date: string | null;
  status: string;
  created_by: string;
  created_at: string;
}
export interface Section {
  id: string;
  paper_id: string;
  title: string;
  position: number;
  notes: string;
  assignees: string[];
  deadline: string | null;
  status: string;
  task_id: string | null;
  version_id: string | null;
  updated_at: string;
}
export interface Feedback {
  id: string;
  section_id: string;
  author_id: string;
  kind: string;
  body: string;
  created_at: string;
}
export interface Reference {
  id: string;
  paper_id: string;
  authors: string;
  title: string;
  year: number | null;
  venue: string;
  url: string;
  notes: string;
}
export interface Dataset {
  id: string;
  name: string;
  description: string;
  classification: string;
  permission_status: string;
  status: string;
  restricted: boolean;
  readers: string[];
  assignee_id: string | null;
  phase_id: string | null;
  retention_date: string | null;
  checkpoint_date: string | null;
  metadata: Record<string, string>;
  created_by: string;
  updated_at: string;
}
export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version: number;
  kind: string;
  path: string | null;
  name: string;
  mime: string;
  bytes: number;
  external_url: string | null;
  notes: string;
  author_id: string;
  created_at: string;
}
export interface Notification {
  id: string;
  category: string;
  message: string;
  destination: string;
  read_at: string | null;
  created_at: string;
}
export interface Preference {
  id: string;
  category: string;
  enabled: boolean;
}
export interface Repository {
  id: string;
  url: string;
}
export interface GithubLink {
  id: string;
  repository_id: string;
  task_id: string;
  member_id: string;
  kind: string;
  url: string;
  description: string;
  created_at: string;
}
export interface AccessEvent {
  id: string;
  version_id: string;
  user_id: string;
  created_at: string;
}
export interface DatasetChange {
  id: string;
  dataset_id: string;
  actor_id: string;
  created_at: string;
  before_value: Dataset | null;
  after_value: Dataset;
}
export interface ResearchData {
  papers: Paper[];
  sections: Section[];
  feedback: Feedback[];
  references: Reference[];
  datasets: Dataset[];
  datasetVersions: DatasetVersion[];
  accessEvents: AccessEvent[];
  datasetChanges: DatasetChange[];
  repositories: Repository[];
  links: GithubLink[];
}
export const researchTables = {
  papers: "rf_papers",
  sections: "rf_paper_sections",
  feedback: "rf_paper_feedback",
  references: "rf_references",
  datasets: "rf_datasets",
  datasetVersions: "rf_dataset_versions",
  accessEvents: "rf_dataset_access_events",
  datasetChanges: "rf_dataset_changes",
  repositories: "rf_github_repositories",
  links: "rf_github_links",
};
export async function rows<T>(table: string, w: string): Promise<T[]> {
  const result: T[] = [];
  for (let n = 0; ; n += 500) {
    const page =
      check(
        await supabase
          .from(table)
          .select("*")
          .eq("workspace_id", w)
          .order("id")
          .range(n, n + 499),
      ) || [];
    result.push(...(page as T[]));
    if (page.length < 500) return result;
  }
}
export async function loadResearch(w: string): Promise<ResearchData> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(researchTables).map(async ([k, t]) => [
        k,
        await rows(t, w),
      ]),
    ),
  ) as unknown as ResearchData;
}
export async function operate(
  w: string,
  action: string,
  p: Record<string, unknown> = {},
) {
  return check(
    await supabase.rpc("rf_operations", {
      action,
      p: { ...p, workspace_id: w },
    }),
  ) as { id: string };
}
export const sectionStatuses = [
  "Not Started",
  "Drafting",
  "Internal Review",
  "Supervisor Review",
  "Revision Requested",
];
export const paperStatuses = [
  "Planning",
  "Drafting",
  "Under Review",
  "Submitted",
  "Accepted",
  "Published",
  "Archived",
];
export const datasetStatuses = [
  "Proposed",
  "Permission Pending",
  "Approved for Use",
  "Collected",
  "Under Validation",
  "Ready for Analysis",
  "Restricted",
  "Archived",
];
export const categories = [
  "Tasks",
  "Deadlines",
  "Reviews",
  "Papers",
  "Datasets",
  "Meetings",
  "Announcements",
  "Mentions",
  "Milestones",
];
export function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
export function completion(sections: Section[]) {
  return sections.length
    ? Math.round(
        (sections.filter((s) => s.status === "Approved").length /
          sections.length) *
          100,
      )
    : null;
}
export interface Filters {
  from: string;
  to: string;
  member: string;
  phase: string;
  status: string;
}
export const emptyFilters: Filters = {
  from: "",
  to: "",
  member: "",
  phase: "",
  status: "",
};
export function localDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}
export function filterTasks(tasks: Task[], f: Filters) {
  return tasks.filter(
    (t) =>
      !t.archived &&
      (!f.from || localDay(t.created_at) >= f.from) &&
      (!f.to || localDay(t.created_at) <= f.to) &&
      (!f.member || t.assignee_id === f.member) &&
      (!f.phase || t.phase_id === f.phase) &&
      (!f.status || t.status === f.status),
  );
}
export function taskMetrics(tasks: Task[], today?: string) {
  const active = tasks.filter((t) => !t.archived);
  const completed = active.filter((t) => t.status === "Completed").length;
  return {
    total: active.length,
    completed,
    overdue: active.filter((t) => isOverdue(t, today)).length,
    blocked: active.filter((t) => t.status === "Blocked").length,
    percent: active.length
      ? Math.round((completed / active.length) * 100)
      : null,
  };
}
export function githubUrl(value: string, kind?: string, repo?: string) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "github.com" ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      value.includes("..")
    )
      return null;
    const base =
      "https://github.com/" +
      u.pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    if (
      !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(base) ||
      (repo && base !== repo)
    )
      return null;
    const suffix = u.href.slice(base.length);
    const tests: Record<string, RegExp> = {
      Issue: /^\/issues\/\d+$/,
      "Pull request": /^\/pull\/\d+$/,
      Commit: /^\/commit\/[a-f0-9]{7,40}$/i,
      Branch: /^\/tree\/[A-Za-z0-9_./%~-]+$/,
    };
    return kind
      ? tests[kind]?.test(suffix)
        ? u.href
        : null
      : !suffix || suffix === "/"
        ? base
        : null;
  } catch {
    return null;
  }
}
export const referenceSchema = z.object({
  authors: z.string().max(2000).default(""),
  title: z.string().trim().min(1).max(1000),
  year: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((v) => (v ? String(v) : "")),
  venue: z.string().max(2000).default(""),
  url: z
    .string()
    .max(2000)
    .default("")
    .refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), "Use an HTTPS DOI/URL"),
  notes: z.string().max(10000).default(""),
});
// RFC 4180 quoting; no naive split on commas or newlines inside quoted fields.
export function parseCsv(text: string) {
  const result: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) result.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Unclosed CSV quote");
  row.push(field);
  if (row.some(Boolean)) result.push(row);
  return result;
}
export function importReferences(text: string) {
  if (text.length > 200000) throw Error("Import limit: 200 KB");
  const [headers, ...data] = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!headers?.includes("title")) throw Error("CSV needs a title column");
  if (data.length > 200) throw Error("Import at most 200 references at a time");
  return data.map((row) =>
    referenceSchema.parse(
      Object.fromEntries(
        headers.map((h, i) => [h.trim().toLowerCase(), row[i] || ""]),
      ),
    ),
  );
}
const csvCell = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export function referenceCsv(refs: Reference[]) {
  const keys = ["authors", "title", "year", "venue", "url", "notes"] as const;
  return [
    keys.join(","),
    ...refs.map((r) => keys.map((k) => csvCell(r[k])).join(",")),
  ].join("\r\n");
}
export function referenceBib(refs: Reference[]) {
  const escape = (s: unknown) =>
    String(s ?? "")
      .replace(/[{}\\]/g, " ")
      .replace(/[\r\n]/g, " ");
  return refs
    .map(
      (r, i) =>
        `@misc{researchflow${i + 1},\n  author = {${escape(r.authors)}},\n  title = {${escape(r.title)}},\n  year = {${escape(r.year)}},\n  howpublished = {${escape(r.venue)}},\n  url = {${escape(r.url)}},\n  note = {${escape(r.notes)}}\n}`,
    )
    .join("\n\n");
}
export function downloadText(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
