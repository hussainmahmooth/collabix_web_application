import { test, expect } from "@playwright/test";
import { readFile, copyFile, mkdir } from "node:fs/promises";
test.setTimeout(120000);
for (const role of ["leader", "member", "supervisor"])
  test(`MVP3 ${role} research operations`, async ({ page }, testInfo) => {
    page.setDefaultTimeout(20000);
    page.setDefaultNavigationTimeout(60000);
    const w = "22222222-2222-4222-8222-222222222222",
      leader = "11111111-1111-4111-8111-111111111111",
      member = "33333333-3333-4333-8333-333333333333",
      supervisor = "44444444-4444-4444-8444-444444444444";
    const user = { leader, member, supervisor }[role]!;
    const now = new Date().toISOString();
    const workspace = {
      id: w,
      name: "Research Operations Lab",
      research_title: "Synthetic research fixture",
      institution: "Test University",
      department: "Research",
      created_by: leader,
      accent_color: "#168e88",
      logo_path: null,
    };
    const members = [
      {
        user_id: leader,
        role: "leader",
        responsibilities: "",
        rf_profiles: { full_name: "Team Leader", skills: "" },
      },
      {
        user_id: member,
        role: "member",
        responsibilities: "",
        rf_profiles: { full_name: "Research Member", skills: "" },
      },
      {
        user_id: supervisor,
        role: "supervisor",
        responsibilities: "",
        rf_profiles: { full_name: "Academic Supervisor", skills: "" },
      },
    ];
    const state: Record<string, Record<string, unknown>[]> = {
      rf_papers: [
        {
          id: "paper-1",
          workspace_id: w,
          title: "Test Paper",
          abstract: "Synthetic abstract for UI testing",
          keywords: "testing",
          authors: [member],
          corresponding_author: member,
          supervisor_id: supervisor,
          venue: "Test Symposium",
          deadline: "2027-02-01",
          publication_date: "2027-03-01",
          status: "Drafting",
          created_by: leader,
          created_at: now,
        },
      ],
      rf_paper_sections: [
        {
          id: "section-1",
          workspace_id: w,
          paper_id: "paper-1",
          title: "Methodology",
          position: 1,
          notes: "Entered section notes",
          assignees: [member],
          deadline: "2027-01-25",
          status: "Supervisor Review",
          task_id: "task-1",
          version_id: null,
          updated_at: now,
        },
      ],
      rf_paper_feedback: [],
      rf_references: [],
      rf_datasets: [
        {
          id: "dataset-1",
          workspace_id: w,
          name: "Synthetic Registry",
          description: "Metadata fixture only",
          classification: "Confidential",
          permission_status: "Pending",
          status: "Permission Pending",
          restricted: true,
          readers: [member],
          assignee_id: member,
          phase_id: "phase-1",
          retention_date: "2027-12-31",
          checkpoint_date: "2027-01-30",
          metadata: { custodian: "Fixture Custodian" },
          created_by: leader,
          updated_at: now,
        },
      ],
      rf_dataset_versions: [],
      rf_dataset_access_events: [],
      rf_github_repositories: [],
      rf_github_links: [],
      rf_notifications: [
        {
          id: "notification-1",
          workspace_id: w,
          user_id: user,
          category: "Tasks",
          message: "Tasks updated in your workspace",
          destination: "/tasks",
          read_at: null,
          created_at: now,
        },
      ],
      rf_notification_preferences: [],
      rf_tasks: [
        {
          id: "task-1",
          workspace_id: w,
          title: "Prepare methodology",
          description: "Fixture task",
          assignee_id: member,
          phase_id: "phase-1",
          status: "In Progress",
          priority: "Medium",
          due_date: "2027-01-28",
          archived: false,
          created_at: now,
          updated_at: now,
        },
      ],
      rf_research_phases: [
        {
          id: "phase-1",
          workspace_id: w,
          name: "Research Methods",
          status: "In Progress",
          review_state: "Not requested",
          position: 1,
          start_date: "2027-01-01",
          deadline: "2027-02-01",
        },
      ],
      rf_audit_events: [],
    };
    await page.routeWebSocket(/wss:\/\/.*\.supabase\.co\/.*/, (ws) =>
      ws.close(),
    );
    await page.addInitScript(
      ({ user }) =>
        localStorage.setItem(
          "sb-mephxqyntqqoxfnygavy-auth-token",
          JSON.stringify({
            access_token: "test.ui.contract",
            refresh_token: "fixture-refresh",
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: user,
              email: "research-test@example.invalid",
              aud: "authenticated",
              role: "authenticated",
              user_metadata: { full_name: "Test Researcher" },
            },
          }),
        ),
      { user },
    );
    let serial = 0;
    await page.route("https://*.supabase.co/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      let result: unknown = [];
      if (path.includes("/rpc/rf_operations")) {
        const { action, p } = req.postDataJSON();
        let id = p.id || `created-${++serial}`;
        if (action === "paper_save") {
          const record = {
            ...p,
            id,
            created_by: leader,
            created_at: now,
            abstract: p.abstract || "",
            keywords: p.keywords || "",
            authors: p.authors || [],
            venue: p.venue || "",
          };
          const existing = state.rf_papers.find((x) => x.id === p.id);
          if (existing) Object.assign(existing, record);
          else state.rf_papers.push(record);
        }
        if (action === "section_save")
          Object.assign(
            state.rf_paper_sections.find((s) => s.id === p.id)!,
            p,
          );
        if (action === "section_feedback") {
          state.rf_paper_feedback.push({
            ...p,
            id,
            author_id: user,
            created_at: now,
          });
          if (p.kind !== "Comment")
            state.rf_paper_sections.find((s) => s.id === p.section_id)!.status =
              p.kind;
        }
        if (action === "dataset_save")
          Object.assign(
            state.rf_datasets.find((s) => s.id === p.id)!,
            p,
          );
        if (action === "reference_save")
          for (const r of p.references)
            state.rf_references.push({
              ...r,
              id: `reference-${++serial}`,
              paper_id: p.paper_id,
            });
        if (action === "notifications_read")
          for (const n of state.rf_notifications)
            if (!p.id || n.id === p.id) n.read_at = now;
        if (action === "preference")
          state.rf_notification_preferences.push({ ...p, id });
        if (action === "repository_save")
          state.rf_github_repositories.push({ ...p, id });
        if (action === "github_link")
          state.rf_github_links.push({ ...p, id, created_at: now });
        id = String(id);
        result = { id };
      } else if (path.endsWith("/rf_workspaces")) result = [workspace];
      else if (path.endsWith("/rf_workspace_members")) result = members;
      else if (path.includes("/rest/v1/")) {
        const table = path.split("/").pop()!;
        result = state[table] || [];
      } else if (path.includes("/auth/v1/user"))
        result = {
          id: user,
          email: "research-test@example.invalid",
          user_metadata: {},
        };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });
    await page.goto("/papers");
    await expect(
      page.getByRole("heading", { name: "Test Paper", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Entered section notes")).toBeVisible();
    if (role === "leader") {
      await page
        .getByRole("button", { name: "New paper", exact: true })
        .click();
      await page
        .getByLabel("Paper title", { exact: true })
        .fill("Second research paper");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(state.rf_papers).toHaveLength(2);
    }
    if (role === "member") {
      await expect(
        page.getByRole("button", { name: "New paper", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Edit section", exact: true })
        .click();
      await page
        .getByLabel("Section notes", { exact: true })
        .fill("Revised assigned notes");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await expect(page.getByText("Revised assigned notes")).toBeVisible();
    }
    if (role === "supervisor") {
      await page
        .getByRole("button", { name: "Feedback & history", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Feedback type", exact: true })
        .selectOption("Approved");
      await page
        .getByLabel("Feedback", { exact: true })
        .fill("Synthetic UI review only");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(state.rf_paper_sections[0].status).toBe("Approved");
    }
    await page.goto("/datasets");
    await expect(
      page.getByRole("heading", { name: "Synthetic Registry", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Versions & governance", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Download link issuance history" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.goto("/notifications");
    await page
      .getByRole("button", { name: "Mark all as read", exact: true })
      .click();
    await expect(page.getByText("Read · Tasks", { exact: true })).toBeVisible();
    await page.goto("/analytics");
    await expect(
      page.getByRole("heading", { name: "Member workload", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
    await page.goto("/github");
    if (role === "leader") {
      await page
        .getByRole("button", { name: "Register repository", exact: true })
        .click();
      await page
        .getByLabel("Repository HTTPS URL")
        .fill("https://github.com/test/research");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      await page
        .getByRole("button", { name: "Link development work", exact: true })
        .click();
      await page
        .getByRole("combobox", { name: "Repository", exact: true })
        .selectOption(String(state.rf_github_repositories[0].id));
      await page
        .getByRole("combobox", { name: "Related task", exact: true })
        .selectOption("task-1");
      await page
        .getByLabel("GitHub link URL")
        .fill("https://github.com/test/research/issues/1");
      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toBeHidden();
      expect(state.rf_github_links).toHaveLength(1);
    }
    await page.goto("/timeline");
    await expect(
      page.getByRole("link", { name: "Test Paper", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (role === "leader" && testInfo.project.name === "desktop") {
      for (let i = 0; i < 80; i++)
        state.rf_paper_sections.push({
          id: `stress-${i}`,
          paper_id: "paper-1",
          workspace_id: w,
          title: `Outline section ${i}: ${"long text ".repeat(12)}`,
          position: i + 2,
          notes: "",
          assignees: [],
          deadline: null,
          status: "Not Started",
          version_id: null,
          task_id: null,
          updated_at: now,
        });
    }
    await page.goto("/reports");
    await page
      .getByRole("combobox", { name: "Report type", exact: true })
      .selectOption("Research Paper Completion Report");
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download PDF report", exact: true })
      .click();
    const pdf = await downloading;
    const pdfPath = await pdf.path();
    expect(pdfPath).toBeTruthy();
    const bytes = await readFile(pdfPath!);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(10000);
    if (role === "leader" && testInfo.project.name === "desktop") {
      await mkdir(".mvp3-test", { recursive: true });
      await copyFile(pdfPath!, ".mvp3-test/paper-report.pdf");
      await page.screenshot({
        path: ".mvp3-test/reports-desktop.png",
        fullPage: true,
      });
    }
    await expect(page.getByText("Micro Biz Tek")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
