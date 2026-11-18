# AGENTS.md

## Project Overview

- `magpie-agentrouter` is a Magpie provider plugin for AgentRouter models, account/password login, balance, and daily check-in.
- Runtime is ESM JavaScript on Node.js 20+. There is no build step; Magpie loads `src/index.mjs` through Bun.
- Authentication is one flow: two site buttons, then four separate native fields. Magpie renders prompts one at a time; never replace them with a JSON credential bundle.
- The plugin name and provider display name are **AgentRouter**. The declared provider ID/model prefix is `agentrouter`; Magpie may append `-plugin` when an older provider occupies that ID.

## Repository Map

| Path | Responsibility |
|---|---|
| `src/index.mjs` | Plugin entry, auth methods, model loading, balance, check-in, options, request headers |
| `src/account.mjs` | Credential validation, password login, user-ID verification, balance, password check-in |
| `src/models.mjs` | Model catalog and enrichment with live AgentRouter/pricing data |
| `src/request.mjs` | Responses inline replay and optional Codex session repair |
| `src/response.mjs` | Bounded upstream error diagnosis and stream handling |
| `src/session-repair.mjs` | Optional, explicitly enabled resource-binding cleanup |
| `src/body-inspection.mjs` | Bounded request-body inspection |
| `test/` | All Node/Python tests and fixtures; no production tests |
| `assets/agentrouter.png` | AgentRouter source icon; `package.json` also embeds it as data URI |
| `docs/OPTIMIZATION.md` | Current design boundaries and evidence sources |
| `README.md` | User-facing install, configuration, balance, and check-in instructions |
| `CHANGELOG.md` | Versioned user-visible changes |
| `.github/workflows/ci.yml` | Ubuntu/Windows × Node 20/22/24 CI |
| `set-ar-headers.sh` | Optional header utility; test it with `test/set-ar-headers.test.py` |

## Commands

Run from the repository root.

| Task | Command |
|---|---|
| Full Node test suite | `npm test` |
| Focused auth tests | `node --test test/auth-flow.test.mjs test/auth-guidance.test.mjs test/checkin.test.mjs` |
| Focused model tests | `node --test test/models.test.mjs` |
| Focused session-repair tests | `node --test test/session-repair.test.mjs` or `npm run test:session-repair` |
| PR policy tests | `npm run test:policy` |
| Python header tests | `npm run test:headers` (CI runs `python test/set-ar-headers.test.py`) |
| Package contents check | `npm pack --dry-run` |
| Syntax check | `node --check src/index.mjs` |
| Optional Magpie UI test | `npm run test:magpie-ui` (only in an isolated loopback sandbox) |

## Change Rules

- Make the smallest change that fixes the reported problem; do not mix in unrelated refactoring or formatting.
- One fix, one commit, with a focused message and a regression test. Keep the release commit separate.
- Preserve the current source/test split: runtime modules in `src/`, tests in `test/`. Tests import from `../src/...`.
- When moving files, update relative imports, `package.json` `main`/`exports`/`files`, test scripts, CI commands, and documentation together.
- Do not add runtime dependencies without a demonstrated need; current implementation uses Node built-ins.
- Do not use `keyless: true` for sign-in methods. Magpie treats it as a public/shared account. Native password prompts must remain masked.
- Keep only three provider options: `send-codex-headers`, `portable-responses`, and `codex-session-repair`.
- Preserve bounded reads, request/response compatibility, and no automatic model-request retries. Do not reintroduce plugin-driven retries, account switching, or lossy history cleanup by default; Magpie's own routing is outside this rule.
- Do not silently change a public field's meaning. If behavior changes, update tests and the user documentation in the same change.

## Authentication and Security Invariants

- Username/password is used **only** for login and `auth.checkin`; API Key is used **only** for model discovery and model calls; system access token is used **only** for balance.
- The user ID comes from the successful login response and is verified on subsequent balance/check-in calls. Do not add a separate user-ID prompt.
- Never use another credential as a fallback, never borrow a Cookie, and never send the four credentials together.
- Never send account credentials to a host outside the two AgentRouter origins. Do not follow account-endpoint redirects.
- Reject non-success HTTP status, invalid envelopes, mismatched identities, CAPTCHA, timeouts, and unexpected response shapes without claiming success.
- Account responses are capped at 64 KiB and requests at 30 seconds. Never echo submitted secrets or raw upstream error text in errors, logs, or fixtures.
- Save the model API Key only in the account's `key` field. Password and system token stay in metadata for their own hooks.
- Do not reintroduce OAuth, browser callbacks, GitHub Cookie flows, standalone system-token login, automatic model-Key lookup, token generation, a separate local check-in tool, or local content filtering.
- Never commit or print real credentials, provider auth files, private prompts, or user conversation data. Tests use synthetic credentials and no real network.

## Model Metadata Rules

- The account's `/v1/models` response decides which models are actually exposed to that account.
- The selected site's `/api/pricing` provides current pricing catalogue entries and endpoint types, not proof of availability or full capabilities.
- Use exact model-ID `models.dev` entries and documented model-provider specifications for context, modalities, tools, and reasoning tiers.
- Live model fields override catalog metadata. Unknown context/output/reasoning fields stay absent; never invent generic values.
- Honor account/group restrictions and changing upstream availability; do not force every pricing-catalogue model into an account list.
- Preserve per-model SDK mapping and API roots: Responses for OpenAI, Anthropic Messages for Anthropic, and OpenAI-compatible where appropriate. Anthropic-only live models must not be sent through the OpenAI-compatible fallback.
- AgentRouter may reject a supported upstream protocol on a specific model; a model listing or capability is not a guarantee of call success.

## Testing Rules

- Use Node's built-in `node:test` with deterministic fixtures. Test public behavior, not implementation trivia.
- New or changed behavior requires a regression test, including invalid credentials, identity mismatch, HTTP failure, cancellation, and untrusted responses when relevant.
- Restore `globalThis.fetch` and other globals in `t.after`; never let a test use real network or real account state.
- Run focused tests for the changed area first, then the full verification set:
  `npm test`, `npm run test:policy`, `npm run test:headers`, `npm pack --dry-run`, and `git diff --check`.
- Optional `test:magpie-ui` requires a fresh isolated Magpie instance, fake AgentRouter endpoints, a loopback URL, and no real credentials. Set `MAGPIE_TEST_WEB_URL`, `MAGPIE_TEST_WEB_KEY`, and `PLAYWRIGHT_MODULE` explicitly.
- Do not report a test as passed unless it actually ran. Distinguish unit tests, simulated Magpie interactions, and real production checks.
- CI also validates Ubuntu and Windows on Node 20/22/24. For CI failures, inspect the actual failing job log before editing code.

## Git and Release

- After a fix passes verification and has no known remaining issue, push it to `main` promptly. Do not force-push or rewrite the remote history.
- Each released fix gets its own smallest version bump: `0.1.0` → `0.1.1` → `0.1.2`, and so on.
- Put version number, `CHANGELOG.md`, and release notes in a separate release commit. Push that commit, create the matching `vX.Y.Z` tag, then create the GitHub release.
- Documentation-only or CI-only changes do not require a version bump unless they change package behavior. Do not create a release solely for a CI path correction.
- Before release, the tree must be clean and all verification must pass. Do not publish unverified code, real credentials, private data, or unsupported claims.
- Release notes describe only verified behavior and current limitations; they are not a substitute for tests.

## Completion Report

- State modified files, the smallest behavioral change, commands run, and exact test/CI results.
- Separate simulated verification from real Magpie/account verification and list what was not checked.
- Report remaining gaps honestly: provider-ID collisions, live domestic-site checks, npm authentication, and whether Magpie's daily check-in is enabled.
- Never claim installation, authentication, model metadata, balance, or check-in is verified merely because code loads or an account was saved.

## References

- `README.md`: install and current user behavior.
- `docs/OPTIMIZATION.md`: current architecture, boundaries, and evidence sources.
- `CONTRIBUTING.md`: contributor workflow and fix/release rules.
- `SECURITY.md`: private reporting and secret-handling requirements.
- `.github/workflows/ci.yml`: CI matrix and exact commands.
