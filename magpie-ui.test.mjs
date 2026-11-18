// Optional integration test against a separately started Magpie + fake
// AgentRouter sandbox. Never run it against the user's production instance.
import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";

const url = process.env.MAGPIE_TEST_WEB_URL;
test("Magpie UI offers site buttons and submits all four credentials in one masked prompt", { skip: !url }, async () => {
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
    const bundle = JSON.stringify({ username: "fixture-user", password: "fixture-password", apiKey: "sk-fixture-model", accessToken: "fixture-management" });
    const field = page.locator("input[type=password]:visible").last();
    await field.waitFor({ state: "visible" });
    assert.equal(await field.getAttribute("aria-label"), "一次提交四项凭据 JSON（账号、密码、API Key、系统访问令牌；整体遮蔽）");
    assert.equal(await field.getAttribute("type"), "password");
    await field.fill(bundle);
    const completed = page.waitForResponse(r => new URL(r.url()).pathname === "/api/plugin-signin" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    const response = await completed;
    const responseText = await response.text();
    assert.equal(response.status(), 200, responseText.slice(0, 500));
    const completion = JSON.parse(responseText);
    await page.waitForFunction(() => !document.querySelector(".signing"));
    assert.equal(completion.state, "done");
    assert.equal(popups, 0);
    assert.equal(context.pages().length, 1);
    assert.equal(posts.filter(p => p === "/api/plugin-signin").length, 1);
    assert.equal(posts.some(p => /oauth|authorize|callback|\/open$/.test(p)), false);
    assert.equal(await page.getByRole("button", { name: "Next", exact: true }).count(), 0);
    if (process.env.MAGPIE_TEST_SCREENSHOT) await page.screenshot({ path: process.env.MAGPIE_TEST_SCREENSHOT, fullPage: true });
  } finally { await browser.close(); }
});
