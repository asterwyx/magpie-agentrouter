import assert from "node:assert/strict";
import test from "node:test";
import plugin from "./index.mjs";

const credentials = { username: "fixture-user", password: "fixture-password", apiKey: "sk-fixture-model", accessToken: "fixture-management" };

test("site selection is two buttons, followed by four separate credential fields", async () => {
  for (const input of [undefined, { magpie: {} }]) {
    const p = await plugin(input);
    assert.equal(p.auth.methods.length, 2);
    assert.deepEqual(p.auth.methods.map(m => m.label), ["AgentRouter 国际站", "AgentRouter 国内站"]);
    for (const m of p.auth.methods) {
      assert.equal(m.type, "api");
      assert.equal(m.keyless, undefined);
      assert.deepEqual(m.prompts.map(p => p.key), ["username", "password", "apiKey", "accessToken"]);
      assert.deepEqual(m.prompts.map(p => p.type), ["text", "password", "password", "password"]);
    }
  }
});

test("four answers complete login, models, balance and password check-in without OAuth", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input)), headers = new Headers(init.headers);
    calls.push({ path: url.pathname, init });
    assert.equal(url.origin, "https://agentrouter.org");
    assert.equal(headers.has("cookie"), false);
    if (url.pathname === "/api/user/login") {
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "manual");
      assert.equal(headers.has("authorization"), false);
      assert.deepEqual(JSON.parse(init.body), { username: credentials.username, password: credentials.password });
      return Response.json({ success: true, data: { id: 42, checked_in: true } });
    }
    if (url.pathname === "/api/user/self") {
      assert.equal(headers.get("authorization"), credentials.accessToken);
      assert.equal(headers.get("new-api-user"), "42");
      assert.equal(init.body, undefined);
      return Response.json({ success: true, data: { id: 42, username: credentials.username, quota: 75000000, used_quota: 25000000 } });
    }
    if (url.pathname === "/api/pricing") {
      return Response.json({ success: true, data: [{ model_name: "fixture-model", supported_endpoint_types: ["openai"] }] });
    }
    if (url.pathname === "/v1/models") {
      assert.equal(headers.get("authorization"), "Bearer " + credentials.apiKey);
      assert.equal(headers.has("new-api-user"), false);
      return Response.json({ data: [{ id: "fixture-model", context_length: 8192, max_output_tokens: 2048, reasoning: true }] });
    }
    if (url.pathname === "/v1/responses") {
      assert.equal(headers.get("authorization"), "Bearer " + credentials.apiKey);
      return Response.json({ id: "resp_fixture", output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }] });
    }
    assert.fail("unexpected request: " + url.pathname);
  };
  const p = await plugin({ magpie: {} });
  const saved = await p.auth.methods[0].authorize(credentials);
  assert.equal(saved.type, "success");
  assert.equal(saved.key, credentials.apiKey);
  assert.equal(saved.metadata.userId, "42");
  assert.equal(saved.metadata.accessToken, credentials.accessToken);
  for (const name of ["url", "callback", "method", "instructions"]) assert.equal(saved[name], undefined);
  assert.equal(saved.metadata.apiKey, undefined);
  const auth = { ...saved, type: "api" };
  const liveModels = await p.provider.models({}, { auth });
  assert.deepEqual(Object.keys(liveModels), ["fixture-model"]);
  assert.equal(liveModels["fixture-model"].limit.context, 8192);
  assert.equal(liveModels["fixture-model"].limit.output, 2048);
  assert.equal(liveModels["fixture-model"].api.npm, "@ai-sdk/openai-compatible");
  const usage = await p.auth.usage(async () => auth, {});
  assert.equal(usage.balance, "$150.00");
  assert.equal(usage.windows[0].used, 25);
  assert.equal((await p.auth.checkin(async () => auth, {})).outcome, "claimed");
  const loader = await p.auth.loader(async () => auth, {});
  assert.equal((await loader.fetch("https://agentrouter.org/v1/responses", { method: "POST", body: "{}" })).status, 200);
  assert.deepEqual(calls.map(c => c.path), ["/api/user/login", "/api/user/self", "/api/pricing", "/v1/models", "/api/user/self", "/api/user/login", "/v1/responses"]);
});

test("the domestic-site button uses its four separate credential fields and keeps all requests on that site", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const hosts = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    hosts.push(url.origin);
    assert.equal(url.origin, "https://ps.air-outer.com");
    if (url.pathname === "/api/user/login") return Response.json({ success: true, data: { id: 73, checked_in: false } });
    if (url.pathname === "/api/user/self") {
      assert.equal(new Headers(init.headers).get("New-Api-User"), "73");
      assert.equal(new Headers(init.headers).get("Authorization"), credentials.accessToken);
      return Response.json({ success: true, data: { id: 73, quota: 100, used_quota: 0 } });
    }
    assert.fail("unexpected domestic request " + url.pathname);
  };
  const p = await plugin();
  const result = await p.auth.methods[1].authorize(credentials);
  assert.equal(result.type, "success");
  assert.equal(result.metadata.site, "air");
  assert.equal(result.metadata.apiBase, "https://ps.air-outer.com/v1");
  assert.equal(result.metadata.userId, "73");
  assert.deepEqual(hosts, ["https://ps.air-outer.com", "https://ps.air-outer.com"]);
});

test("missing model key fails locally, never using any account credential as a key", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; assert.fail("network forbidden"); };
  const p = await plugin();
  for (const key of [undefined, "", "agentrouter", "YOUR_API_KEY", "sk-****"]) {
    const loader = await p.auth.loader(async () => ({ key, metadata: credentials }));
    const response = await loader.fetch("https://agentrouter.org/v1/responses", { method: "POST", body: "{}" });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "agentrouter_missing_api_key");
  }
  assert.equal(calls, 0);
});
