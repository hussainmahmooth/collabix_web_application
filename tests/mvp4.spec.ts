import { test, expect } from "@playwright/test";

for (const width of [360, 768, 1366, 1920]) {
  test(`release layout at ${width}px with a long workspace name`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = "11111111-1111-4111-8111-111111111111";
    const workspace = "22222222-2222-4222-8222-222222222222";
    await page.addInitScript(({ user }) => {
      localStorage.setItem("sb-mephxqyntqqoxfnygavy-auth-token", JSON.stringify({
        access_token: "test.ui.contract", refresh_token: "test-refresh",
        token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: user, email: "release@example.invalid", user_metadata: { full_name: "Release Researcher" } },
      }));
    }, { user });
    await page.route("https://*.supabase.co/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let data: unknown = [];
      if (path.endsWith("/rf_workspaces")) data = [{
        id: workspace, name: "University interdisciplinary research collaboration workspace with a very long team name",
        research_title: "Research production acceptance", created_by: user,
        accent_color: "#168e88", logo_path: null,
      }];
      if (path.endsWith("/rf_workspace_members")) data = [{ user_id: user, role: "leader", responsibilities: "", rf_profiles: { full_name: "Release Researcher", skills: "" } }];
      if (path.endsWith("/user")) data = { id: user, email: "release@example.invalid" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    for (const route of ["dashboard", "tasks", "documents", "discussions", "analytics", "reports"]) {
      await page.goto(`/${route}`);
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByText("Micro Biz Tek").last()).toBeVisible();
      await expect(page.getByText("ResearchFlow needs to reload")).toHaveCount(0);
      const layout = await page.evaluate(() => ({
        width: window.innerWidth, scroll: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll("main *, header *, footer *")]
          .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1)
          .map(e => `${e.tagName}.${e.className}`).slice(0, 12),
      }));
      expect(layout.scroll, `${route}: ${JSON.stringify(layout)}`).toBeLessThanOrEqual(layout.width);
    }
    await page.screenshot({ path: `test-results/release-${width}-${test.info().project.name}.png`, fullPage: true });
  });
}
