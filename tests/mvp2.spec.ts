import { test, expect } from "@playwright/test";
test.setTimeout(120000);
for (const role of ["leader", "member", "supervisor"])
  test(`MVP2 ${role} collaboration workflows`, async ({ page }) => {
    const user = "11111111-1111-4111-8111-111111111111",
      w = "22222222-2222-4222-8222-222222222222";
    const other = "99999999-9999-4999-8999-999999999999";
    const workspace = {
      id: w,
      name: "Collaboration Lab",
      research_title: "Secure collaborative research",
      created_by: role === "leader" ? user : other,
      accent_color: "#168e88",
      logo_path: null,
    };
    const members = [
      {
        user_id: user,
        role,
        responsibilities: "",
        rf_profiles: { full_name: "Test Researcher", skills: "Research" },
      },
      {
        user_id: other,
        role: role === "leader" ? "supervisor" : "leader",
        responsibilities: "",
        rf_profiles: { full_name: "Other Researcher", skills: "Review" },
      },
    ];
    const state: Record<string, Record<string, unknown>[]> = {
      rf_channels: [
        {
          id: "channel-1",
          workspace_id: w,
          name: "General Discussion",
          archived: false,
        },
      ],
      rf_document_folders: [
        { id: "folder-1", workspace_id: w, name: "Research Proposal" },
      ],
      rf_messages: [],
      rf_documents: [],
      rf_files: [],
      rf_document_versions: [],
      rf_document_comments: [],
      rf_document_access: [],
      rf_meetings: [],
      rf_meeting_participants: [],
      rf_meeting_notes: [],
      rf_meeting_actions: [],
      rf_submissions: [],
      rf_reviews: [],
      rf_announcements: [],
      rf_announcement_reads: [],
      rf_channel_unread: [],
      rf_audit_events: [],
    };
    let serial = 0;
    const record = (table: string, fields: Record<string, unknown>) => {
      const x = {
        workspace_id: w,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...fields,
        id: `fixture-${++serial}`,
      };
      state[table].push(x);
      return x.id;
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
            refresh_token: "test-refresh",
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: user,
              email: "ui-test@example.invalid",
              aud: "authenticated",
              role: "authenticated",
              user_metadata: { full_name: "Test Researcher" },
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
      if (path.includes("/rpc/rf_collaborate")) {
        const { action, p } = req.postDataJSON();
        let id = p.id;
        const find = (table: string) =>
          state[table].find((x) => x.id === p.id)!;
        if (action === "channel_save") {
          if (id) Object.assign(find("rf_channels"), p);
          else id = record("rf_channels", { name: p.name, archived: false });
        }
        if (action === "message_send")
          id = record("rf_messages", {
            channel_id: p.channel_id,
            body: p.body,
            author_id: user,
            reply_to: p.reply_to,
            deleted: false,
          });
        if (action === "message_edit")
          Object.assign(find("rf_messages"), { body: p.body });
        if (action === "message_delete")
          Object.assign(find("rf_messages"), { body: "", deleted: true });
        if (action === "document_create")
          id = record("rf_documents", {
            ...p,
            created_by: user,
            archived: false,
          });
        if (action === "file_register") {
          const file = record("rf_files", {
            path: p.path,
            name: p.name,
            mime: "text/plain",
            bytes: 20,
            owner_id: user,
            document_id: p.document_id || null,
            message_id: p.message_id || null,
            announcement_id: p.announcement_id || null,
          });
          id = p.document_id
            ? record("rf_document_versions", {
                document_id: p.document_id,
                file_id: file,
                version:
                  state.rf_document_versions.filter(
                    (v) => v.document_id === p.document_id,
                  ).length + 1,
                notes: p.notes || "",
                author_id: user,
              })
            : file;
        }
        if (action === "document_access") {
          Object.assign(find("rf_documents"), { restricted: p.restricted });
          state.rf_document_access = p.readers.map((user_id: string) => ({
            document_id: p.id,
            user_id,
          }));
        }
        if (action === "document_comment")
          id = record("rf_document_comments", { ...p, author_id: user });
        if (action === "review_request")
          id = record("rf_submissions", {
            ...p,
            requested_by: user,
            status: "Submitted for Review",
            internal_status: "Submitted for Review",
          });
        if (action === "review_decide") {
          id = record("rf_reviews", { ...p, reviewer_id: user });
          const s = state.rf_submissions.find((s) => s.id === p.submission_id)!;
          s[p.kind === "Academic" ? "status" : "internal_status"] = p.decision;
        }
        if (action === "meeting_save") {
          id = record("rf_meetings", {
            ...p,
            organizer_id: user,
            cancelled: false,
          });
          state.rf_meeting_participants.push(
            ...p.participants.map((user_id: string) => ({
              meeting_id: id,
              user_id,
            })),
          );
        }
        if (action === "meeting_note")
          id = record("rf_meeting_notes", { ...p, author_id: user });
        if (action === "meeting_action")
          id = record("rf_meeting_actions", { ...p, task_id: null });
        if (action === "action_convert") {
          find("rf_meeting_actions").task_id = "task-1";
          id = "task-1";
        }
        if (action === "announcement_save")
          id = record("rf_announcements", {
            ...p,
            author_id: user,
            archived: false,
          });
        if (action === "announcement_read")
          state.rf_announcement_reads.push({ announcement_id: p.id });
        result = { id: id || "fixture-ok" };
      } else if (path.includes("/storage/v1/object/sign/"))
        result = {
          signedURL:
            "/object/sign/researchflow-files/fixture.txt?token=fixture",
        };
      else if (path.includes("/storage/v1/object/"))
        result = { Key: "fixture" };
      else if (path.includes("/rf_workspace_members")) result = members;
      else if (path.includes("/rf_workspaces")) result = [workspace];
      else if (path.includes("/rf_research_phases"))
        result = [
          {
            id: "phase-1",
            workspace_id: w,
            name: "Research Foundation",
            status: "In Progress",
            review_state: "Not requested",
            position: 0,
          },
        ];
      else if (path.includes("/auth/v1/user")) result = { id: user };
      else {
        const table = path.split("/").pop() || "";
        result = state[table] || [];
        if (table === "rf_messages") result = [...state.rf_messages].reverse();
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });
    async function navigate(name: string) {
      if (test.info().project.name === "mobile")
        await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name, exact: true }).first().click();
    }
    async function snapshot(view: string) {
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`test-results/mvp2-${view}-${role}-${test.info().project.name}.png`,fullPage:true});
    }
    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { name: "Research documents", exact: true }),
    ).toBeVisible();
    if (role === "supervisor") {
      await expect(
        page.getByRole("button", { name: "Upload document", exact: true }),
      ).toHaveCount(0);
      state.rf_submissions.push({
        id: "submission-1",
        workspace_id: w,
        phase_id: "phase-1",
        version_id: null,
        requested_by: other,
        status: "Submitted for Review",
        internal_status: "Submitted for Review",
        created_at: new Date().toISOString(),
      });
      await navigate("Supervisor Reviews");
      await expect(
        page.getByRole("heading", { name: "Academic supervisor portal" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Open submission" }).click();
      await page
        .getByLabel("Written feedback")
        .fill("Good work; academic approval recorded.");
      await page.getByRole("button", { name: "Record review" }).click();
      await expect(
        page
          .getByRole("dialog")
          .getByText("Good work; academic approval recorded.", { exact: true }),
      ).toBeVisible();
      expect(state.rf_reviews[0].kind).toBe("Academic");
      await snapshot('review');
      await page.getByRole("button", { name: "Close dialog" }).click();
    } else {
      await page
        .getByRole("button", { name: "Upload document", exact: true })
        .click();
      await page.getByLabel("Document title").fill("Research proposal");
      await page
        .getByRole("dialog")
        .getByRole("combobox", { name: "Folder", exact: true })
        .selectOption("folder-1");
      await page
        .getByLabel("File", { exact: true })
        .setInputFiles({
          name: "proposal.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Research proposal text"),
        });
      await page
        .getByRole("button", { name: "Upload document", exact: true })
        .last()
        .click();
      await expect(
        page.getByRole("heading", { name: "Version history" }),
      ).toBeVisible();
      await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
      await page
        .getByLabel("New version file")
        .setInputFiles({
          name: "proposal-v2.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Revised research proposal"),
        });
      await page.getByRole("button", { name: "Upload new version" }).click();
      await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
      expect(state.rf_document_versions).toHaveLength(2);
      await page
        .getByRole("button", { name: "Submit version 2 for review" })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByText(
            "Academic: Submitted for Review · Internal: Submitted for Review",
            { exact: true },
          ),
      ).toBeVisible();
      await page.getByRole("button", { name: "Close dialog" }).click();
      await snapshot('documents');
      await navigate("Meetings");
      await page.getByRole("button", { name: "Schedule meeting" }).click();
      await page.getByLabel("Meeting title").fill("Research planning");
      await page.getByLabel("IANA timezone").fill("Asia/Colombo");
      await page.getByLabel("Start", { exact: true }).fill("2027-01-02T10:00");
      await page.getByLabel("End", { exact: true }).fill("2027-01-02T11:00");
      await page.getByRole("button", { name: "Save meeting" }).click();
      expect(state.rf_meetings[0].starts_at).toBe("2027-01-02T04:30:00.000Z");
      await page.getByRole("button", { name: "Meeting details" }).click();
      await page.getByLabel("Record type").selectOption("Minutes");
      await page
        .getByLabel("Meeting note")
        .fill("Agreed to compare two research methods.");
      await page.getByRole("button", { name: "Add meeting record" }).click();
      await expect(
        page.getByText("Agreed to compare two research methods.", {
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByLabel("Action item", { exact: true })
        .fill("Compare methods");
      await page.getByLabel("Action deadline").fill("2027-01-10");
      await page.getByRole("button", { name: "Add action item" }).click();
      if (role === "leader") {
        await page.getByRole("button", { name: "Convert to task" }).click();
        await expect(
          page.getByRole("link", { name: "Open in tasks" }),
        ).toBeVisible();
      } else
        await expect(
          page.getByRole("button", { name: "Convert to task" }),
        ).toHaveCount(0);
      await snapshot('meetings');
      await page.getByRole("button", { name: "Close dialog" }).click();
    }
    await navigate("Discussions");
    await expect(
      page.getByRole("heading", { name: "General Discussion", exact: true }),
    ).toBeVisible();
    if (role === "leader") {
      await page.getByRole("button", { name: "Create channel" }).click();
      await page.getByLabel("Channel name").fill("Experiment planning");
      await page.getByRole("button", { name: "Save channel" }).click();
      await expect(
        page.getByRole("button", { name: "Experiment planning" }),
      ).toBeVisible();
    } else
      await expect(
        page.getByRole("button", { name: "Create channel" }),
      ).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("A persisted research discussion");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText("A persisted research discussion", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("An edited research discussion");
    await page.getByRole("button", { name: "Save message" }).click();
    await expect(
      page.getByText("An edited research discussion", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("A threaded reply");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByText("A threaded reply", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Delete message", exact: true })
      .click();
    await expect(
      page.getByText("Message deleted", { exact: true }).first(),
    ).toBeVisible();
    await snapshot('discussions');
    await navigate("Announcements");
    if (role === "leader") {
      await page.getByRole("button", { name: "Publish announcement" }).click();
      await page.getByLabel("Announcement title").fill("Research deadline");
      await page
        .getByLabel("Announcement content")
        .fill("Please submit your version for supervisor review.");
      await page.getByLabel("Pin announcement").check();
      await page.getByRole("button", { name: "Save announcement" }).click();
      await expect(
        page.getByRole("heading", { name: "Research deadline", exact: true }),
      ).toBeVisible();
      expect(state.rf_announcements[0].pinned).toBe(true);
    } else
      await expect(
        page.getByRole("button", { name: "Publish announcement" }),
      ).toHaveCount(0);
    await snapshot('announcements');
    await navigate("Activity history");
    await expect(
      page.getByRole("heading", { name: "Activity history", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByText("Micro Biz Tek", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/mvp2-${role}-${test.info().project.name}.png`,
      fullPage: true,
    });
  });
