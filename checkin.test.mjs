import assert from "node:assert/strict";
import test from "node:test";
import plugin from "./index.mjs";

const metadata = { username: "fixture-user", password: "fixture-password", accessToken: "fixture-token", userId: "42" };
async function run(t, data, status = 200, auth = { key: "sk-fixture", metadata }) {
  const original = globalThis.fetch, calls = [];
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(new URL(url).pathname, "/api/user/login");
    assert.deepEqual(JSON.parse(init.body), { username: metadata.username, password: metadata.password });
    const h = new Headers(init.headers);
    assert.equal(h.has("authorization"), false);
    assert.equal(h.has("cookie"), false);
    assert.equal(h.has("new-api-user"), false);
    assert.equal(init.redirect, "manual");
    if (data instanceof Error) throw data;
    return typeof data === "string" ? new Response(data, { status }) : Response.json(data, { status });
  };
  const result = await (await plugin()).auth.checkin(async () => auth, {});
  for (const secret of [metadata.password, metadata.accessToken, "sk-fixture"]) assert.equal(JSON.stringify(result).includes(secret), false);
  return { result, calls };
}

for (const [marker, outcome] of [[true, "claimed"], [false, "done"], [undefined, "failed"], ["true", "failed"], [1, "failed"], [null, "failed"]]) {
  test("reward marker " + marker + " gives " + outcome, async t => {
    const { result, calls } = await run(t, { success: true, data: { id: 42, checked_in: marker } });
    assert.equal(result.outcome, outcome);
    assert.equal(calls.length, 1);
    if (marker === true) {
      assert.match(result.message, /checked_in=true/);
      assert.doesNotMatch(result.message, /新增额度已到账/);
    }
  });
}

test("saved flat account fields also work", async t => {
  assert.equal((await run(t, { success: true, data: { id: 42, checked_in: true } }, 200, { type: "api", key: "sk-fixture", ...metadata })).result.outcome, "claimed");
});

for (const [name, data, status, outcome] of [
  ["wrong password", { success: false, message: metadata.password }, 200, "ineligible"],
  ["wrong account", { success: true, data: { id: 99, checked_in: true } }, 200, "ineligible"],
  ["missing account", { success: true, data: { checked_in: true } }, 200, "ineligible"],
  ["missing success", { data: { id: 42, checked_in: true } }, 200, "failed"],
  ["HTTP failure", { success: true, data: { id: 42, checked_in: true } }, 500, "failed"],
  ["captcha", "<html>" + metadata.password, 403, "captcha"],
  ["network", new Error(metadata.password), 200, "failed"],
]) test(name + " is not a successful check-in", async t => {
  assert.equal((await run(t, data, status)).result.outcome, outcome);
});

test("missing password does not try the model Key or token", async t => {
  const { result, calls } = await run(t, {}, 200, { key: "sk-fixture", metadata: { accessToken: metadata.accessToken } });
  assert.equal(result.outcome, "ineligible");
  assert.equal(calls.length, 0);
});

test("missing saved identity never signs another account in", async t => {
  const { result, calls } = await run(t, {}, 200, { key: "sk-fixture", metadata: { username: metadata.username, password: metadata.password } });
  assert.equal(result.outcome, "ineligible");
  assert.equal(calls.length, 0);
});
