import assert from "node:assert/strict";
import test from "node:test";
import plugin from "../src/index.mjs";

const base = "https://agentrouter.org";
const inputs = { username: "fixture-user", password: "fixture-password", apiKey: "", accessToken: "" };
const login = () => new Response(JSON.stringify({ success: true, data: { id: 42, checked_in: true } }), {
  headers: {
    "content-type": "application/json",
    "set-cookie": "session=fixture-session; Path=/; HttpOnly, acw_tc=fixture-waf; Path=/",
  },
});
const self = token => Response.json({ success: true, data: { id: 42, access_token: token } });
const tokens = items => Response.json({ success: true, data: { items } });
const balance = () => Response.json({ success: true, data: { id: 42, quota: 100, used_quota: 50 } });

async function authorize(t, inputsValue, respond) {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    calls.push({ url, headers, body: init.body });
    return respond(url, headers, init);
  };
  const result = await (await plugin()).auth.methods[0].authorize(inputsValue);
  return { result, calls };
}

test("blank API Key and system token are provisioned from the login session", async t => {
  const { result, calls } = await authorize(t, inputs, (url, headers) => {
    if (url.pathname === "/api/user/login") return login();
    if (url.pathname === "/api/user/self" && headers.has("cookie")) {
      assert.match(headers.get("cookie"), /session=fixture-session/);
      assert.match(headers.get("cookie"), /acw_tc=fixture-waf/);
      assert.equal(headers.get("new-api-user"), "42");
      return self("fixture-derived-access");
    }
    if (url.pathname === "/api/token/" && url.search === "?p=0") {
      assert.match(headers.get("cookie"), /session=fixture-session/);
      return tokens([{ id: 7, name: "magpie", status: 1, expired_time: -1, key: "fixture-model-key" }]);
    }
    if (url.pathname === "/api/user/self" && headers.get("authorization") === "fixture-derived-access") return balance();
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "success");
  assert.equal(result.key, "sk-fixture-model-key");
  assert.equal(result.metadata.accessToken, "fixture-derived-access");
  assert.equal(result.metadata.userId, "42");
  assert.equal(JSON.stringify(result).includes("fixture-session"), false);
  assert.deepEqual(calls.map(c => c.url.pathname + c.url.search), [
    "/api/user/login",
    "/api/user/self",
    "/api/token/?p=0",
    "/api/user/self",
  ]);
});

test("blank API Key uses an existing magpie token", async t => {
  const { result, calls } = await authorize(t, { ...inputs, accessToken: "fixture-provided-access" }, (url, headers) => {
    if (url.pathname === "/api/user/login") return login();
    if (url.pathname === "/api/token/") {
      assert.match(headers.get("cookie"), /session=fixture-session/);
      return tokens([{ id: 7, name: "magpie", status: 1, expired_time: -1, key: "fixture-model-key" }]);
    }
    if (url.pathname === "/api/user/self" && headers.get("authorization") === "fixture-provided-access") return balance();
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "success");
  assert.equal(result.key, "sk-fixture-model-key");
  assert.equal(result.metadata.accessToken, "fixture-provided-access");
  assert.deepEqual(calls.map(c => c.url.pathname + c.url.search), ["/api/user/login", "/api/token/?p=0", "/api/user/self"]);
});

test("blank system token is read from the login session", async t => {
  const { result, calls } = await authorize(t, { ...inputs, apiKey: "sk-fixture-provided" }, (url, headers) => {
    if (url.pathname === "/api/user/login") return login();
    if (url.pathname === "/api/user/self" && headers.has("cookie")) return self("fixture-derived-access");
    if (url.pathname === "/api/user/self" && headers.get("authorization") === "fixture-derived-access") return balance();
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "success");
  assert.equal(result.key, "sk-fixture-provided");
  assert.equal(result.metadata.accessToken, "fixture-derived-access");
  assert.deepEqual(calls.map(c => c.url.pathname), ["/api/user/login", "/api/user/self", "/api/user/self"]);
});

test("a missing magpie token is created and its key is prefixed with sk-", async t => {
  let listCalls = 0;
  const { result, calls } = await authorize(t, inputs, (url, headers, init) => {
    if (url.pathname === "/api/user/login") return login();
    if (url.pathname === "/api/user/self" && headers.has("cookie")) return self("fixture-derived-access");
    if (url.pathname === "/api/token/" && url.search === "?p=0") {
      listCalls++;
      return tokens(listCalls === 1 ? [] : [{ id: 9, name: "magpie", status: 1, expired_time: -1, key: "fixture-created-key" }]);
    }
    if (url.pathname === "/api/token/" && init.method === "POST") {
      assert.equal(JSON.parse(init.body).name, "magpie");
      return Response.json({ success: true, message: "" });
    }
    if (url.pathname === "/api/user/self" && headers.get("authorization") === "fixture-derived-access") return balance();
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "success");
  assert.equal(result.key, "sk-fixture-created-key");
  assert.equal(listCalls, 2);
  assert.deepEqual(calls.map(c => c.url.pathname + c.url.search), [
    "/api/user/login", "/api/user/self", "/api/token/?p=0", "/api/token/", "/api/token/?p=0", "/api/user/self",
  ]);
});

test("a masked token key is fetched in full", async t => {
  const { result } = await authorize(t, { ...inputs, accessToken: "fixture-provided-access" }, (url, headers) => {
    if (url.pathname === "/api/user/login") return login();
    if (url.pathname === "/api/token/") return tokens([{ id: 7, name: "magpie", status: 1, expired_time: -1, key: "mag***ter" }]);
    if (url.pathname === "/api/token/7/key") return Response.json({ success: true, data: { key: "fixture-full-key" } });
    if (url.pathname === "/api/user/self" && headers.get("authorization") === "fixture-provided-access") return balance();
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "success");
  assert.equal(result.key, "sk-fixture-full-key");
});

test("blank credentials without a login session fail without extra requests", async t => {
  const { result, calls } = await authorize(t, inputs, url => {
    if (url.pathname === "/api/user/login") {
      return Response.json({ success: true, data: { id: 42, checked_in: true } });
    }
    assert.fail("unexpected request " + url);
  });
  assert.equal(result.type, "failed");
  assert.match(result.error, /登录会话不可用/);
  assert.equal(calls.length, 1);
});
