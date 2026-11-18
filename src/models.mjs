// Metadata is taken from Magpie's models.dev catalog, upstream model-provider
// documentation for the GPT family, and live AgentRouter /api/pricing plus
// /v1/models responses. Fields absent from those sources stay absent.
export const MODEL_CATALOG = {
  // Public model-provider specifications provide these limits/capabilities;
  // live /v1/models still decides whether the selected account can use them.
  "gpt-6.1-sol": {
    name: "GPT-6.1 Sol",
    description: "Near-Astra performance for complex work at a lower cost",
    family: "gpt-sol",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh", "max"] }],
    tool_call: true,
    structured_output: true,
    temperature: true,
    knowledge: "2026-04-30",
    modalities: { input: ["text", "image"], output: ["text"] },
    attachment: true,
    limit: { context: 1_050_000, input: 922_000, output: 128_000 },
    provider: { npm: "@ai-sdk/openai", api: "https://agentrouter.org/v1" },
  },
  "gpt-6-astra": {
    name: "GPT-6 Astra",
    description: "Reasoning model for complex coding and professional work",
    family: "gpt-sol",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh", "max"] }],
    tool_call: true,
    structured_output: true,
    temperature: true,
    knowledge: "2026-04-30",
    modalities: { input: ["text", "image"], output: ["text"] },
    attachment: true,
    limit: { context: 1_050_000, input: 922_000, output: 128_000 },
    provider: { npm: "@ai-sdk/openai", api: "https://agentrouter.org/v1" },
  },
  "gpt-5.6-sol": {
    name: "GPT-5.6 Sol",
    description: "Frontier GPT-5.6 model for complex professional work, coding, and agentic workflows",
    family: "gpt-sol",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["none", "low", "medium", "high", "xhigh", "max"] }],
    tool_call: true,
    structured_output: true,
    temperature: true,
    knowledge: "2026-02-16",
    release_date: "2026-07-09",
    modalities: { input: ["text", "image"], output: ["text"] },
    attachment: true,
    limit: { context: 1_050_000, input: 922_000, output: 128_000 },
    provider: { npm: "@ai-sdk/openai", api: "https://agentrouter.org/v1" },
  },
  "glm-5.3": {
    name: "GLM-5.3",
    description: "Flagship GLM model for long-horizon coding, agents, and complex project delivery",
    family: "glm",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["low", "high", "max"] }],
    tool_call: true,
    structured_output: true,
    temperature: true,
    release_date: "2026-08-14",
    modalities: { input: ["text"], output: ["text"] },
    attachment: false,
    limit: { context: 1_000_000, output: 131_072 },
    open_weights: true,
  },
  "claude-opus-4-8": {
    name: "Claude Opus 4.8",
    description: "Top Claude Opus tier for the hardest reasoning, coding, and long-horizon agents",
    family: "claude-opus",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh", "max"] }],
    tool_call: true,
    temperature: false,
    knowledge: "2026-01",
    release_date: "2026-05-28",
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    attachment: true,
    limit: { context: 1_000_000, output: 128_000 },
    provider: { npm: "@ai-sdk/anthropic", api: "https://agentrouter.org/v1" },
  },
  "claude-opus-5": {
    name: "Claude Opus 5",
    description: "Strongest Claude Opus model for coding, agents, and professional work",
    family: "claude-opus",
    reasoning: true,
    reasoning_options: [{ type: "effort", values: ["low", "medium", "high", "xhigh", "max"] }],
    tool_call: true,
    temperature: false,
    knowledge: "2026-05",
    release_date: "2026-07-24",
    modalities: { input: ["text", "image", "pdf"], output: ["text"] },
    attachment: true,
    limit: { context: 1_000_000, output: 128_000 },
    provider: { npm: "@ai-sdk/anthropic", api: "https://agentrouter.org/v1" },
  },
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash",
    description: "Fast DeepSeek V4 lane for economical reasoning, coding, and long-context work",
    family: "deepseek-flash",
    reasoning: true,
    reasoning_options: [{ type: "toggle" }, { type: "effort", values: ["low", "high", "max"] }],
    tool_call: true,
    structured_output: true,
    temperature: true,
    knowledge: "2025-05",
    release_date: "2026-04-24",
    modalities: { input: ["text"], output: ["text"] },
    attachment: false,
    limit: { context: 1_000_000, output: 384_000 },
    open_weights: true,
  },
};

// Last successful public pricing snapshot is a safe pre-login fallback. A
// signed-in account's /v1/models list always decides what it actually serves.
export const PRICING_FALLBACK = [
  { model_name: "gpt-5.6-sol", supported_endpoint_types: ["openai"] },
  { model_name: "gpt-6.1-sol", supported_endpoint_types: ["openai"] },
  { model_name: "gpt-6-astra", supported_endpoint_types: ["openai"] },
];

export function enrichModel(model, pricing = {}) {
  const id = String(model?.id ?? model?.name ?? model?.model_name ?? pricing?.model_name ?? "");
  if (!id) return null;
  const catalog = MODEL_CATALOG[id] ?? {};
  const result = { ...catalog, name: model?.name ?? model?.display_name ?? catalog.name ?? id };
  const context = Number(model?.context_length ?? model?.context_window ?? model?.limit?.context);
  const input = Number(model?.max_input_tokens ?? model?.limit?.input);
  const output = Number(model?.max_output_tokens ?? model?.max_tokens ?? model?.limit?.output);
  const liveLimit = {
    ...(Number.isSafeInteger(context) && context > 0 ? { context } : {}),
    ...(Number.isSafeInteger(input) && input > 0 ? { input } : {}),
    ...(Number.isSafeInteger(output) && output > 0 ? { output } : {}),
  };
  if (Object.keys(liveLimit).length) result.limit = { ...(catalog.limit ?? {}), ...liveLimit };
  if (Array.isArray(model?.supported_endpoint_types) && model.supported_endpoint_types.length) {
    result.endpoints = [...model.supported_endpoint_types];
  } else if (Array.isArray(pricing?.supported_endpoint_types) && pricing.supported_endpoint_types.length) {
    result.endpoints = [...pricing.supported_endpoint_types];
  }
  const reasoningOptions = model?.reasoning_options ?? catalog.reasoning_options ?? [];
  const effort = reasoningOptions.find(x => x.type === "effort" && Array.isArray(x.values))?.values;
  if (effort?.length) result.variants = Object.fromEntries(effort.map(value => [value, {}]));
  const canonical = String(model?.canonical_model_id ?? catalog.canonical_model_id ?? "");
  const endpointTypes = result.endpoints ?? [];
  // "openai" covers both Chat Completions and Responses in AgentRouter's
  // pricing data, so it alone cannot choose between their SDK packages.
  const endpointNpm = endpointTypes.length > 0 && !endpointTypes.includes("openai")
    && endpointTypes.includes("anthropic") ? "@ai-sdk/anthropic" : undefined;
  const defaultNpm = canonical.startsWith("openai/") || (!canonical && id.startsWith("gpt-")) ? "@ai-sdk/openai"
    : canonical.startsWith("anthropic/") ? "@ai-sdk/anthropic"
      : endpointNpm ?? catalog.provider?.npm ?? "@ai-sdk/openai-compatible";
  const provider = model?.provider && typeof model.provider === "object" ? model.provider : catalog.provider;
  result.provider = {
    npm: provider?.npm ?? defaultNpm,
    api: model?.api ?? provider?.api,
  };
  if (model?.description) result.description = model.description;
  if (model?.modalities) result.modalities = model.modalities;
  for (const name of ["reasoning", "tool_call", "attachment", "structured_output", "temperature"]) {
    if (typeof model?.[name] === "boolean") result[name] = model[name];
  }
  return result;
}
