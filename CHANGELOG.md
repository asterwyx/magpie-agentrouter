# Changelog

## 0.4.0 — 2026-11-18

- Remove the `send-codex-headers` option and always send Magpie's Codex CLI preset on model requests: `User-Agent: codex_cli_rs/0.167.0 (Mac OS 26.6.0; arm64) Apple_Terminal/455`, `originator: codex_cli_rs`, `version: 0.167.0`, and `Accept: application/json`.
- Custom metadata headers can add other fields but cannot replace these four.
- No authentication, balance, check-in, or model routing behavior changes.

## 0.3.0 — 2026-11-18

- Always read balance from the international site `https://agentrouter.org/api/user/self`, including for domestic-site accounts; token validation at sign-in does the same.
- Keep login and check-in on the selected site; model discovery and inference roots are unchanged.
- No credential, model, or check-in request behavior changes beyond the balance URL.

## 0.2.1 — 2026-11-18

- Revert the 0.2.0 account-name change: `usage()` no longer returns the login email, and new sign-ins no longer save `metadata.email`.
- Restore the account label Magpie derives from the API key.
- No authentication, model, balance, or check-in request behavior changes.

## 0.2.0 — 2026-11-18

- Show the AgentRouter login email as the Magpie account name instead of the API-key mask or the vendor's internal username, including when a balance read fails.
- Save the login email as `metadata.email` on new sign-ins. An existing account can be signed in again or given `magpie accounts alias` to show it.
- No authentication, model, balance, or check-in request behavior changes from 0.1.5.

## 0.1.5 — 2026-11-18

- Remove the local content-filter feature completely: filter module, example file, `text-filter` plugin option, request-rewrite branch, tests, docs, and ignore rules.
- Keep upstream content-blocked response diagnostics, Responses inline replay, and optional Codex session repair.
- No authentication, model, balance, or check-in behavior changes from 0.1.4.

## 0.1.4 — 2026-11-18

- Move the AgentRouter source icon to `assets/agentrouter.png` and include it in the published package.
- Keep the embedded PNG data URI for the Magpie plugin/provider icon.
- No runtime behavior changes from 0.1.3.

## 0.1.3 — 2026-11-18

- Remove the optional standalone local check-in tool, including its Windows ACL implementation, tests, documentation, and CI fixture step. Magpie's account/password `auth.checkin` hook remains the only check-in path.
- Move runtime modules to `src/` and all test files to `test/`; package entry points now use `src/index.mjs`.
- Move the text-filter example beside the filter implementation at `src/content-filter.example.json`.
- No runtime authentication behavior changes from 0.1.2.

## 0.1.2 — 2026-11-18

- Remove stale test fixtures, CI warnings, and documentation references for retired GitHub, OAuth, and standalone system-token login methods.
- Keep the credential-boundary regression that prevents login credentials, cookies, and management tokens from entering model requests.
- No runtime authentication behavior changes from 0.1.1.

## 0.1.1 — 2026-11-18

- Replace the combined JSON credential field with four separate native fields: username, password, API Key, and system access token.
- Embed the AgentRouter China site favicon as a PNG data URI so the installed plugin and provider icons load without a remote request.
- Keep the two site buttons, credential separation, live model metadata, balance, check-in, and request/response compatibility unchanged.

## 0.1.0 — initial Magpie release

- Rebrand the standalone repository/package to `magpie-agentrouter`; plugin and provider display name are AgentRouter, provider/model prefix defaults to `agentrouter`.
- Offer two site buttons (international / China) followed by four separate native credential fields: username, password, API Key, and system access token. No JSON bundle or combined text field.
- Keep credential roles separated: password for login/check-in, API Key for model discovery and calls, system access token for balance.
- Merge the selected account's live `/v1/models` response and `/api/pricing` endpoint data with known `models.dev` capabilities, context limits, modalities and reasoning levels. Unknown model facts remain unspecified rather than guessed.
- Use the AgentRouter China site's favicon (`/logo.png`) as the package and provider icon.
- Keep Magpie-scheduled daily check-in, explicit balance reads, Responses request handling, bounded diagnostics, local text filtering and optional session repair.
- Reinitialize Git history on `main`; the new repository is not a GitHub fork.
