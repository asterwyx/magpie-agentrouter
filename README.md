# magpie-agentrouter

[English](#english) · [中文](#中文)

<a id="english"></a>
## English

A Magpie provider plugin for AgentRouter. It lets you use AgentRouter models in Magpie, read the account balance, and enable daily check-in.

### Features

- Sign in with an AgentRouter international-site or China-site account.
- View and use the AgentRouter models available to the account.
- Read the account balance.
- Enable daily check-in scheduled by Magpie.

### Install

Add this address on Magpie's plugin page:

```text
github:asterwyx/magpie-agentrouter
```

Or run this from a terminal that can reach Magpie:

```bash
magpie plugin add github:asterwyx/magpie-agentrouter
```

After installation, sign in on the AgentRouter provider page.

### Sign in

1. Choose **AgentRouter international site** or **China site**.
2. Fill in four separate fields:
   - AgentRouter account
   - Account password
   - API Key
   - System access token

The four credentials have different jobs and cannot replace one another:

- The account and password are used for sign-in and check-in.
- The API Key is used for the model list and model calls.
- The system access token is used for balance queries.

The site choice decides which AgentRouter site is used for models and sign-in; check-in also uses the selected site. Balance queries prefer the selected site and automatically try the other site when the selected one is temporarily unavailable.

You can also sign in from a terminal:

```bash
magpie plugin login agentrouter
```

OAuth, browser authorization, and Cookie sign-in are not supported.

### Usage

#### Models

Choose an AgentRouter model in Magpie. Availability follows the account's actual model list; after a refresh in Magpie, use the updated list.

#### Balance

View it on the provider page, or run:

```bash
magpie quota agentrouter
```

If the balance cannot be read, Magpie shows "remaining quota unknown". The plugin does not derive a balance from the password or API Key.

#### Daily check-in

Enable AgentRouter daily check-in in Magpie. Magpie schedules it once a day; the plugin signs in with the account password and reads the site's check-in state. No separate local timer is needed.

### Optional setting

When AgentRouter rate-limits a request, the plugin reports a suggested wait time, 10 seconds by default. To change it, set `retryAfterSeconds` in Magpie's plugin options.

### FAQ

**No models are shown.**

Check that the API Key is correct. The model list follows what the account can actually use.

**The balance is unknown.**

The site endpoint may be temporarily unavailable, may return a verification page, or the system access token may need updating. Try again later; this does not necessarily mean the account is invalid.

**Sign-in fails.**

Check all four fields: account, password, API Key, and system access token. The account password and API Key are not interchangeable.

**Why does the provider appear as `agentrouter-plugin`?**

Magpie already has an older provider with the same ID. The plugin still works; remove or rename the old provider to restore the `agentrouter` prefix.

### Credential safety

The four credentials are stored on the server running Magpie, not only in the browser. Use them only on a trusted server and protect Magpie's data directory. Do not post credentials in chats, screenshots, issues, or Git repositories.

### Links

- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [MIT License](LICENSE)

<a id="中文"></a>
## 中文

AgentRouter 的 Magpie 提供商插件。安装后可以在 Magpie 中使用 AgentRouter 模型、查看余额，并启用每日签到。

### 功能

- 使用 AgentRouter 国际站或国内站账号登录。
- 在 Magpie 中查看和使用账号可用的 AgentRouter 模型。
- 查看账号余额。
- 由 Magpie 调度每日签到。

### 安装

在 Magpie 的插件页面添加：

```text
github:asterwyx/magpie-agentrouter
```

也可以在能访问 Magpie 的终端执行：

```bash
magpie plugin add github:asterwyx/magpie-agentrouter
```

安装后，在 Magpie 的 AgentRouter 提供商页面登录。

### 登录

1. 选择 **AgentRouter 国际站** 或 **国内站**。
2. 依次填写四个字段：
   - AgentRouter 账号
   - 账号密码
   - API Key
   - 系统访问令牌

四项凭据用途不同，不能互相替代：

- 账号和密码用于登录和签到。
- API Key 用于模型列表和模型调用。
- 系统访问令牌用于查询余额。

站点选择决定模型和登录使用哪个 AgentRouter 站点，签到也使用所选站点。余额查询优先使用所选站点，站点暂时不可用时自动尝试另一个站点。

也可以在终端登录：

```bash
magpie plugin login agentrouter
```

不支持 OAuth、浏览器授权或 Cookie 登录。

### 使用

#### 模型

在 Magpie 中选择 AgentRouter 模型即可。可用模型以账号实际返回的列表为准；列表变化时，以 Magpie 中刷新后的结果为准。

#### 余额

在 Magpie 的提供商页面查看，或执行：

```bash
magpie quota agentrouter
```

余额读取失败时会显示“剩余额度未知”，不会用密码或 API Key 推算余额。

#### 每日签到

在 Magpie 中开启 AgentRouter 的每日签到。Magpie 负责按日调度，插件使用账号密码登录并读取站点的签到状态，不需要额外的本地定时任务。

### 可选设置

遇到限流时，插件会返回建议等待时间，默认 10 秒。需要调整时，在 Magpie 的插件选项中设置 `retryAfterSeconds`。

### 常见问题

**看不到模型？**

检查 API Key 是否填写正确。模型列表以账号实际可用的模型为准。

**余额显示未知？**

可能是站点接口暂时不可用、返回了验证页面，或系统访问令牌需要更新。稍后重试；这不代表账号一定失效。

**登录失败？**

核对账号、密码、API Key 和系统访问令牌四项内容。账号密码与 API Key 不能混用。

**为什么提供商显示为 `agentrouter-plugin`？**

Magpie 中已有同 ID 的旧提供商。插件仍可正常使用；如需恢复 `agentrouter` 前缀，可移除或重命名旧提供商。

### 凭据安全

四项凭据保存在运行 Magpie 的服务器上，不会只留在浏览器。请只在可信服务器使用，并保护 Magpie 的数据目录；不要把凭据发到聊天、截图、Issue 或 Git 仓库。

### 链接

- [贡献指南](CONTRIBUTING.md)
- [变更记录](CHANGELOG.md)
- [MIT 许可证](LICENSE)
