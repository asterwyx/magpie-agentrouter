import { explainResponse } from "./response.mjs";
import { prepareRequest } from "./request.mjs";
import { SessionRepairError } from "./session-repair.mjs";
import { SITES, meta, ACCOUNT_PROMPTS, authorizeAccount, usableModelKey,
  tokenBalance, passwordCheckin, accountError } from "./account.mjs";
import { MODEL_CATALOG, PRICING_FALLBACK, enrichModel } from "./models.mjs";

const PROVIDER = "agentrouter";
const ENDPOINT = SITES.org.api;
const DEFAULT_HEADERS = { "User-Agent": "codex_cli_rs/0.101.0", Accept: "application/json" };
const DECLARED_MODELS = Object.fromEntries(PRICING_FALLBACK.map(m => [m.model_name, MODEL_CATALOG[m.model_name]?.name ?? m.model_name]));

// Compatibility helpers for existing endpoint/header metadata. Authentication
// headers are assigned by their own operation, never copied across purposes.
function parseHeaders(text) {
  const out = {};
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const s = line.trim(), at = s.indexOf(":");
    if (!s || s.startsWith("#") || at < 1) continue;
    const name = s.slice(0, at).trim(), value = s.slice(at + 1).trim();
    if (name && value) out[name] = value;
  }
  return out;
}

function applyHeaders(h, extra) {
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null || v === "") h.delete(k);
    else h.set(k, String(v));
  }
  return h;
}

function modelHeaders(provider) {
  const out = {};
  for (const m of Object.values(provider?.models ?? {})) {
    if (m && typeof m.headers === "object" && m.headers) Object.assign(out, m.headers);
  }
  return out;
}

function headersOf(provider, auth, codex = true) {
  const out = {
    ...(codex ? { "User-Agent": DEFAULT_HEADERS["User-Agent"] } : {}),
    Accept: DEFAULT_HEADERS.Accept, ...modelHeaders(provider),
    ...parseHeaders(provider?.headers), ...parseHeaders(meta(auth, "headers")),
  };
  for (const name of Object.keys(out)) {
    if (/^(authorization|proxy-authorization|cookie|new-api-user|x-api-key)$/i.test(name)) delete out[name];
  }
  return out;
}

function isURLish(v) { return /^https?:\/\/\S+$/i.test(String(v ?? "").trim()); }

function apiBase(provider, auth) {
  const said = String(meta(auth, "endpoint") ?? provider?.endpoint ?? "").trim();
  if (isURLish(said)) return `${said.replace(/\/+$/, "")}/v1`;
  const base = String(meta(auth, "apiBase") ?? "").trim();
  return base ? base.replace(/\/+$/, "") : `${ENDPOINT}/v1`;
}

function siteBase(provider, auth) {
  // Existing metadata remains usable; new accounts keep an explicit trusted
  // site, with no fifth sign-in question. The plugin option site can be air.
  const said = String(meta(auth, "siteURL") ?? provider?.siteURL ?? "").trim();
  if (said) return said.replace(/\/+$/, "");
  return (SITES[meta(auth, "site") ?? provider?.site] ?? SITES.org).site;
}

function apiKey(auth) { return typeof auth?.key === "string" ? auth.key.trim() : ""; }

function modalities(value) {
  if (!Array.isArray(value)) return undefined;
  return Object.fromEntries(["text", "image", "audio", "video", "pdf"].map(name => [name, value.includes(name)]));
}

function modelsFrom(items, prices = new Map(), { openAIAPI = `${SITES.org.api}/v1`, anthropicAPI = SITES.org.site } = {}) {
  const out = {};
  for (const item of items ?? []) {
    const id = String(item?.id ?? item?.model_name ?? "");
    if (!id) continue;
    const source = enrichModel({ ...item, id }, prices.get(id));
    if (!source) continue;
    const npm = source.provider?.npm ?? "@ai-sdk/openai-compatible";
    out[id] = {
      id,
      name: source.name ?? id,
      api: { id: item?.api_id ?? id, url: npm === "@ai-sdk/anthropic" ? anthropicAPI : openAIAPI, npm },
      ...(source.description ? { description: source.description } : {}),
      ...(source.limit ? { limit: source.limit } : {}),
      capabilities: {
        ...(typeof source.reasoning === "boolean" ? { reasoning: source.reasoning } : {}),
        ...(typeof source.tool_call === "boolean" ? { toolcall: source.tool_call } : {}),
        ...(typeof source.attachment === "boolean" ? { attachment: source.attachment } : {}),
        ...(typeof source.temperature === "boolean" ? { temperature: source.temperature } : {}),
        ...(source.modalities?.input ? { input: modalities(source.modalities.input) } : {}),
        ...(source.modalities?.output ? { output: modalities(source.modalities.output) } : {}),
      },
      ...(source.variants ? { variants: source.variants } : {}),
      ...(typeof source.temperature === "boolean" ? { temperature: source.temperature } : {}),
      ...(source.release_date ? { release_date: source.release_date } : {}),
      ...(source.status ? { status: source.status } : {}),
    };
  }
  return out;
}

function declaredModels() {
  return Object.fromEntries(PRICING_FALLBACK.map(m => [m.model_name, enrichModel(m, new Map().get(m.model_name))]));
}

async function pricingOf(site, signal) {
  try {
    const res = await fetch(`${site}/api/pricing`, { headers: { Accept: "application/json" }, redirect: "manual", signal });
    if (!res.ok) return new Map();
    const json = await res.json();
    if (json?.success !== true || !Array.isArray(json.data)) return new Map();
    return new Map(json.data.filter(m => typeof m?.model_name === "string").map(m => [m.model_name, m]));
  } catch { return new Map(); }
}

async function modelsOf(provider, { auth } = {}, codex = true) {
  const key = apiKey(auth);
  const site = siteBase(provider, auth);
  const api = apiBase(provider, auth);
  const customEndpoint = meta(auth, "endpoint") ?? provider?.endpoint;
  const anthropicAPI = isURLish(customEndpoint) ? api : site;
  const endpoints = { openAIAPI: api, anthropicAPI };
  const signal = AbortSignal.timeout(30_000);
  const pricesPromise = pricingOf(site, signal);
  const fallback = modelsFrom(PRICING_FALLBACK, new Map(), endpoints);
  if (!usableModelKey(key)) return modelsFrom(PRICING_FALLBACK, await pricesPromise, endpoints);
  try {
    const [res, prices] = await Promise.all([
      fetch(`${api}/models`, {
        headers: { ...headersOf(provider, auth, codex), Authorization: `Bearer ${key}` },
        redirect: "manual", signal,
      }),
      pricesPromise,
    ]);
    if (!res.ok) return modelsFrom(PRICING_FALLBACK, prices, endpoints);
    const json = await res.json();
    if (!Array.isArray(json?.data)) return modelsFrom(PRICING_FALLBACK, prices, endpoints);
    const out = modelsFrom(json.data, prices, endpoints);
    return Object.keys(out).length ? out : fallback;
  } catch { return fallback; }
}

async function usageOf(getAuth, provider, context) {
  const auth = await getAuth();
  if (!auth) return { windows: [] };
  const result = await tokenBalance(siteBase(provider, auth), auth, context?.signal);
  if (!result.ok) return {
    error: accountError(result.why, "余额查询") + "；剩余额度未知。未使用密码或 API Key 回退查询。",
    windows: [], ...(result.why === "rejected" || result.why === "identity" ? { signIn: "expired" } : {}),
  };
  const bal = result.balance;
  const rateValue = Number(provider?.quotaPerUnit ?? 500000);
  const rate = Number.isFinite(rateValue) && rateValue > 0 ? rateValue : 500000;
  const dollars = n => Math.round(n / rate * 100) / 100;
  const left = dollars(bal.quota), spent = dollars(bal.used), whole = dollars(bal.total);
  const used = bal.total > 0 ? Math.min(100, Math.max(0, bal.used / bal.total * 100)) : 0;
  return {
    plan: bal.name || undefined, balance: `$${left.toFixed(2)}`,
    windows: [{ name: "Balance", used: Math.round(used * 10) / 10,
      remaining: Math.round((100 - used) * 10) / 10, amount: spent, limit: whole, unit: "usd",
      display: `$${left.toFixed(2)} / $${whole.toFixed(2)}` }],
  };
}

async function checkinOf(getAuth, provider, context) {
  const auth = await getAuth();
  if (!auth) return { outcome: "ineligible", message: "AgentRouter：尚未配置账号" };
  return passwordCheckin(siteBase(provider, auth), auth, context?.signal);
}

export const AgentRouterAuthPlugin = async (input, options = {}) => {
  const codex = () => input?.magpie?.option?.(PROVIDER, "send-codex-headers") !== false;
  const portable = () => input?.magpie?.option?.(PROVIDER, "portable-responses") !== false;
  const repairing = () => input?.magpie?.option?.(PROVIDER, "codex-session-repair") === true;
  return {
    config: async cfg => {
      cfg.provider ??= {};
      cfg.provider[PROVIDER] ??= { name: "AgentRouter", npm: "@ai-sdk/openai", api: `${ENDPOINT}/v1`, models: declaredModels() };
    },
    auth: {
      provider: PROVIDER,
      methods: [
        { type: "api", label: "AgentRouter 国际站", prompts: ACCOUNT_PROMPTS,
          // A method choice renders as buttons in Magpie. Each credential is
          // then its own native field: username, password, API key, token.
          authorize: (inputs, context) => authorizeAccount(inputs, "org", context?.signal) },
        { type: "api", label: "AgentRouter 国内站", prompts: ACCOUNT_PROMPTS,
          authorize: (inputs, context) => authorizeAccount(inputs, "air", context?.signal) },
      ],
      async loader(getAuth, provider) {
        const auth = (await getAuth()) ?? {};
        return {
          apiKey: apiKey(auth) || "agentrouter",
          async fetch(input, init = {}) {
            const key = apiKey(auth);
            if (!usableModelKey(key)) return Response.json({ error: {
              type: "invalid_request_error", code: "agentrouter_missing_api_key",
              message: "尚未配置模型 API Key，请在四项凭据入口填写。系统访问令牌和账号密码不能用于模型调用。",
            } }, { status: 400 });
            const h = new Headers(input instanceof Request ? input.headers : undefined);
            new Headers(init.headers ?? {}).forEach((v, k) => h.set(k, v));
            applyHeaders(h, headersOf(provider, auth, codex()));
            for (const name of ["Cookie", "Proxy-Authorization", "New-Api-User", "X-Api-Key"]) h.delete(name);
            h.set("Authorization", `Bearer ${key}`);
            let prepared;
            try {
              prepared = await prepareRequest(input, { ...init, headers: h }, {
                portableResponses: portable(), sessionRepair: repairing(),
              });
            } catch (error) {
              if (!(error instanceof SessionRepairError)) throw error;
              return Response.json({ error: { type: "invalid_request_error", code: error.code, message: error.message } }, { status: 400 });
            }
            return explainResponse(await fetch(input, prepared), {
              retryAfterSeconds: meta(auth, "retryAfterSeconds") ?? options?.retryAfterSeconds,
            });
          },
        };
      },
      usage: usageOf, checkin: checkinOf,
      options: [
        { key: "portable-responses", label: "内联发送完整的 Responses 历史", default: true,
          description: "仅在内容完整可内联时移除资源绑定的条目 ID，保留 call_id 和加密内容。只有引用的历史仍依赖原资源；关闭只停用无损内联，有损会话清理独立。" },
        { key: "send-codex-headers", label: "发送 Codex 客户端请求头", default: true,
          description: "AgentRouter 仅接受受认可的客户端标识。开启时附带 Codex CLI 的默认 User-Agent；关闭时不添加该标识，仍发送自行配置的请求头和默认 Accept。" },
        { key: "codex-session-repair", label: "清理 Codex 会话的旧资源绑定（有损）", default: false,
          description: "默认关闭。发送前清理旧资源 ID、加密/压缩历史及仅引用条目，保留明文消息和工具关联。可能丢失压缩上下文；不修改本地会话文件或数据库，与无损内联独立。",
          confirm: "开启后会丢弃发送副本中的加密、压缩及仅引用历史，可能丢失上下文。不会修复本地日志或数据库；关闭后下一次请求恢复原有处理。确认开启？" },
      ],
    },
    provider: { id: PROVIDER, models: (provider, context) => modelsOf(provider, context, codex()) },
    "chat.headers": async (input, output) => {
      if (input?.model?.providerID !== PROVIDER && input?.provider?.info?.id !== PROVIDER) return;
      if (input.sessionID) output.headers["x-session-id"] = input.sessionID;
    },
  };
};

export default AgentRouterAuthPlugin;
export const _internal = { PROVIDER, SITES, DEFAULT_HEADERS, DECLARED_MODELS,
  parseHeaders, headersOf, applyHeaders, apiBase, siteBase, isURLish, declaredModels };
