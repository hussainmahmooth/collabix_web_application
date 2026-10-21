// Read-only public deployment checks. Run after the matching production build.
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.argv[2] || "https://researchflow-collabix.pages.dev";
assert.equal(new URL(origin).protocol, "https:");
const local = await readFile("dist/index.html", "utf8");
const entry = local.match(/src="([^"]+\.js)"/)?.[1];
assert.ok(entry, "Local build entry missing");
for (const name of await readdir("dist/assets")) {
  if (!name.endsWith(".js")) continue;
  const content = await readFile(`dist/assets/${name}`, "utf8");
  assert.ok(!/sb_secret_[A-Za-z0-9_-]+/.test(content), `Secret key in ${name}`);
  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try { assert.notEqual(JSON.parse(Buffer.from(token.split(".")[1], "base64url")).role, "service_role", `Service token in ${name}`); }
    catch (e) { if (e.code === "ERR_ASSERTION") throw e; }
  }
}
const results = [];
for (const path of ["/", "/login", "/register", "/reset-password", "/dashboard", "/tasks", "/phases", "/team", "/settings", "/discussions", "/documents", "/meetings", "/reviews", "/announcements", "/papers", "/datasets", "/notifications", "/analytics", "/reports", "/github", "/timeline"]) {
  const started = performance.now();
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  assert.equal(response.status, 200, path);
  assert.ok(html.includes(entry), `Different deployment at ${path}`);
  assert.ok(response.headers.get("content-security-policy")?.includes("object-src 'none'"), `CSP missing at ${path}`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  assert.equal(response.headers.get("x-frame-options"), "DENY", path);
  results.push({ path, status: response.status, elapsedMs: Math.round(performance.now() - started) });
}
await mkdir("test-results", { recursive: true });
const report = { checkedAt: new Date().toISOString(), origin, entry, bundleSecretScan: "passed", routes: results };
await writeFile("test-results/production-release.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
