import assert from "node:assert/strict";
import test from "node:test";
import plugin, { _internal } from "../src/index.mjs";

const metadata = { username: "fixture-user", password: "fixture-password", accessToken: "fixture-token", userId: "42", cookie: "session=obsolete" };
async function usage(t, response, auth = { key: "sk-fixture", metadata }, provider = {}, origins = ["https://agentrouter.org"]) {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new URL(url).origin, origins[Math.min(calls.length - 1, origins.length - 1)]);
    assert.equal(new URL(url).pathname, "/api/user/self");
    const h = new Headers(init.headers);
    assert.equal(h.get("authorization"), metadata.accessToken);
    assert.equal(h.get("new-api-user"), "42");
    assert.equal(h.has("cookie"), false);
    assert.equal(init.body, undefined);
    const current = Array.isArray(response) ? response[Math.min(calls.length - 1, response.length - 1)] : response;
    if (current instanceof Error) throw current;
    return current;
  };
  try { return { result: await (await plugin()).auth.usage(async () => auth, provider), calls }; }
  finally { globalThis.fetch = original; }
}

test("management token reads balance and percentages, never logs in", async t => {
  const { result, calls } = await usage(t, Response.json({ success: true, data: { id: 42, username: "fixture-user", quota: 75000000, used_quota: 25000000 } }));
  assert.equal(result.balance, "$150.00");
  assert.equal(result.windows[0].amount, 50);
  assert.equal(result.windows[0].limit, 200);
  assert.equal(result.windows[0].used, 25);
  assert.equal(result.windows[0].remaining, 75);
  assert.equal(calls.length, 1);
});

const airAuth = { key: "sk-fixture", metadata: { ...metadata, site: "air", apiBase: "https://ps.air-outer.com/v1" } };
const balance = () => Response.json({
  success: true, data: { id: 42, username: "fixture-user", quota: 75000000, used_quota: 25000000 },
});

test("a domestic-site account prefers its own balance endpoint", async t => {
  const { result, calls } = await usage(t, balance(), airAuth, {}, ["https://ps.air-outer.com"]);
  assert.equal(result.balance, "$150.00");
  assert.deepEqual(calls, ["https://ps.air-outer.com/api/user/self"]);
});

test("balance falls back to the international site when the domestic site is unavailable", async t => {
  const { result, calls } = await usage(t, [new Response("<html>waf</html>"), balance()], airAuth, {},
    ["https://ps.air-outer.com", "https://agentrouter.org"]);
  assert.equal(result.balance, "$150.00");
  assert.deepEqual(calls, [
    "https://ps.air-outer.com/api/user/self",
    "https://agentrouter.org/api/user/self",
  ]);
});

test("balance falls back to the domestic site when the international site is unavailable", async t => {
  const { result, calls } = await usage(t, [new Response("<html>waf</html>"), balance()], undefined, {},
    ["https://agentrouter.org", "https://ps.air-outer.com"]);
  assert.equal(result.balance, "$150.00");
  assert.deepEqual(calls, [
    "https://agentrouter.org/api/user/self",
    "https://ps.air-outer.com/api/user/self",
  ]);
});

test("balance stops after one fallback when both sites fail", async t => {
  const { result, calls } = await usage(t, [new Response("<html>waf</html>"), new Response("<html>waf</html>")], undefined, {},
    ["https://agentrouter.org", "https://ps.air-outer.com"]);
  assert.equal(result.balance, undefined);
  assert.match(result.error, /验证码拦截/);
  assert.equal(calls.length, 2);
});

test("real zero balance stays zero", async t => {
  const { result } = await usage(t, Response.json({ success: true, data: { id: 42, quota: 0, used_quota: 500000 } }));
  assert.equal(result.balance, "$0.00");
  assert.equal(result.windows[0].used, 100);
});

for (const [name, response] of [
  ["captcha", new Response("<html>" + metadata.accessToken)],
  ["token rejection", Response.json({ success: false, message: metadata.accessToken })],
  ["wrong account", Response.json({ success: true, data: { id: 99, quota: 1, used_quota: 1 } })],
  ["missing identity", Response.json({ success: true, data: { quota: 1, used_quota: 1 } })],
  ["missing quota", Response.json({ success: true, data: { id: 42 } })],
  ["invalid quota", Response.json({ success: true, data: { id: 42, quota: null, used_quota: -1 } })],
  ["HTTP failure", Response.json({ success: true, data: { id: 42, quota: 1, used_quota: 1 } }, { status: 500 })],
  ["network", new Error(metadata.password)],
]) test(name + " never falls back to another credential", async t => {
  const siteFailure = ["captcha", "HTTP failure", "network"].includes(name);
  const { result, calls } = await usage(t, response, undefined, {}, siteFailure
    ? ["https://agentrouter.org", "https://ps.air-outer.com"]
    : ["https://agentrouter.org"]);
  assert.equal(result.balance, undefined);
  assert.deepEqual(result.windows, []);
  assert.match(result.error, /剩余额度未知/);
  assert.equal(calls.length, siteFailure ? 2 : 1);
  for (const secret of [metadata.password, metadata.accessToken, metadata.cookie, "sk-fixture"]) assert.equal(result.error.includes(secret), false);
});

test("missing management token or ID makes no request", async t => {
  for (const md of [{ username: metadata.username, password: metadata.password }, { accessToken: metadata.accessToken }]) {
    const { result, calls } = await usage(t, null, { key: "sk-fixture", metadata: md });
    assert.equal(calls.length, 0);
    assert.deepEqual(result.windows, []);
    assert.match(result.error, /四项凭据/);
  }
});

test("endpoint compatibility and declared models are preserved", () => {
  assert.equal(_internal.apiBase({}, { metadata: { endpoint: "sk-fixture" } }), "https://agentrouter.org/v1");
  assert.equal(_internal.apiBase({}, { metadata: { endpoint: "https://relay.test" } }), "https://relay.test/v1");
  assert.deepEqual(Object.keys(_internal.declaredModels()), ["gpt-5.6-sol", "gpt-6.1-sol"]);
});
