import { describe, expect, it } from "vitest";
import { progress, isOverdue, initials, type Task } from "./types";
const task = (changes: Partial<Task>): Task => ({
  id: "t",
  workspace_id: "w",
  title: "Research",
  description: "",
  phase_id: null,
  assignee_id: null,
  status: "To Do",
  priority: "Medium",
  due_date: null,
  estimated_hours: null,
  archived: false,
  created_at: "",
  updated_at: "",
  ...changes,
});
describe("evidence-based task progress", () => {
  it("has zero progress for an empty workspace", () =>
    expect(progress([])).toBe(0));
  it("counts only completed active tasks, excluding archived work", () =>
    expect(
      progress([
        task({ status: "Completed" }),
        task({ status: "In Review" }),
        task({ archived: true, status: "Completed" }),
      ]),
    ).toBe(50));
  it("does not call completed or archived tasks overdue", () => {
    expect(
      isOverdue(
        task({ due_date: "2026-01-01", status: "Completed" }),
        "2026-02-01",
      ),
    ).toBe(false);
    expect(
      isOverdue(task({ due_date: "2026-01-01", archived: true }), "2026-02-01"),
    ).toBe(false);
  });
  it("uses date boundaries without timezone shifting", () => {
    expect(isOverdue(task({ due_date: "2026-02-01" }), "2026-02-01")).toBe(
      false,
    );
    expect(isOverdue(task({ due_date: "2026-01-31" }), "2026-02-01")).toBe(
      true,
    );
  });
  it("formats long multi-word team names", () =>
    expect(initials("Applied Intelligence Research Lab")).toBe("AI"));
});
