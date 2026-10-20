import { describe, it, expect } from "vitest";
import {
  completion,
  emptyFilters,
  filterTasks,
  githubUrl,
  importReferences,
  parseCsv,
  referenceCsv,
  referenceBib,
  taskMetrics,
  wordCount,
  type Section,
  type Reference,
} from "./model";
import { reportDefinition, reportTypes } from "./pdfReports";
import type { Task } from "../lib/types";
import type { WorkspaceData } from "../App";
import type { ResearchData } from "./model";
import type { CollaborationData } from "../collaboration/model";
const task = (
  id: string,
  status: Task["status"],
  extra: Partial<Task> = {},
): Task => ({
  id,
  workspace_id: "w",
  title: "Task " + id,
  description: "",
  phase_id: "p",
  assignee_id: "m",
  status,
  priority: "Medium",
  due_date: "2026-10-01",
  estimated_hours: null,
  archived: false,
  created_at: "2026-10-10T12:00:00Z",
  updated_at: "2026-10-10T12:00:00Z",
  ...extra,
});
describe("Research operations calculations and input boundaries", () => {
  it("uses active tasks only and labels a zero denominator as unavailable", () => {
    expect(taskMetrics([]).percent).toBeNull();
    expect(
      taskMetrics(
        [
          task("a", "Completed"),
          task("b", "Blocked"),
          task("c", "To Do", { archived: true }),
        ],
        "2026-10-21",
      ),
    ).toEqual({ total: 2, completed: 1, overdue: 1, blocked: 1, percent: 50 });
  });
  it("combines date/member/phase/status filters without counting archived work", () => {
    const ts = [
      task("a", "Completed"),
      task("b", "To Do"),
      task("c", "Completed", { phase_id: "other" }),
    ];
    expect(
      filterTasks(ts, {
        ...emptyFilters,
        member: "m",
        phase: "p",
        status: "Completed",
        from: "2026-10-01",
        to: "2026-10-20",
      }).map((t) => t.id),
    ).toEqual(["a"]);
  });
  it("counts only approved sections and handles an empty paper", () => {
    expect(completion([])).toBeNull();
    expect(
      completion([
        { status: "Approved" },
        { status: "Supervisor Review" },
      ] as Section[]),
    ).toBe(50);
    expect(wordCount("  a\n b\t c  ")).toBe(3);
  });
  it("validates repository identity, protocol, type and untrusted URL tricks", () => {
    const repo = "https://github.com/team/research";
    expect(githubUrl(repo + "/")).toBe(repo);
    expect(githubUrl(repo + "/issues/2", "Issue", repo)).toBe(
      repo + "/issues/2",
    );
    expect(
      githubUrl(repo + "/tree/feature/report", "Branch", repo),
    ).toBeTruthy();
    for (const bad of [
      "javascript:alert(1)",
      "https://github.com.evil.com/team/research",
      "https://user:secret@github.com/team/research",
      "https://github.com/team/research?token=secret",
      "https://github.com/team/../research",
    ])
      expect(githubUrl(bad)).toBeNull();
    expect(githubUrl(repo + "/pull/2", "Issue", repo)).toBeNull();
    expect(
      githubUrl("https://github.com/other/research/issues/2", "Issue", repo),
    ).toBeNull();
  });
  it("imports quoted multiline CSV and refuses invalid headers, URLs and excessive imports", () => {
    expect(parseCsv('a,b\r\n"x,y","line 1\nline 2"')).toEqual([
      ["a", "b"],
      ["x,y", "line 1\nline 2"],
    ]);
    expect(
      importReferences(
        'authors,title,year,venue,url,notes\n"A, B","Real user reference",2026,Venue,https://example.org,"notes"',
      )[0].title,
    ).toBe("Real user reference");
    expect(() => importReferences("url\nhttps://example.org")).toThrow("title");
    expect(() =>
      importReferences("title,url\nTest,javascript:alert(1)"),
    ).toThrow();
    expect(() => parseCsv('"unclosed')).toThrow();
    expect(() =>
      importReferences("title\n" + Array(201).fill("x").join("\n")),
    ).toThrow("200");
  });
  it("exports safe CSV and escaped BibTeX without executable formulas", () => {
    const ref = {
      id: "r",
      paper_id: "p",
      title: "=SUM(1,2)",
      authors: "{Author}",
      year: 2026,
      venue: "Venue",
      url: "https://example.org",
      notes: "\\command{evil}",
    } as Reference;
    expect(referenceCsv([ref])).toContain("'=SUM");
    expect(referenceBib([ref])).not.toContain("\\command");
  });
  it("defines all eight reports with A4 layout and immutable attribution", () => {
    const w = {
      workspace: {
        id: "w",
        name: "Custom team",
        research_title: "Research title",
        institution: "University",
        department: "Department",
      },
      members: [],
      phases: [],
      tasks: [task("a", "Completed")],
    } as unknown as WorkspaceData;
    const r = {
      papers: [],
      sections: [],
      feedback: [],
      references: [],
      datasets: [],
      datasetVersions: [],
      accessEvents: [],
      datasetChanges: [],
      repositories: [],
      links: [],
    } as ResearchData;
    const c = {
      submissions: [],
      reviews: [],
      meetings: [],
      notes: [],
      actions: [],
    } as unknown as CollaborationData;
    for (const type of reportTypes) {
      const def = reportDefinition(
        type,
        w,
        r,
        c,
        emptyFilters,
        new Date("2026-10-21T00:00:00Z"),
      );
      expect(def.pageSize).toBe("A4");
      expect(JSON.stringify(def.content)).toContain("Custom team");
      expect(typeof def.footer).toBe("function");
    }
    expect(() =>
      reportDefinition("Invented report", w, r, c, emptyFilters),
    ).toThrow();
  });
});
