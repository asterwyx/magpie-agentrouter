// Optional integration test against a separately started Magpie + fake
// AgentRouter sandbox. Never run it against the user's production instance.
import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const url = process.env.MAGPIE_TEST_WEB_URL;
test("Magpie UI offers site buttons and four separate credential fields without browser authorization", { skip: !url }, async () => {
  const base = new URL(url);
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "UI tests require an isolated loopback sandbox");
  const module = process.env.PLAYWRIGHT_MODULE;
  assert.ok(module, "Set PLAYWRIGHT_MODULE to an externally installed playwright-core entry");
  const { chromium } = await import(pathToFileURL(module).href);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    let popups = 0;
    context.on("page", p => { if (p !== page) popups++; });
    const posts = [];
    page.on("request", r => { if (r.method() === "POST") posts.push(new URL(r.url()).pathname); });
    base.searchParams.set("k", process.env.MAGPIE_TEST_WEB_KEY || "");
    await page.goto(base.href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "AgentRouter", exact: true }).click();
    await page.getByRole("button", { name: "AgentRouter 国际站", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "AgentRouter 国内站", exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "AgentRouter 国际站", exact: true }).click();
    const fields = [
      ["AgentRouter 账号", "fixture-user", "text"],
      ["AgentRouter 密码（用于登录签到）", "fixture-password", "password"],
      ["API Key（用于模型列表和模型调用）", "sk-fixture-model", "password"],
      ["系统访问令牌（用于查询余额；不是 API Key）", "fixture-management", "password"],
    ];
    let completion;
    for (const [index, [label, value, type]] of fields.entries()) {
      const field = page.getByLabel(label, { exact: true });
      await field.waitFor({ state: "visible" });
      assert.equal(await field.getAttribute("type"), type);
      await field.fill(value);
      const completed = index === fields.length - 1
        ? page.waitForResponse(r => new URL(r.url()).pathname === "/api/plugin-signin" && r.request().method() === "POST")
        : null;
      await page.getByRole("button", { name: "Next", exact: true }).click();
      if (completed) {
        const response = await completed;
        const responseText = await response.text();
        assert.equal(response.status(), 200, responseText.slice(0, 500));
        completion = JSON.parse(responseText);
      }
    }
    await page.waitForFunction(() => !document.querySelector(".signing"));
    assert.equal(completion.state, "done");
    assert.equal(popups, 0);
    assert.equal(context.pages().length, 1);
    assert.equal(posts.filter(p => p === "/api/plugin-signin").length, 1);
    assert.equal(posts.some(p => /(oauth|authorize|callback|\/open)$/.test(p)), false);
    assert.equal(await page.getByRole("button", { name: "Next", exact: true }).count(), 0);
    if (process.env.MAGPIE_TEST_SCREENSHOT) await page.screenshot({ path: process.env.MAGPIE_TEST_SCREENSHOT, fullPage: true });
  } finally { await browser.close(); }
});
