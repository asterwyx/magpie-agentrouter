# Contributing

[English](CONTRIBUTING.md) · [中文](CONTRIBUTING.zh-CN.md)

Thanks for helping improve `magpie-agentrouter`.

## Development

- Use Node.js 20 or later.
- Run `npm test`, `npm run test:policy`, and `npm pack --dry-run` before opening a pull request.
- Optional Magpie UI integration tests require an isolated loopback instance and fake AgentRouter endpoints. Never point them at a production account.
- Keep lines in commit messages and documentation readable. Do not commit account credentials, tokens, cookies, provider auth files, test captures, or generated package archives.
- Model capability and context metadata must cite or follow a live endpoint or the exact `models.dev` record. Leave unknown fields unset rather than guessing.

## Fix and release rules

- Make the smallest change that fixes the reported problem. Do not refactor unrelated code in the same change.
- One fix, one commit. Each fix commit includes its regression test and a focused message.
- One fix, one small version. Bump the smallest version component for each released fix: for example `0.1.0` → `0.1.1`, then `0.1.2`.
- Push a completed fix to `main` immediately when its checks pass and no known issue remains.
- Keep the version bump in its own release commit, then create the matching Git tag and release.
- Do not combine unrelated fixes, documentation rewrites, or formatting into a fix commit.

## Pull requests

Open a pull request against `main`. Explain the behavior change, compatibility impact, and verification performed. Link an issue when relevant. Do not include real API keys, passwords, access tokens, private messages, or production account responses in the PR.

## Security reports

Use GitHub's private security advisory for this repository. Do not disclose vulnerabilities, credentials, exploit samples, or private data in public issues or discussions.
