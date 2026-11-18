import assert from "node:assert/strict";
import test from "node:test";
import plugin, { _internal } from "../src/index.mjs";

const metadata = { username: "fixture-user", password: "fixture-password", accessToken: "fixture-token", userId: "42", cookie: "session=obsolete" };
async function usage(t, response, auth = { key: "sk-fixture", metadata }, provider = {}) {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new URL(url).origin, "https://agentrouter.org");
    assert.equal(new URL(url).pathname, "/api/user/self");
    const h = new Headers(init.headers);
    assert.equal(h.get("authorization"), metadata.accessToken);
    assert.equal(h.get("new-api-user"), "42");
    assert.equal(h.has("cookie"), false);
    assert.equal(init.body, undefined);
    if (response instanceof Error) throw response;
    return response;
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

test("a domestic-site account reads balance from the international site", async t => {
  const auth = { key: "sk-fixture", metadata: { ...metadata, site: "air", apiBase: "https://ps.air-outer.com/v1" } };
  const { result, calls } = await usage(t, Response.json({
    success: true, data: { id: 42, username: "fixture-user", quota: 75000000, used_quota: 25000000 },
  }), auth);
  assert.equal(result.balance, "$150.00");
  assert.deepEqual(calls, ["https://agentrouter.org/api/user/self"]);
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
]) test(name + " never falls back to passwords, Cookies or model Key", async t => {
  const { result, calls } = await usage(t, response);
  assert.equal(result.balance, undefined);
  assert.deepEqual(result.windows, []);
  assert.match(result.error, /剩余额度未知/);
  assert.equal(calls.length, 1);
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
  assert.deepEqual(Object.keys(_internal.declaredModels()), ["gpt-5.6-sol", "gpt-6.1-sol", "gpt-6-astra"]);
});
