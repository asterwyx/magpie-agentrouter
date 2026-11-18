# Changelog

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
