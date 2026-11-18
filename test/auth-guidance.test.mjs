import assert from "node:assert/strict";
import test from "node:test";
import plugin from "../src/index.mjs";
import { ACCOUNT_PROMPTS } from "../src/account.mjs";

const inputs = { username: "fixture-user", password: " fixture-password ", apiKey: "sk-fixture", accessToken: "fixture-token" };
const login = (data = { id: 42, checked_in: true }) => Response.json({ success: true, data });
const user = (data = { id: 42, quota: 1, used_quota: 2 }) => Response.json({ success: true, data });
async function stub(t, responses) {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    assert.ok(responses.length, "unexpected network call");
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, methods: (await plugin({ magpie: {} })).auth.methods };
}

test("the four credentials are four separate validated fields", () => {
  assert.deepEqual(ACCOUNT_PROMPTS.map(p => p.key), ["username", "password", "apiKey", "accessToken"]);
  assert.deepEqual(ACCOUNT_PROMPTS.map(p => p.type), ["text", "password", "password", "password"]);
  for (const prompt of ACCOUNT_PROMPTS) {
    assert.equal(prompt.validate("valid-value"), undefined);
    assert.equal(typeof prompt.validate(""), "string");
  }
  assert.equal(ACCOUNT_PROMPTS[2].validate(" "), "请输入完整的模型 API Key");
  assert.equal(ACCOUNT_PROMPTS[2].validate("not a key with spaces"), "请输入完整的模型 API Key");
  assert.equal(ACCOUNT_PROMPTS[3].validate("has space"), "请输入有效的系统访问令牌");
});

for (const key of Object.keys(inputs)) test("missing or invalid " + key + " fails before network", async t => {
  const { calls, methods } = await stub(t, []);
  for (const value of [undefined, null, "", "   ", {}, [], 42, "x\r\ninjection"]) {
    const result = await methods[0].authorize({ ...inputs, [key]: value });
    assert.equal(result.type, "failed");
    assert.equal(result.key, undefined);
    assert.equal(result.callback, undefined);
  }
  assert.equal(calls.length, 0);
});

test("API key and management token cannot be the same input", async t => {
  const { calls, methods } = await stub(t, []);
  assert.equal((await methods[0].authorize({ ...inputs, accessToken: inputs.apiKey })).type, "failed");
  assert.equal(calls.length, 0);
});

for (const [name, responses] of [
  ["wrong password", [Response.json({ success: false, message: inputs.password })]],
  ["missing identity", [login({ checked_in: true })]],
  ["two-factor challenge", [login({ require_2fa: true })]],
  ["redirect", [new Response(null, { status: 307, headers: { location: "https://foreign.test" } })]],
  ["non-success JSON with identity", [new Response(JSON.stringify({ success: true, data: { id: 42 } }), { status: 500 })]],
  ["missing success flag", [Response.json({ data: { id: 42 } })]],
  ["login captcha", [new Response("<html>" + inputs.password)]],
  ["network failure", [new Error(inputs.password)]],
  ["oversized reply", [new Response("x".repeat(64 * 1024 + 1))]],
  ["token rejected", [login(), Response.json({ success: false, message: inputs.accessToken })]],
  ["wrong token account", [login(), user({ id: 99, quota: 1, used_quota: 1 })]],
  ["token captcha", [login(), new Response("<html>" + inputs.accessToken)]],
]) test(name + " does not save credentials or offer a browser flow", async t => {
  const { methods } = await stub(t, responses);
  const result = await methods[0].authorize(inputs);
  assert.equal(result.type, "failed");
  assert.equal(result.key, undefined);
  assert.equal(result.metadata, undefined);
  assert.equal(result.url, undefined);
  assert.equal(result.callback, undefined);
  for (const secret of Object.values(inputs)) assert.equal(result.error.includes(secret), false);
});

test("valid fields preserve password whitespace and store each secret in its intended place", async t => {
  const { methods, calls } = await stub(t, [login(), user()]);
  const result = await methods[0].authorize(inputs);
  assert.equal(result.type, "success");
  assert.equal(JSON.parse(calls[0].init.body).password, inputs.password);
  assert.equal(result.key, inputs.apiKey);
  assert.equal(result.metadata.username, inputs.username);
  assert.equal(result.metadata.password, inputs.password);
  assert.equal(result.metadata.accessToken, inputs.accessToken);
  assert.equal(result.metadata.cookie, undefined);
});

test("a missing quota record does not fabricate balance or reject an identity-verified token", async t => {
  const { methods } = await stub(t, [login(), user({ id: 42 })]);
  assert.equal((await methods[0].authorize(inputs)).type, "success");
});

test("cancelled authorization makes no request", async t => {
  const { methods, calls } = await stub(t, []);
  const controller = new AbortController();
  controller.abort();
  const result = await methods[0].authorize(inputs, { signal: controller.signal });
  assert.equal(result.type, "failed");
  assert.equal(calls.length, 0);
});
