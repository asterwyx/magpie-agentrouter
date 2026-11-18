# Contributing

Thanks for helping improve `magpie-agentrouter`.

## Development

- Use Node.js 20 or later.
- Run `npm test`, `npm run test:policy`, `npm run test:headers`, and `npm pack --dry-run` before opening a pull request.
- Optional Magpie UI integration tests require an isolated loopback instance and fake AgentRouter endpoints. Never point them at a production account.
- Keep lines in commit messages and documentation readable. Do not commit account credentials, tokens, cookies, provider auth files, local content filters, test captures, or generated package archives.
- Model capability/context metadata must cite or follow a live endpoint or the exact `models.dev` record. Leave unknown fields unset rather than guessing.

## Pull requests

Open a pull request against `main`. Explain the behavior change, compatibility impact, and verification performed. Link an Issue when relevant. Do not include real API keys, passwords, access tokens, private messages, or production account responses in the PR.

## Security reports

Use GitHub's private security advisory for this repository. Do not disclose vulnerabilities, credentials, exploit samples, or private data in public issues or discussions.
