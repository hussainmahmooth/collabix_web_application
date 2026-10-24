import { test, expect } from "@playwright/test";
import { recordTables } from "../src/lib/recordLifecycle";

test("leaders edit, cancel deletion, trash and restore every mutable record type", async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(120000);
  const user = "11111111-1111-4111-8111-111111111111",
    w = "22222222-2222-4222-8222-222222222222",
    now = new Date().toISOString();
  const state: Record<string, Record<string, unknown>[]> = {};
  const add = (entity: string, fields: Record<string, unknown>) =>
    (state[recordTables[entity]] = [
      {
        id: entity,
        workspace_id: w,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        ...fields,
      },
    ]);
  add("phases", {
    name: "Fixture phase",
    description: "Original description",
    objectives: "Objectives",
    position: 0,
    status: "To Do",
    review_state: "Not requested",
    owner_id: user,
  });
  add("channels", { name: "Fixture channel", archived: false });
  add("documents", {
    title: "Fixture document",
    folder_id: "folder",
    created_by: user,
    restricted: false,
    archived: false,
    trashed_at: null,
  });
  add("document_comments", {
    body: "Fixture comment",
    document_id: "documents",
    author_id: user,
  });
  add("meetings", {
    title: "Fixture meeting",
    description: "Description",
    type: "Team Meeting",
    starts_at: now,
    ends_at: new Date(Date.now() + 3600000).toISOString(),
    timezone: "Asia/Colombo",
    location: "Online",
    agenda: "Agenda",
    organizer_id: user,
    cancelled: false,
  });
  add("meeting_notes", {
    body: "Fixture minutes",
    kind: "Minutes",
    meeting_id: "meetings",
    author_id: user,
  });
  add("meeting_actions", {
    title: "Fixture action",
    meeting_id: "meetings",
    assignee_id: user,
    due_date: "2027-01-01",
    task_id: null,
  });
  add("announcements", {
    title: "Fixture announcement",
    body: "Announcement body",
    priority: "Normal",
    pinned: false,
    archived: false,
    author_id: user,
  });
  add("papers", {
    title: "Fixture paper",
    abstract: "Abstract",
    keywords: "research",
    authors: [user],
    venue: "Symposium",
    status: "Planning",
    created_by: user,
  });
  add("sections", {
    title: "Fixture section",
    paper_id: "papers",
    position: 1,
    notes: "Section notes",
    assignees: [],
    status: "Drafting",
    task_id: null,
    version_id: null,
  });
  add("references", {
    title: "Fixture reference",
    paper_id: "papers",
    authors: "Author",
    year: 2026,
    venue: "Journal",
    url: "https://example.invalid/reference",
    notes: "Reference notes",
  });
  add("datasets", {
    name: "Fixture dataset",
    description: "Dataset description",
    classification: "Public",
    permission_status: "Not requested",
    status: "Proposed",
    restricted: false,
    readers: [],
    metadata: {},
    created_by: user,
  });
  add("repositories", { url: "https://github.com/example/research" });
  add("links", {
    repository_id: "repositories",
    task_id: "task",
    member_id: user,
    kind: "Issue",
    url: "https://github.com/example/research/issues/1",
    description: "Development work",
  });
  state.rf_tasks = [
    {
      id: "task",
      workspace_id: w,
      title: "Fixture task",
      status: "To Do",
      priority: "Medium",
      archived: false,
      created_at: now,
    },
  ];
  state.rf_document_folders = [{ id: "folder", name: "Research papers" }];
  state.rf_record_changes = [];
  const workspace = {
    id: w,
    name: "CRUD Test Lab",
    research_title: "Synthetic research",
    created_by: user,
    accent_color: "#168e88",
  };
  await page.routeWebSocket(/wss:\/\/.*\.supabase\.co\/.*/, (ws) => ws.close());
  await page.addInitScript(
    ({ user }) =>
      localStorage.setItem(
        "sb-mephxqyntqqoxfnygavy-auth-token",
        JSON.stringify({
          access_token: "test.ui.contract",
          refresh_token: "fixture",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: user,
            email: "crud@example.invalid",
            aud: "authenticated",
            role: "authenticated",
            user_metadata: { full_name: "Test Leader" },
          },
        }),
      ),
    { user },
  );
  await page.route("https://*.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    let result: unknown = [];
    if (path.endsWith("/rpc/rf_manage_record")) {
      const { entity, operation, p } = req.postDataJSON();
      expect(p.workspace_id).toBe(w);
      const row = state[recordTables[entity]].find((r) => r.id === p.id)!;
      const before = { ...row };
      if (operation === "edit") Object.assign(row, p.changes);
      else
        row[entity === "documents" ? "trashed_at" : "deleted_at"] =
          operation === "trash" ? now : null;
      state.rf_record_changes.push({
        id: String(state.rf_record_changes.length),
        entity,
        entity_id: row.id,
        action: operation,
        created_at: now,
        before_value: before,
        after_value: { ...row },
      });
      result = { id: row.id };
    } else if (path.endsWith("/rf_workspaces")) result = [workspace];
    else if (path.endsWith("/rf_workspace_members"))
      result = [
        {
          user_id: user,
          role: "leader",
          responsibilities: "",
          rf_profiles: { full_name: "Test Leader", skills: "" },
        },
      ];
    else if (path.includes("/rest/v1/")) {
      const table = path.split("/").pop()!;
      result = state[table] || [];
      if (table === "rf_record_changes")
        result = state[table].filter(
          (r) => `eq.${r.entity_id}` === url.searchParams.get("entity_id"),
        );
    } else if (path.includes("/auth/v1/user"))
      result = { id: user, email: "crud@example.invalid" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  const cases = [
    ["phases", "phases", "Name", "Revised phase"],
    ["discussions", "channels", "Channel name", "Revised channel"],
    ["documents", "documents", "Document title", "Revised document"],
    ["documents", "document_comments", "Comment", "Revised comment"],
    ["meetings", "meetings", "Meeting title", "Revised meeting"],
    ["meetings", "meeting_notes", "Note", "Revised minutes"],
    ["meetings", "meeting_actions", "Action title", "Revised action"],
    ["announcements", "announcements", "Title", "Revised announcement"],
    ["papers", "papers", "Paper title", "Revised paper"],
    ["papers", "sections", "Section title", "Revised section"],
    ["papers", "references", "Reference title", "Revised reference"],
    ["datasets", "datasets", "Dataset name", "Revised dataset"],
    [
      "github",
      "repositories",
      "Repository HTTPS URL",
      "https://github.com/example/research",
    ],
    [
      "github",
      "links",
      "GitHub URL",
      "https://github.com/example/research/issues/2",
    ],
  ];
  for (const [route, entity, label, value] of cases) {
    await page.goto(`/${route}`);
    const panel = page.locator(".record-manager");
    await panel
      .getByRole("button", { name: "Manage records", exact: true })
      .click();
    await panel
      .getByRole("combobox", { name: "Record type", exact: true })
      .selectOption(entity);
    await panel.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByLabel(label, { exact: true })
      .fill(value);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await panel.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("button", { name: "Cancel deletion", exact: true })
      .click();
    expect(state[recordTables[entity]][0].deleted_at).toBeNull();
    await panel.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("button", { name: "Move to Trash", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Edit", exact: true }),
    ).toHaveCount(0);
    await panel.getByLabel("Show Trash", { exact: true }).check();
    await expect(panel.locator(".managed-record-list li")).toHaveCount(1);
    await panel.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(
      panel.getByText("Trash is empty for this record type."),
    ).toBeVisible();
    await panel.getByLabel("Show Trash", { exact: true }).uncheck();
    await panel.getByRole("button", { name: "History", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Record change history", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: /edit ·/ }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    expect(state[recordTables[entity]]).toHaveLength(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({path:`test-results/crud-${test.info().project.name}.png`,fullPage:true});
});
