# 可选本地账号密码签到工具

普通 Magpie 部署在提供商开启自动签到即可，不需要此工具。此工具只用于希望以独立 Node.js 进程调度签到的用户。

**不再支持 GitHub Cookie/OAuth。** 它调用与插件相同的账号密码签到 hook，不打开浏览器，不读取浏览器登录态，不破解验证码。

## 初始化

```bash
node local-checkin.mjs init
```

默认数据目录：Linux/macOS 为 `~/.local/share/agentrouter-checkin`，Windows 为 `%LOCALAPPDATA%/AgentRouterCheckin`。通过 `--home` 可指定仓库外的绝对路径。目录禁止位于任何 Git 仓库内。

初始化只创建空模板，已有文件不覆盖。请用你信任的本地编辑器维护：

- `config.json`：`version: 1`、`site: "org"`（或 `"air"`）、`userId`（插件成功配置后自动保存的用户 ID）。
- `credentials.json`：仅有 `username` 和 `password` 两个字符串字段。

不要把密码放在命令行、聊天、环境变量示例或代码中。工具不需要 API Key 或系统访问令牌，因为它只签到、不获取模型或余额。

## 运行

```bash
node local-checkin.mjs status
node local-checkin.mjs run
node local-checkin.mjs watch
```

- `run` 最多每 24 小时尝试一次；在网络请求前持久化预约，避免崩溃后重复尝试。
- `watch` 每分钟检查本地状态，仅在到期时尝试签到；不是每分钟登录。
- `claimed` / `done` 允许下一次到期签到。
- `failed` / `ineligible` / `captcha` 暂停；不会打开浏览器或自动反复重试。
- `state.json` 不保存密码、响应正文、错误原文或 Cookie。

人工修复凭据或站点问题后：

```bash
node local-checkin.mjs resume
```

`resume` 不请求网络，不移除原 24 小时冷却。更换账号需要核对 ID，再显式 resume；不能用旧账号的状态虚报新账号签到。

Linux/macOS 目录保持 `0700`，文件初始为 `0600`。Windows 使用原生 ACL 检查当前用户与受信任系统主体；共享权限拒绝执行。符号链接、硬链接、无效 JSON、损坏状态及变化后的锁均拒绝，不自动删除未知锁。

旧 `github-cookie.txt` 文件不读取、不迁移、不删除。请自行妥善清理不再需要的 GitHub 高权限 Cookie，勿提交至仓库。配置和运行工具需要自己有权使用的 AgentRouter 账号。
