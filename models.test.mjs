import assert from "node:assert/strict";
import test from "node:test";
import { enrichModel, MODEL_CATALOG, PRICING_FALLBACK } from "./models.mjs";
import plugin from "./index.mjs";


test("verified catalog exposes context, modalities, tools and thinking tiers", () => {
  const gpt = enrichModel({ id: "gpt-5.6-sol" });
  assert.equal(gpt.limit.context, 1_050_000);
  assert.equal(gpt.limit.input, 922_000);
  assert.equal(gpt.limit.output, 128_000);
  assert.deepEqual(Object.keys(gpt.variants), ["none", "low", "medium", "high", "xhigh", "max"]);
  assert.equal(gpt.tool_call, true);
  assert.deepEqual(gpt.modalities.input, ["text", "image"]);

  const deepseek = enrichModel({ id: "deepseek-v4-flash" });
  assert.equal(deepseek.limit.context, 1_000_000);
  assert.equal(deepseek.limit.output, 384_000);
  assert.deepEqual(Object.keys(deepseek.variants), ["low", "high", "max"]);
  assert.equal(deepseek.reasoning, true);
});

test("verified GPT-6 models expose upstream limits and supported reasoning tiers", () => {
  for (const id of ["gpt-6.1-sol", "gpt-6-astra"]) {
    const model = enrichModel({ id });
    assert.equal(model.limit.context, 1_050_000);
    assert.equal(model.limit.input, 922_000);
    assert.equal(model.limit.output, 128_000);
    assert.deepEqual(Object.keys(model.variants), ["low", "medium", "high", "xhigh", "max"]);
    assert.equal(model.tool_call, true);
  }
});

test("unknown model metadata is left unknown rather than filled with generic guesses", () => {
  const model = enrichModel({ id: "unlisted-model-x" });
  assert.equal(model.name, "unlisted-model-x");
  assert.equal(model.limit, undefined);
  assert.equal(model.reasoning, undefined);
  assert.equal(model.variants, undefined);
});

test("live API metadata overrides catalog limits while catalog capabilities fill missing fields", () => {
  const model = enrichModel({ id: "gpt-5.6-sol", context_length: 2_000_000, max_output_tokens: 64_000, supported_endpoint_types: ["openai"] });
  assert.equal(model.limit.context, 2_000_000);
  assert.equal(model.limit.output, 64_000);
  assert.equal(model.limit.input, 922_000);
  assert.deepEqual(model.endpoints, ["openai"]);
  assert.equal(model.tool_call, true);
  assert.equal(model.provider.npm, "@ai-sdk/openai");
});

test("live models use per-model SDK protocols and the selected site's API roots", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  const requested = [];
  globalThis.fetch = async (url, init) => {
    const target = new URL(url);
    requested.push({ url: target.href, headers: new Headers(init.headers) });
    if (target.pathname === "/api/pricing") return Response.json({ success: true, data: [
      { model_name: "gpt-5.6-sol", supported_endpoint_types: ["openai"] },
      { model_name: "claude-opus-5", supported_endpoint_types: ["anthropic"] },
      { model_name: "deepseek-v4-flash", supported_endpoint_types: ["openai"] },
    ] });
    if (target.pathname === "/v1/models") return Response.json({ data: [
      { id: "gpt-5.6-sol" }, { id: "claude-opus-5" }, { id: "deepseek-v4-flash" },
    ] });
    assert.fail("unexpected URL " + target.href);
  };
  const p = await plugin();
  const models = await p.provider.models({}, { auth: {
    key: "sk-fixture", metadata: { site: "air", apiBase: "https://ps.air-outer.com/v1" },
  } });
  assert.equal(models["gpt-5.6-sol"].api.npm, "@ai-sdk/openai");
  assert.equal(models["gpt-5.6-sol"].api.url, "https://ps.air-outer.com/v1");
  assert.equal(models["gpt-5.6-sol"].limit.context, 1_050_000);
  assert.equal(models["gpt-5.6-sol"].capabilities.reasoning, true);
  assert.equal(models["claude-opus-5"].api.npm, "@ai-sdk/anthropic");
  assert.equal(models["claude-opus-5"].api.url, "https://ps.air-outer.com");
  assert.deepEqual(Object.keys(models["claude-opus-5"].variants), ["low", "medium", "high", "xhigh", "max"]);
  assert.equal(models["deepseek-v4-flash"].api.npm, "@ai-sdk/openai-compatible");
  assert.equal(models["deepseek-v4-flash"].api.url, "https://ps.air-outer.com/v1");
  assert.ok(requested.some(r => r.url === "https://ps.air-outer.com/api/pricing"));
  assert.ok(requested.some(r => r.url === "https://ps.air-outer.com/v1/models"));
});

test("an uncatalogued Anthropic-only model is routed through Anthropic, not the OpenAI-compatible default", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => {
    const target = new URL(url);
    if (target.pathname === "/api/pricing") return Response.json({ success: true, data: [
      { model_name: "future-model", supported_endpoint_types: ["anthropic"] },
    ] });
    if (target.pathname === "/v1/models") return Response.json({ data: [{ id: "future-model" }] });
    assert.fail("unexpected URL " + target.href);
  };
  const p = await plugin();
  const models = await p.provider.models({}, { auth: { key: "sk-fixture" } });
  assert.equal(models["future-model"].api.npm, "@ai-sdk/anthropic");
  assert.equal(models["future-model"].api.url, "https://agentrouter.org");
  assert.equal(models["future-model"].limit, undefined);
});

test("fallback is restricted to the current public pricing snapshot", async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async url => {
    assert.equal(new URL(url).pathname, "/api/pricing");
    return Response.json({ success: true, data: PRICING_FALLBACK });
  };
  const p = await plugin();
  const models = await p.provider.models({}, { auth: null });
  assert.deepEqual(Object.keys(models), PRICING_FALLBACK.map(m => m.model_name));
  assert.equal(models["gpt-5.6-sol"].limit.context, MODEL_CATALOG["gpt-5.6-sol"].limit.context);
  assert.equal(models["gpt-6-astra"].limit.context, 1_050_000);
  assert.deepEqual(Object.keys(models["gpt-6-astra"].variants), ["low", "medium", "high", "xhigh", "max"]);
});
