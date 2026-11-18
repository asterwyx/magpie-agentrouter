# 变更记录

[English](CHANGELOG.md) · [中文](CHANGELOG.zh_CN.md)

## 0.6.0 — 2026-11-19

- 余额查询优先使用所选站点；遇到网络、上游错误、验证码、非 JSON 或不可信站点等站点侧失败时，使用同一系统访问令牌回退到另一个受信任的 AgentRouter 站点。
- 凭据被拒绝或身份不一致时不回退；登录和签到仍使用所选站点。
- 不改变模型、请求头或签到行为。

## 0.5.1 — 2026-11-19

- 从默认登录前回退列表移除 GPT-6 Astra。AgentRouter 实时 `/v1/models` 只提供 GPT-5.6 Sol 和 GPT-6.1 Sol。
- 如果站点以后重新提供 Astra，保留其目录元数据。
- 不改变请求、认证、余额或签到行为。

## 0.5.0 — 2026-11-19

- 移除 `portable-responses`：插件不再重写 Responses 历史或移除资源绑定条目 ID。
- 移除 `codex-session-repair`、`src/request.mjs` 和 `src/session-repair.mjs`：请求正文原样转发。
- 提供商不再提供布尔选项。
- 保留有界响应诊断和 Codex CLI 预设请求头。
- 不改变认证、余额、签到或模型路由行为。

## 0.4.0 — 2026-11-18

- 移除 `send-codex-headers` 选项，模型请求始终发送 Magpie 的 Codex CLI 预设：`User-Agent: codex_cli_rs/0.167.0 (Mac OS 26.6.0; arm64) Apple_Terminal/455`、`originator: codex_cli_rs`、`version: 0.167.0` 和 `Accept: application/json`。
- 自定义 metadata 请求头可以增加其他字段，但不能替换这四个。
- 不改变认证、余额、签到或模型路由行为。

## 0.3.0 — 2026-11-18

- 余额始终从国际站 `https://agentrouter.org/api/user/self` 读取，包括国内站账号；登录时的令牌校验也一样。
- 登录和签到仍使用所选站点；模型发现和推理根地址不变。
- 除余额地址外，不改变凭据、模型或签到请求行为。

## 0.2.1 — 2026-11-18

- 回退 0.2.0 的账户名改动：`usage()` 不再返回登录邮箱，新登录不再保存 `metadata.email`。
- 恢复 Magpie 根据 API Key 生成的账户标签。
- 不改变认证、模型、余额或签到请求行为。

## 0.2.0 — 2026-11-18

- 将 AgentRouter 登录邮箱显示为 Magpie 账户名，而不是 API Key 掩码或站点内部用户名；余额读取失败时也保留这个名称。
- 新登录将邮箱保存为 `metadata.email`。已有账号可重新登录，或运行 `magpie accounts alias` 显示邮箱。
- 与 0.1.5 相比，不改变认证、模型、余额或签到请求行为。

## 0.1.5 — 2026-11-18

- 完整移除本地 content-filter 功能：过滤模块、示例文件、`text-filter` 插件选项、请求改写分支、测试、文档和忽略规则。
- 保留上游内容拒绝诊断、Responses 内联重放和可选 Codex 会话清理。
- 与 0.1.4 相比，不改变认证、模型、余额或签到行为。

## 0.1.4 — 2026-11-18

- 将 AgentRouter 源图标移动到 `assets/agentrouter.png`，并包含在发布包中。
- 保留 Magpie 插件/提供商图标的内嵌 PNG data URI。
- 与 0.1.3 相比，不改变运行时行为。

## 0.1.3 — 2026-11-18

- 移除可选的独立本地签到工具，包括 Windows ACL 实现、测试、文档和 CI fixture 步骤。Magpie 的账号密码 `auth.checkin` 仍是唯一签到路径。
- 将运行时模块移动到 `src/`，所有测试移动到 `test/`；包入口使用 `src/index.mjs`。
- 将 text-filter 示例移动到过滤器实现旁的 `src/content-filter.example.json`。
- 与 0.1.2 相比，不改变运行时认证行为。

## 0.1.2 — 2026-11-18

- 移除已废弃的 GitHub、OAuth 和独立系统令牌登录方式的旧测试夹具、CI 警告和文档引用。
- 保留凭据边界回归测试，防止登录凭据、Cookie 和管理令牌进入模型请求。
- 与 0.1.1 相比，不改变运行时认证行为。

## 0.1.1 — 2026-11-18

- 将合并的 JSON 凭据字段替换为四个独立原生字段：账号、密码、API Key 和系统访问令牌。
- 将 AgentRouter 国内站 favicon 作为 PNG data URI 内嵌，安装后的插件和提供商图标无需远程请求。
- 保留两个站点按钮、凭据分离、实时模型元数据、余额、签到以及请求/响应兼容性。

## 0.1.0 — 初始 Magpie 发布

- 将独立仓库/包重命名为 `magpie-agentrouter`；插件和提供商显示名为 AgentRouter，提供商/模型前缀默认是 `agentrouter`。
- 提供两个站点按钮（国际站/国内站），随后是四个独立原生凭据字段：账号、密码、API Key 和系统访问令牌。没有 JSON 包或合并文本框。
- 保持凭据职责分离：密码用于登录/签到，API Key 用于模型发现和调用，系统访问令牌用于余额。
- 合并所选账号实时 `/v1/models` 响应和 `/api/pricing` 端点数据，以及已知 `models.dev` 能力、上下文限制、模态和推理档位。未知模型信息保持未指定，不猜测。
- 使用 AgentRouter 国内站 favicon（`/logo.png`）作为包和提供商图标。
- 保留 Magpie 调度的每日签到、显式余额读取、Responses 请求处理、有界诊断、本地文字过滤和可选会话清理。
- 在 `main` 上重建 Git 历史；新仓库不是 GitHub fork。
