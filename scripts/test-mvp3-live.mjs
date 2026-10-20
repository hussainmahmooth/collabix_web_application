// Disposable confirmed identities only. No email is sent and no privileged key is used.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const file = ".mvp3-test/fixtures.json",
  f = JSON.parse(readFileSync(file, "utf8"));
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim()];
    }),
);
const clients = {};
const ok = (r) => {
  if (r.error) throw Error(r.error.message);
  return r.data;
};
const save = () => writeFileSync(file, JSON.stringify(f));
let channel;
try {
  for (const u of f.users) {
    const c = createClient(
      env.VITE_SUPABASE_URL,
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    ok(
      await c.auth.signInWithPassword({ email: u.email, password: f.password }),
    );
    clients[u.role] = c;
  }
  const { leader, reader, outsider } = clients;
  if (process.argv.includes("--cleanup-files")) {
    for (const upload of f.uploads || []) {
      const removed = ok(
        await leader.storage.from("researchflow-datasets").remove([upload]),
      );
      assert.ok(
        removed?.length,
        "No objects removed: dataset client reads are disabled; use privileged Storage API cleanup for these disposable bytes",
      );
    }
    console.log("PASS: disposable dataset bytes removed");
  } else {
    const w = ok(
      await leader.rpc("rf_create_workspace", {
        team_name: "MVP3 disposable verification",
        title: "Synthetic integration test",
        full_name: "MVP3 Fixture",
      }),
    );
    f.workspaces = [w];
    save();
    const invitation = ok(
      await leader
        .from("rf_workspace_invitations")
        .insert({
          workspace_id: w,
          email: f.users.find((u) => u.role === "reader").email,
          role: "member",
        })
        .select()
        .single(),
    );
    ok(
      await reader.rpc("rf_accept_invitation", {
        invite_token: invitation.token,
        full_name: "MVP3 reader",
      }),
    );
    const act = async (c, action, p) =>
      ok(await c.rpc("rf_operations", { action, p: { workspace_id: w, ...p } }))
        .id;
    let eventResolve;
    const event = new Promise((resolve) => {
      eventResolve = resolve;
    });
    let readyResolve;
    const ready = new Promise((resolve) => {
      readyResolve = resolve;
    });
    channel = reader
      .channel("mvp3-notifications-" + randomUUID())
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rf_notifications",
          filter: `workspace_id=eq.${w}`,
        },
        () => eventResolve(true),
      )
      .on("system", "*", (p) => {
        if (p.extension === "postgres_changes" && p.status === "ok")
          readyResolve(true);
      })
      .subscribe();
    const timeout = (promise, label) =>
      Promise.race([
        promise,
        new Promise((_, reject) => {
          const timer = setTimeout(
            () => reject(Error(label + " timed out")),
            20000,
          );
          timer.unref();
        }),
      ]);
    await timeout(ready, "Realtime readiness");
    ok(
      await leader.from("rf_tasks").insert({
        workspace_id: w,
        title: "Synthetic assignment",
        assignee_id: f.users.find((u) => u.role === "reader").id,
      }),
    );
    await timeout(event, "Realtime notification");
    const d = await act(leader, "dataset_save", {
      name: "Synthetic private test data",
      classification: "Confidential",
      permission_status: "Granted",
      status: "Collected",
      restricted: true,
      readers: [f.users.find((u) => u.role === "reader").id],
      metadata: {
        permission_evidence: "Synthetic test fixture only",
        usage_scope: "Automated verification",
      },
    });
    const path = `${w}/${d}/${f.users.find((u) => u.role === "leader").id}/${randomUUID()}.csv`;
    ok(
      await leader.storage
        .from("researchflow-datasets")
        .upload(path, new Blob(["day,value\n1,2\n"], { type: "text/csv" }), {
          contentType: "text/csv",
        }),
    );
    f.uploads = [path];
    save();
    const id = await act(leader, "dataset_version", {
      dataset_id: d,
      kind: "Dataset",
      path,
      name: "synthetic.csv",
    });
    assert.ok(
      (
        await reader.storage
          .from("researchflow-datasets")
          .createSignedUrl(path, 3600)
      ).error,
      "browser cannot sign longer dataset link",
    );
    assert.ok(
      (
        await outsider.functions.invoke("rf-dataset-download", {
          body: { workspace_id: w, id },
        })
      ).error,
      "outsider denied",
    );
    const response = ok(
      await reader.functions.invoke("rf-dataset-download", {
        body: { workspace_id: w, id },
      }),
    );
    assert.equal(response.expires_in, 60);
    const parsed = new URL(response.url);
    const payload = JSON.parse(
      Buffer.from(
        parsed.searchParams.get("token").split(".")[1],
        "base64url",
      ).toString(),
    );
    assert.equal(payload.exp - payload.iat, 60);
    const bytes = await fetch(response.url);
    assert.equal(await bytes.text(), "day,value\n1,2\n");
    assert.equal(
      ok(
        await reader
          .from("rf_dataset_access_events")
          .select()
          .eq("workspace_id", w),
      ).length,
      1,
    );
    const dataset = ok(
      await leader.from("rf_datasets").select().eq("id", d).single(),
    );
    await act(leader, "dataset_save", { ...dataset, readers: [] });
    assert.ok(
      (
        await reader.functions.invoke("rf-dataset-download", {
          body: { workspace_id: w, id },
        })
      ).error,
      "revoked reader denied",
    );
    assert.equal(
      ok(await reader.from("rf_datasets").select().eq("id", d)).length,
      0,
    );
    const anonymous = await fetch(
      env.VITE_SUPABASE_URL + "/functions/v1/rf-dataset-download",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ workspace_id: w, id }),
      },
    );
    assert.equal(anonymous.status, 401);
    console.log(
      "PASS: real password authentication, persisted dataset/ACL/version, Realtime notification, denied direct signing/outsider/anonymous/revoked access, server-enforced 60-second signed download, exact uploaded bytes and audited issuance",
    );
  }
} finally {
  if (channel) await clients.reader.removeChannel(channel);
  for (const c of Object.values(clients)) await c.auth.signOut();
}
