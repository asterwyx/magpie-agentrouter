import assert from "node:assert/strict";
import test from "node:test";
import plugin from "./index.mjs";
import { CREDENTIAL_PROMPT, parseCredentialBundle } from "./account.mjs";

const credentials = { username: "fixture-user", password: " fixture-password ", apiKey: "sk-fixture", accessToken: "fixture-token" };
const packed = JSON.stringify(credentials);
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

for (const [label, value] of [
  ["empty", ""], ["invalid JSON", "not-json"], ["wrong type", []], ["missing field", JSON.stringify({ username: "u" })],
  ["extra field", JSON.stringify({ ...credentials, region: "org" })], ["blank username", JSON.stringify({ ...credentials, username: " " })],
  ["blank password", JSON.stringify({ ...credentials, password: " " })], ["blank API key", JSON.stringify({ ...credentials, apiKey: " " })],
  ["same token value", JSON.stringify({ ...credentials, accessToken: credentials.apiKey })],
  ["too large", " ".repeat(16 * 1024 + 1)],
]) test("credential bundle rejects " + label + " before network", async t => {
  const { methods, calls } = await stub(t, []);
  assert.equal(CREDENTIAL_PROMPT.validate(value) !== undefined, true);
  assert.equal((await methods[0].authorize({ credentials: value })).type, "failed");
  assert.equal(calls.length, 0);
});

test("one credential bundle is parsed into the four independent stored values", () => {
  assert.deepEqual(parseCredentialBundle(packed).credentials, credentials);
});

for (const [name, responses] of [
  ["wrong password", [Response.json({ success: false, message: credentials.password })]],
  ["missing identity", [login({ checked_in: true })]],
  ["two-factor challenge", [login({ require_2fa: true })]],
  ["redirect", [new Response(null, { status: 307, headers: { location: "https://foreign.test" } })]],
  ["non-success JSON with identity", [new Response(JSON.stringify({ success: true, data: { id: 42 } }), { status: 500 })]],
  ["missing success flag", [Response.json({ data: { id: 42 } })]],
  ["login captcha", [new Response("<html>" + credentials.password)]],
  ["network failure", [new Error(credentials.password)]],
  ["oversized reply", [new Response("x".repeat(64 * 1024 + 1))]],
  ["token rejected", [login(), Response.json({ success: false, message: credentials.accessToken })]],
  ["wrong token account", [login(), user({ id: 99, quota: 1, used_quota: 1 })]],
  ["token captcha", [login(), new Response("<html>" + credentials.accessToken)]],
]) test(name + " does not save credentials or offer a browser flow", async t => {
  const { methods } = await stub(t, responses);
  const result = await methods[0].authorize({ credentials: packed });
  assert.equal(result.type, "failed");
  assert.equal(result.key, undefined);
  assert.equal(result.metadata, undefined);
  assert.equal(result.url, undefined);
  assert.equal(result.callback, undefined);
  for (const secret of Object.values(credentials)) assert.equal(result.error.includes(secret), false);
});

test("valid bundle preserves password whitespace and stores each secret in its intended place", async t => {
  const { methods, calls } = await stub(t, [login(), user()]);
  const result = await methods[0].authorize({ credentials: packed });
  assert.equal(result.type, "success");
  assert.equal(JSON.parse(calls[0].init.body).password, credentials.password);
  assert.equal(result.key, credentials.apiKey);
  assert.equal(result.metadata.username, credentials.username);
  assert.equal(result.metadata.password, credentials.password);
  assert.equal(result.metadata.accessToken, credentials.accessToken);
  assert.equal(result.metadata.cookie, undefined);
});

test("a missing quota record does not fabricate balance or reject an identity-verified token", async t => {
  const { methods } = await stub(t, [login(), user({ id: 42 })]);
  assert.equal((await methods[0].authorize({ credentials: packed })).type, "success");
});

test("cancelled authorization makes no request", async t => {
  const { methods, calls } = await stub(t, []);
  const controller = new AbortController();
  controller.abort();
  const result = await methods[0].authorize({ credentials: packed }, { signal: controller.signal });
  assert.equal(result.type, "failed");
  assert.equal(calls.length, 0);
});
