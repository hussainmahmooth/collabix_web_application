import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { WorkspaceData } from "../App";
import type { CollaborationData } from "../collaboration/model";
import {
  completion,
  filterTasks,
  localDay,
  taskMetrics,
  type Filters,
  type ResearchData,
} from "./model";
export const reportTypes = [
  "Weekly Research Progress Report",
  "Monthly Research Progress Report",
  "Individual Member Task Summary",
  "Research Phase Progress Report",
  "Supervisor Review Summary",
  "Meeting Minutes Report",
  "Research Paper Completion Report",
  "Dataset Registry Summary",
];
const safe = (v: unknown) =>
  Array.from(String(v ?? "Not recorded"))
    .filter((c) => c.charCodeAt(0) >= 32 || c === "\n" || c === "\t")
    .join("")
    .replace(/([^\s]{50})(?=[^\s])/g, "$1\u200b") || "Not recorded";
function table(title: string, headers: string[], rows: unknown[][]): Content[] {
  return [
    { text: title, style: "subheading" },
    rows.length
      ? {
          table: {
            headerRows: 1,
            widths: headers.map(() => "*"),
            body: [
              headers.map((text) => ({
                text,
                bold: true,
                fillColor: "#e7f1f0",
              })),
              ...rows.map((r) => r.map(safe)),
            ],
          },
          layout: "lightHorizontalLines",
          fontSize: 9,
          margin: [0, 5, 0, 14],
        }
      : { text: "No matching records available.", margin: [0, 0, 0, 12] },
  ];
}
export function reportDefinition(
  type: string,
  w: WorkspaceData,
  r: ResearchData,
  c: CollaborationData,
  filters: Filters,
  generated = new Date(),
  logo?: string,
): TDocumentDefinitions {
  if (!reportTypes.includes(type)) throw Error("Unknown report type");
  if (filters.from && filters.to && filters.from > filters.to)
    throw Error("Invalid reporting period");
  const tasks = filterTasks(w.tasks, filters);
  const metrics = taskMetrics(tasks);
  const person = (id: string | null) =>
    w.members.find((m) => m.user_id === id)?.rf_profiles.full_name ||
    "Not recorded / former member";
  const period = (date: string) =>
    (!filters.from && !filters.to) ||
    ((!filters.from || localDay(date) >= filters.from) &&
      (!filters.to || localDay(date) <= filters.to));
  const content: Content[] = [
    { text: "ResearchFlow", style: "brand" },
    ...(logo
      ? [{ image: logo, fit: [70, 50], alignment: "right" } as Content]
      : []),
    { text: type, style: "heading" },
    { text: safe(w.workspace.name), style: "subheading" },
    { text: safe(w.workspace.research_title) },
    {
      text: `Institution: ${safe(w.workspace.institution)} | Department: ${safe(w.workspace.department)}`,
      style: "meta",
    },
    {
      text: `Reporting period: ${filters.from || "All available dates"} to ${filters.to || "present"}\nGenerated: ${generated.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
      style: "meta",
    },
    ...table(
      "Summary metrics",
      ["Total tasks", "Completed", "Overdue", "Blocked", "Task completion"],
      [
        [
          metrics.total,
          metrics.completed,
          metrics.overdue,
          metrics.blocked,
          metrics.percent === null ? "No tasks" : metrics.percent + "%",
        ],
      ],
    ),
    {
      text: "Task counts use non-archived tasks created in the selected reporting period. Completion is completed tasks / all included tasks. Workflow progress does not establish scientific quality. Data is limited to records accessible to the generating user.",
      style: "meta",
    },
  ];
  if (metrics.total) {
    content.push(
      {
        text: `Task completion: ${metrics.percent}% (${metrics.completed} of ${metrics.total})`,
        style: "meta",
      },
      {
        canvas: [
          { type: "rect", x: 0, y: 0, w: 420, h: 12, color: "#e7edf2" },
          {
            type: "rect",
            x: 0,
            y: 0,
            w: (420 * metrics.completed) / metrics.total,
            h: 12,
            color: "#168e88",
          },
        ],
        margin: [0, 0, 0, 12],
      },
    );
  }
  if (
    [
      "Weekly Research Progress Report",
      "Monthly Research Progress Report",
      "Individual Member Task Summary",
    ].includes(type)
  )
    content.push(
      ...table(
        "Completed tasks",
        ["Task", "Assignee", "Due"],
        tasks
          .filter((t) => t.status === "Completed")
          .map((t) => [t.title, person(t.assignee_id), t.due_date]),
      ),
      ...table(
        "Outstanding tasks, blockers and next actions",
        ["Task / next action", "Status", "Assignee", "Due"],
        tasks
          .filter((t) => t.status !== "Completed")
          .map((t) => [t.title, t.status, person(t.assignee_id), t.due_date]),
      ),
    );
  if (
    [
      "Weekly Research Progress Report",
      "Monthly Research Progress Report",
      "Research Phase Progress Report",
    ].includes(type)
  )
    content.push(
      ...table(
        "Research phases / milestones",
        ["Phase", "State", "Deadline", "Completed / tasks"],
        w.phases
          .filter((p) => !filters.phase || p.id === filters.phase)
          .map((p) => {
            const ts = tasks.filter((t) => t.phase_id === p.id);
            return [
              p.name,
              p.status,
              p.deadline,
              `${ts.filter((t) => t.status === "Completed").length} / ${ts.length}`,
            ];
          }),
      ),
    );
  if (
    [
      "Weekly Research Progress Report",
      "Monthly Research Progress Report",
      "Supervisor Review Summary",
    ].includes(type)
  )
    content.push(
      ...table(
        "Review status",
        ["Submission date", "Target", "Status"],
        c.submissions
          .filter((s) => period(s.created_at))
          .map((s) => [
            s.created_at,
            s.phase_id
              ? w.phases.find((p) => p.id === s.phase_id)?.name
              : "Accessible document version",
            s.status,
          ]),
      ),
      ...table(
        "Supervisor feedback",
        ["Decision", "Reviewer", "Feedback"],
        c.reviews
          .filter((v) => v.kind === "Academic" && period(v.created_at))
          .map((v) => [v.decision, person(v.reviewer_id), v.feedback]),
      ),
    );
  if (
    [
      "Weekly Research Progress Report",
      "Monthly Research Progress Report",
      "Meeting Minutes Report",
    ].includes(type)
  ) {
    for (const meeting of c.meetings.filter((m) => period(m.starts_at))) {
      content.push(
        ...table(
          meeting.title,
          ["Scheduled time", "Type", "Location", "State"],
          [
            [
              new Date(meeting.starts_at).toLocaleString(),
              meeting.type,
              meeting.location,
              meeting.cancelled ? "Cancelled" : "Scheduled",
            ],
          ],
        ),
        ...table(
          "Minutes and decisions",
          ["Kind", "Notes", "Author"],
          c.notes
            .filter((n) => n.meeting_id === meeting.id)
            .map((n) => [n.kind, n.body, person(n.author_id)]),
        ),
        ...table(
          "Meeting actions",
          ["Action", "Assignee", "Due", "Task state"],
          c.actions
            .filter(
              (a) =>
                a.meeting_id === meeting.id &&
                (!filters.member || a.assignee_id === filters.member),
            )
            .map((a) => [
              a.title,
              person(a.assignee_id),
              a.due_date,
              w.tasks.find((t) => t.id === a.task_id)?.status ||
                "Not converted to task",
            ]),
        ),
      );
    }
  }
  if (type === "Research Paper Completion Report") {
    for (const paper of r.papers) {
      const ss = r.sections.filter(
        (s) =>
          s.paper_id === paper.id &&
          (!filters.member || s.assignees.includes(filters.member)),
      );
      content.push(
        { text: paper.title, style: "subheading" },
        {
          text: `Publication: ${safe(paper.venue)} | Status: ${paper.status} | Section approval: ${completion(ss) ?? "No sections"}${ss.length ? "%" : ""}`,
        },
        ...table(
          "Outline checklist",
          ["Section", "State", "Due", "Assignees"],
          ss.map((s) => [
            s.title,
            s.status,
            s.deadline,
            s.assignees.map(person).join(", "),
          ]),
        ),
        ...table(
          "Academic section feedback",
          ["Section", "Decision", "Feedback"],
          r.feedback
            .filter(
              (f) =>
                f.kind !== "Comment" &&
                ss.some((s) => s.id === f.section_id) &&
                period(f.created_at),
            )
            .map((f) => [
              ss.find((s) => s.id === f.section_id)?.title,
              f.kind,
              f.body,
            ]),
        ),
      );
    }
  }
  if (type === "Dataset Registry Summary")
    content.push(
      {
        text: "Metadata summary only. No raw data, permission evidence contents, customer details or external data links are exported. Registry status is not legal authorization.",
        style: "meta",
      },
      ...table(
        "Accessible datasets",
        ["Dataset", "Classification", "Permission", "Status", "Retention due"],
        r.datasets
          .filter(
            (d) =>
              (!filters.member || d.assignee_id === filters.member) &&
              (!filters.phase || d.phase_id === filters.phase) &&
              period(d.updated_at),
          )
          .map((d) => [
            d.name,
            d.classification,
            d.permission_status,
            d.status,
            d.retention_date,
          ]),
      ),
    );
  return {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 46],
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#24344b",
      lineHeight: 1.2,
    },
    styles: {
      brand: {
        fontSize: 13,
        bold: true,
        color: "#168e88",
        margin: [0, 0, 0, 10],
      },
      heading: {
        fontSize: 23,
        bold: true,
        color: "#101e36",
        margin: [0, 0, 0, 12],
      },
      subheading: { fontSize: 13, bold: true, margin: [0, 14, 0, 6] },
      meta: { fontSize: 8, color: "#64748b", margin: [0, 8, 0, 12] },
    },
    content,
    footer: (page, total) => ({
      text: `Developed by Micro Biz Tek  |  ResearchFlow  |  ${page} / ${total}`,
      alignment: "center",
      fontSize: 8,
      color: "#64748b",
      margin: [20, 15, 20, 0],
    }),
    info: {
      title: type,
      author: "ResearchFlow — Micro Biz Tek",
      subject: w.workspace.research_title,
    },
  };
}
export async function pdfBytes(definition: TDocumentDefinitions) {
  const pdfMake = (await import("pdfmake/build/pdfmake")).default;
  const fonts = (await import("pdfmake/build/vfs_fonts")).default;
  pdfMake.addVirtualFileSystem(fonts);
  return pdfMake.createPdf(definition).getBlob();
}
