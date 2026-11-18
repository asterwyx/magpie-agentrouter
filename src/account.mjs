// Account operations are deliberately separate from model requests.
// Passwords only go to login; management tokens and model keys only go to
// their own endpoints. A login session is used only when a field is blank.
export const SITES = {
  org: { name: "AgentRouter", api: "https://agentrouter.org", site: "https://agentrouter.org" },
  air: { name: "AgentRouter (ps.air-outer.com)", api: "https://ps.air-outer.com", site: "https://ps.air-outer.com" },
};

export function meta(auth, name) {
  const flat = auth?.[name];
  if (flat !== undefined && flat !== null && String(flat).trim() !== "") return flat;
  return auth?.metadata?.[name];
}

export function usableModelKey(value) {
  return typeof value === "string" && !!value.trim() &&
    !["agentrouter", "your_api_key"].includes(value.trim().toLowerCase()) &&
    !/[*…<>]|\.\.\.|\s/.test(value.trim());
}

const text = value => typeof value === "string" ? value.trim() : "";
const numericId = value => /^[1-9][0-9]*$/.test(String(value ?? "")) ? String(value) : "";
const required = value => text(value) && !/[\x00-\x1f\x7f]/.test(value) && value.length <= 4096;
const tokenValid = value => required(value) && !/\s/.test(text(value));

export const ACCOUNT_PROMPTS = [
  { type: "text", key: "username", message: "AgentRouter 账号",
    validate: value => required(value) ? undefined : "请输入有效的 AgentRouter 账号" },
  { type: "password", key: "password", message: "AgentRouter 密码（用于登录签到）",
    validate: value => required(value) ? undefined : "请输入有效的 AgentRouter 密码" },
  { type: "password", key: "apiKey",
    message: "API Key（可留空：自动查找或创建名为 magpie 的模型 Key）",
    validate: value => !text(value) ? undefined :
      tokenValid(value) && usableModelKey(value) ? undefined : "请输入完整的模型 API Key" },
  { type: "password", key: "accessToken",
    message: "系统访问令牌（可留空：自动从登录会话读取）",
    validate: value => !text(value) ? undefined : tokenValid(value) ? undefined : "请输入有效的系统访问令牌" },
];

const TOKEN_NAME = "magpie";
const TOKEN_CREATE_BODY = {
  name: TOKEN_NAME,
  expired_time: -1,
  unlimited_quota: true,
  remain_quota: 0,
  model_limits_enabled: false,
  model_limits: "",
  allow_ips: "",
  group: "",
};

function cookiesOf(headers) {
  if (!headers) return "";
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : headers.get("set-cookie");
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies = [];
  for (const value of list) {
    for (const part of String(value).split(/,(?=\s*[^;=]+=)/)) {
      const pair = part.split(";", 1)[0].trim();
      if (pair) cookies.push(pair);
    }
  }
  return cookies.join("; ");
}

function sessionHeaders(cookie, userId, extra = {}) {
  return { Accept: "application/json", Cookie: cookie, "New-Api-User": userId, ...extra };
}

async function requestJSON(url, init, signal, { allowEmptyData = false } = {}) {
  const deadline = AbortSignal.timeout(30_000);
  const combined = signal ? AbortSignal.any([deadline, signal]) : deadline;
  let target;
  try { target = new URL(url); } catch { return { ok: false, why: "untrusted-site" }; }
  const tokenPath = target.pathname === "/api/token/";
  const allowedPath = ["/api/user/login", "/api/user/self"].includes(target.pathname) || tokenPath ||
    /^\/api\/token\/[1-9][0-9]*\/key$/.test(target.pathname);
  if (!Object.values(SITES).some(site => site.site === target.origin) || target.username || target.password ||
      !allowedPath || (target.search && !tokenPath) || target.hash) {
    return { ok: false, why: "untrusted-site" };
  }
  try {
    if (signal?.aborted) return { ok: false, why: "cancelled" };
    const response = await fetch(url, {
      ...init, redirect: "manual",
      signal: combined,
    });
    const raw = await accountBody(response, combined);
    if (signal?.aborted) return { ok: false, why: "cancelled" };
    if (raw === null) return { ok: false, why: combined.aborted ? "network" : "invalid-response" };
    let data;
    try { data = JSON.parse(raw); } catch {
      return { ok: false, why: /^\s*</.test(raw) ? "captcha" : "invalid-response" };
    }
    if (!response.ok) return { ok: false, why: [401, 403].includes(response.status) ? "rejected" : "upstream" };
    if (data?.success !== true) {
      // Do not return upstream messages, which can echo submitted secrets.
      return { ok: false, why: data?.success === false ? "rejected" : "invalid-response" };
    }
    if (!allowEmptyData && (!data.data || typeof data.data !== "object" || Array.isArray(data.data))) {
      return { ok: false, why: "invalid-response" };
    }
    if (allowEmptyData && data.data !== undefined && data.data !== null &&
        (typeof data.data !== "object" || Array.isArray(data.data))) {
      return { ok: false, why: "invalid-response" };
    }
    return { ok: true, data: data.data ?? null, headers: response.headers };
  } catch {
    return { ok: false, why: signal?.aborted ? "cancelled" : "network" };
  }
}

// Account replies have no streaming consumer: bound and cancel our own read,
// rather than buffering an unbounded response or exposing its contents.
async function accountBody(response, signal) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let abort;
  const stopped = new Promise((_, reject) => {
    abort = () => reject(new Error("account read stopped"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0, text = "";
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), stopped]);
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 64 * 1024) return null;
      text += decoder.decode(value, { stream: true });
    }
  } catch { return null; }
  finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
  }
}

export async function passwordLogin(base, auth, signal) {
  const username = meta(auth, "username");
  const password = meta(auth, "password");
  if (!required(username) || !required(password)) return { ok: false, why: "missing-password" };
  const result = await requestJSON(base + "/api/user/login", {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username: text(username), password }),
  }, signal);
  if (!result.ok) return result;
  const id = numericId(result.data.id);
  if (!id) return { ok: false, why: result.data.require_2fa ? "verification" : "missing-id" };
  const expected = numericId(meta(auth, "userId"));
  if (expected && expected !== id) return { ok: false, why: "identity" };
  return { ok: true, userId: id, checkedIn: result.data.checked_in, cookies: cookiesOf(result.headers) };
}

async function sessionAccessToken(base, userId, cookie, signal) {
  if (!cookie) return { ok: false, why: "missing-session" };
  const result = await requestJSON(base + "/api/user/self", {
    headers: sessionHeaders(cookie, userId),
  }, signal);
  if (!result.ok) return result;
  const token = text(result.data.access_token);
  if (!tokenValid(token)) return { ok: false, why: "missing-token" };
  return { ok: true, token };
}

function modelKey(value) {
  const key = text(value);
  return key ? (key.startsWith("sk-") ? key : `sk-${key}`) : "";
}

async function listMagpieToken(base, cookie, userId, signal) {
  const result = await requestJSON(`${base}/api/token/?p=0`, {
    headers: sessionHeaders(cookie, userId),
  }, signal);
  if (!result.ok) return result;
  const items = Array.isArray(result.data?.items) ? result.data.items : null;
  if (!items) return { ok: false, why: "invalid-response" };
  const now = Math.floor(Date.now() / 1000);
  const token = items.find(item => item && Number(item.status) === 1 &&
    String(item.name ?? "").trim() === TOKEN_NAME &&
    (Number(item.expired_time) === -1 || Number(item.expired_time) === 0 || Number(item.expired_time) > now));
  return { ok: true, token: token ?? null };
}

async function fullTokenKey(base, token, cookie, userId, signal) {
  const listed = text(token?.key);
  if (listed && usableModelKey(listed)) return { ok: true, key: modelKey(listed) };
  const id = numericId(token?.id);
  if (!id) return { ok: false, why: "missing-key" };
  const result = await requestJSON(`${base}/api/token/${id}/key`, {
    method: "POST", headers: sessionHeaders(cookie, userId),
  }, signal);
  if (!result.ok) return result;
  const key = modelKey(result.data?.key);
  if (!usableModelKey(key)) return { ok: false, why: "missing-key" };
  return { ok: true, key };
}

async function magpieModelKey(base, cookie, userId, signal) {
  if (!cookie) return { ok: false, why: "missing-session" };
  const failure = result =>
    result.why === "cancelled" ||
    ["network", "upstream", "captcha", "invalid-response", "untrusted-site"].includes(result.why)
      ? result : { ok: false, why: "missing-key" };
  let listed = await listMagpieToken(base, cookie, userId, signal);
  if (!listed.ok) return failure(listed);
  if (!listed.token) {
    const created = await requestJSON(`${base}/api/token/`, {
      method: "POST",
      headers: sessionHeaders(cookie, userId, { "Content-Type": "application/json" }),
      body: JSON.stringify(TOKEN_CREATE_BODY),
    }, signal, { allowEmptyData: true });
    if (!created.ok) return failure(created);
    listed = await listMagpieToken(base, cookie, userId, signal);
    if (!listed.ok || !listed.token) return { ok: false, why: "missing-key" };
  }
  const full = await fullTokenKey(base, listed.token, cookie, userId, signal);
  return full.ok ? full : failure(full);
}

export async function tokenBalance(base, auth, signal) {
  const token = text(meta(auth, "accessToken"));
  const id = numericId(meta(auth, "userId"));
  if (!tokenValid(token) || !id) return { ok: false, why: "missing-token" };
  const result = await requestJSON(base + "/api/user/self", {
    headers: { Accept: "application/json", Authorization: token, "New-Api-User": id },
  }, signal);
  if (!result.ok) return result;
  if (String(result.data.id ?? "") !== id) return { ok: false, why: "identity" };
  const number = v => (typeof v === "number" || typeof v === "string" && v.trim()) ? Number(v) : NaN;
  const quota = number(result.data.quota), used = number(result.data.used_quota);
  if (![quota, used, quota + used].every(Number.isFinite) || quota < 0 || used < 0) {
    return { ok: false, why: "missing-quota" };
  }
  return { ok: true, balance: { quota, used, total: quota + used, name: result.data.username || "" } };
}

const BALANCE_FALLBACK_ERRORS = new Set([
  "network", "upstream", "captcha", "invalid-response", "untrusted-site",
]);

// Balance prefers the account's selected site. Only a site-side failure
// falls back to the other trusted AgentRouter site with the same token;
// credential rejection and identity mismatch stay on the site that answered.
export async function tokenBalanceWithFallback(primary, alternate, auth, signal) {
  const first = await tokenBalance(primary, auth, signal);
  if (first.ok || signal?.aborted || primary === alternate || !BALANCE_FALLBACK_ERRORS.has(first.why)) return first;
  return tokenBalance(alternate, auth, signal);
}

export function accountError(why, operation) {
  const reasons = {
    "missing-password": "缺少账号或密码，请重新填写登录信息",
    "missing-token": "没有可用的系统访问令牌，留空时无法从登录会话读取，请填写或稍后重试",
    "missing-key": "无法自动获取或创建名为 magpie 的模型 API Key，请填写 API Key 或稍后重试",
    "missing-session": "登录会话不可用，无法自动获取 API Key 或系统访问令牌，请重试或填写对应字段",
    "missing-id": "登录响应缺少用户 ID，不能确认账号身份",
    "missing-quota": "系统访问令牌的余额接口没有返回有效额度字段",
    verification: "站点要求二次验证，插件不会打开浏览器或绕过验证",
    identity: "凭据对应的账号不一致，请核对账号与系统访问令牌",
    rejected: "站点拒绝了凭据，请核对账号密码或填写的系统访问令牌",
    captcha: "接口被站点验证码拦截，插件不会打开浏览器或绕过验证码",
    cancelled: "操作已取消",
    network: "网络请求失败或超时",
    upstream: "站点暂时不可用",
    "invalid-response": "站点返回格式无法确认",
    "untrusted-site": "账号凭据只能发送到 AgentRouter 国际站或国内站",
  };
  return `AgentRouter：${operation}失败（${reasons[why] || "站点响应异常"}）`;
}

export async function authorizeAccount(inputs, site = "org", signal) {
  if (inputs?.site && !["org", "air"].includes(inputs.site)) {
    return { type: "failed", error: "请选择 AgentRouter 国际站或国内站。" };
  }
  for (const prompt of ACCOUNT_PROMPTS) {
    const error = prompt.validate(inputs?.[prompt.key]);
    if (error) return { type: "failed", error };
  }
  const username = text(inputs.username);
  const password = inputs.password;
  const providedKey = text(inputs.apiKey);
  const providedToken = text(inputs.accessToken);
  if (providedKey && providedToken && providedKey === providedToken) {
    return { type: "failed", error: "API Key 与系统访问令牌用途不同，不能填写为同一个值。" };
  }
  const selected = site === "air" || inputs?.site === "air" ? "air" : "org";
  const base = SITES[selected].site;
  const login = await passwordLogin(base, { metadata: { username, password } }, signal);
  if (!login.ok) return { type: "failed", error: accountError(login.why, "登录") };

  let accessToken = providedToken;
  if (!accessToken) {
    const derived = await sessionAccessToken(base, login.userId, login.cookies, signal);
    if (!derived.ok) return { type: "failed", error: accountError(derived.why, "自动读取系统访问令牌") };
    accessToken = derived.token;
  }

  let key = providedKey;
  if (!key) {
    const derived = await magpieModelKey(base, login.cookies, login.userId, signal);
    if (!derived.ok) return { type: "failed", error: accountError(derived.why, "自动获取模型 API Key") };
    key = derived.key;
  }

  const metadata = { site: selected, username, password, accessToken, userId: login.userId,
    ...(selected === "air" ? { apiBase: `${SITES.air.api}/v1` } : {}) };
  // Check the token against the login identity without re-logging in.
  // Prefer the selected site and fall back to the other trusted site only
  // when that site is unavailable.
  const primary = SITES[selected].site;
  const alternate = selected === "air" ? SITES.org.site : SITES.air.site;
  const balance = await tokenBalanceWithFallback(primary, alternate, { metadata }, signal);
  if (!balance.ok && balance.why !== "missing-quota") {
    return { type: "failed", error: accountError(balance.why, "系统访问令牌验证") };
  }
  return { type: "success", key, metadata };
}

export async function passwordCheckin(base, auth, signal) {
  if (!numericId(meta(auth, "userId"))) {
    return { outcome: "ineligible", message: accountError("missing-id", "签到") };
  }
  const result = await passwordLogin(base, auth, signal);
  if (!result.ok) {
    const ineligible = ["missing-password", "missing-id", "rejected", "identity", "verification"].includes(result.why);
    return { outcome: result.why === "captcha" ? "captcha" : ineligible ? "ineligible" : "failed",
      message: accountError(result.why, "签到"),
      ...(result.why === "rejected" ? { signIn: "expired" } : {}) };
  }
  if (result.checkedIn === true) return { outcome: "claimed", message: "AgentRouter：登录成功，站点报告 checked_in=true（已签到）；新增额度和金额以站点账单为准" };
  if (result.checkedIn === false) return { outcome: "done", message: "AgentRouter：登录成功，本次未新增签到额度（checked_in=false）" };
  return { outcome: "failed", message: "AgentRouter：登录成功但没有有效签到标记，无法确认额度发放" };
}
