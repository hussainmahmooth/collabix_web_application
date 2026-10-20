// Requires disposable, confirmed test identities provisioned by the SQL test harness.
// Uses only the public publishable key and each test user's password. Sends no emails.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const fixturePath = process.argv[2] || ".mvp2-test/fixtures.json";
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((x) => x.includes("="))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).trim()];
    }),
);
const clients = {};
const persist = () => writeFileSync(fixturePath, JSON.stringify(fixture));
function ok(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function login(role) {
  const u = fixture.users.find((u) => u.role === role);
  const c = createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  ok(
    await c.auth.signInWithPassword({
      email: u.email,
      password: fixture.password,
    }),
  );
  clients[role] = c;
  return c;
}
let receiver;
try {
  const leader = await login("leader"),
    reader = await login("reader"),
    outsider = await login("outsider");
  if (process.argv.includes("--cleanup-files")) {
    for (const item of fixture.uploads || []) {
      const c = clients[item.role];
      ok(await c.storage.from("researchflow-files").remove([item.path]));
    }
    console.log("PASS: disposable file bytes removed through Storage API");
  } else {
    const w = ok(
      await leader.rpc("rf_create_workspace", {
        team_name: "MVP2 disposable integration",
        title: "Live Storage and Realtime verification",
        full_name: "MVP2 test leader",
      }),
    );
    fixture.workspaces = [...(fixture.workspaces || []), w];
    persist();
    const act = async (c, action, p) =>
      ok(
        await c.rpc("rf_collaborate", { action, p: { ...p, workspace_id: w } }),
      ).id;
    const invitation = ok(
      await leader
        .from("rf_workspace_invitations")
        .insert({
          workspace_id: w,
          email: fixture.users.find((u) => u.role === "reader").email,
          role: "member",
        })
        .select()
        .single(),
    );
    ok(
      await reader.rpc("rf_accept_invitation", {
        invite_token: invitation.token,
        full_name: "MVP2 test reader",
      }),
    );
    const channels = ok(
      await leader.from("rf_channels").select().eq("workspace_id", w),
    );
    assert.equal(channels.length, 7);
    assert.equal(
      ok(await outsider.from("rf_channels").select().eq("workspace_id", w))
        .length,
      0,
    );
    const channel = channels[0].id;
    let resolveEvent;
    const event = new Promise((resolve) => {
      resolveEvent = resolve;
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Realtime replication readiness timeout")),
        40000,
      );
      receiver = reader
        .channel(`mvp2-integration-${randomUUID()}`)
        .on("system", "*", (payload) => {
          if (
            payload.extension === "postgres_changes" &&
            payload.status === "ok"
          ) {
            clearTimeout(timer);
            resolve();
          } else if (payload.status === "error") {
            clearTimeout(timer);
            reject(new Error(`Realtime system error: ${payload.message}`));
          }
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "rf_messages",
            filter: `workspace_id=eq.${w}`,
          },
          (payload) => resolveEvent(payload),
        );
      receiver.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timer);
          reject(new Error("Realtime subscription rejected"));
        }
      });
    });
    const message = await act(leader, "message_send", {
      channel_id: channel,
      body: "Live persisted Realtime verification",
    });
    const change = await Promise.race([
      event,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Realtime message timeout")), 20000),
      ),
    ]);
    assert.equal(change.new.id, message);
    assert.equal(
      ok(await reader.from("rf_messages").select().eq("id", message)).length,
      1,
    );
    assert.equal(
      ok(await outsider.from("rf_messages").select().eq("id", message)).length,
      0,
    );
    const folder = ok(
      await leader
        .from("rf_document_folders")
        .select()
        .eq("workspace_id", w)
        .limit(1),
    )[0].id;
    const doc = await act(leader, "document_create", {
      folder_id: folder,
      title: "Private integration document",
      restricted: true,
    });
    async function upload(c, role, name, text) {
      const path = `${w}/${fixture.users.find((u) => u.role === role).id}/${randomUUID()}.txt`;
      ok(
        await c.storage
          .from("researchflow-files")
          .upload(path, new Blob([text], { type: "text/plain" }), {
            contentType: "text/plain",
          }),
      );
      fixture.uploads = [...(fixture.uploads || []), { role, path }];
      persist();
      return {
        path,
        id: await act(c, "file_register", { document_id: doc, path, name }),
      };
    }
    const first = await upload(
      leader,
      "leader",
      "first.txt",
      "First private version",
    );
    assert.equal(
      ok(await reader.from("rf_documents").select().eq("id", doc)).length,
      0,
    );
    assert.ok(
      (
        await reader.storage
          .from("researchflow-files")
          .createSignedUrl(first.path, 60)
      ).error,
    );
    await act(leader, "document_access", {
      id: doc,
      restricted: true,
      readers: [fixture.users.find((u) => u.role === "reader").id],
    });
    const link = ok(
      await reader.storage
        .from("researchflow-files")
        .createSignedUrl(first.path, 60),
    );
    const response = await fetch(link.signedUrl);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "First private version");
    await upload(reader, "reader", "second.txt", "Second private version");
    const versions = ok(
      await reader
        .from("rf_document_versions")
        .select()
        .eq("document_id", doc)
        .order("version"),
    );
    assert.deepEqual(
      versions.map((v) => v.version),
      [1, 2],
    );
    assert.ok(
      (
        await outsider.storage
          .from("researchflow-files")
          .createSignedUrl(first.path, 60)
      ).error,
    );
    await act(leader, "document_access", {
      id: doc,
      restricted: true,
      readers: [],
    });
    assert.equal(
      ok(
        await reader
          .from("rf_document_versions")
          .select()
          .eq("document_id", doc),
      ).length,
      0,
    );
    assert.ok(
      (
        await reader.storage
          .from("researchflow-files")
          .createSignedUrl(first.path, 60)
      ).error,
    );
    assert.ok(
      (
        await outsider.rpc("rf_collaborate", {
          action: "message_send",
          p: { workspace_id: w, channel_id: channel, body: "Unauthorized" },
        })
      ).error,
    );
    console.log(
      "PASS: actual password sign-in, workspace isolation, Realtime INSERT delivery, message persistence, private Storage upload/download, immutable versions, restricted readers and access revocation",
    );
  }
} finally {
  if (receiver && clients.reader) await clients.reader.removeChannel(receiver);
  await Promise.all(
    Object.values(clients).map((c) => c.auth.signOut({ scope: "local" })),
  );
}
