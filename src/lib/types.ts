export type Role = "leader" | "member" | "supervisor";
export const statuses = [
  "To Do",
  "In Progress",
  "Blocked",
  "In Review",
  "Completed",
] as const;
export const priorities = ["Low", "Medium", "High", "Critical"] as const;
export interface Workspace {
  id: string;
  name: string;
  research_title: string;
  institution: string;
  department: string;
  programme: string;
  supervisor_details: string;
  description: string;
  logo_path: string | null;
  accent_color: string;
  start_date: string | null;
  deadline: string | null;
  created_by: string;
}
export interface Member {
  user_id: string;
  role: Role;
  responsibilities: string;
  rf_profiles: { full_name: string; skills: string };
}
export interface Phase {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  objectives: string;
  start_date: string | null;
  deadline: string | null;
  owner_id: string | null;
  position: number;
  status: string;
  review_state: string;
}
export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  phase_id: string | null;
  assignee_id: string | null;
  status: (typeof statuses)[number];
  priority: (typeof priorities)[number];
  due_date: string | null;
  estimated_hours: number | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}
export interface Invitation {
  id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at: string | null;
}
export interface Audit {
  id: string;
  actor_id: string;
  action: string;
  entity_id: string;
  created_at: string;
}
export function progress(tasks: Task[]) {
  const active = tasks.filter((t) => !t.archived);
  return active.length
    ? Math.round(
        (active.filter((t) => t.status === "Completed").length /
          active.length) *
          100,
      )
    : 0;
}
export function isOverdue(
  task: Task,
  today = new Date().toLocaleDateString("en-CA"),
) {
  return Boolean(
    task.due_date &&
      task.due_date < today &&
      task.status !== "Completed" &&
      !task.archived,
  );
}
export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
