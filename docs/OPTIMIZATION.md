# Design and verification notes

## Identity and naming

This repository is the standalone `magpie-agentrouter` Magpie provider plugin. Magpie plugin name and provider display name are both AgentRouter. Its provider ID is `agentrouter`, which is also the default model prefix. The package icon embeds the China site's own HTML favicon declaration, `/logo.png`, as a PNG data URI so installation does not depend on icon fetch connectivity.

## Sign-in interaction

Magpie's provider plugin protocol presents one prompt at a time. The plugin exposes two API-method buttons, one for each site. After the site choice it asks four separate native prompts: username, password, API key, and system access token. Password and both tokens are masked by Magpie. There is no JSON bundle or combined text field.

Each field is validated before network access. A missing or malformed field, or an API key identical to the system token, fails without contacting AgentRouter. The username, password, API key and system token are saved separately to their intended fields.

## Credential boundaries

| Operation | Credential sent | Endpoint |
|---|---|---|
| Initial login and daily check-in | Username + password | Selected site `POST /api/user/login` |
| Balance | System access token + login-derived user ID | Selected site `GET /api/user/self`, falling back to the other trusted site on site failure |
| Models and inference | Model API Key | `GET /v1/models`, `/v1/responses` |

Account requests are restricted to the two trusted AgentRouter site origins and the two expected paths, with redirects disabled, a 64 KiB response bound, a 30 second deadline, and cancellation support. Password, API Key and system token are never used as fallbacks for another operation. No browser flow, copied Cookie, token-generation endpoint, or model-key auto-selection is used.

Model requests always send Magpie's Codex CLI preset headers: `User-Agent: codex_cli_rs/0.167.0 (Mac OS 26.6.0; arm64) Apple_Terminal/455`, `originator: codex_cli_rs`, `version: 0.167.0`, and `Accept: application/json`. The old `send-codex-headers` option is gone; custom metadata headers may add other fields but cannot replace these four.

The balance reader requires the returned account ID to match the ID established by password login. If the service does not provide valid quota fields, the balance is unknown; spend is not converted to a fabricated balance. Error messages do not include the upstream message or submitted values.

## Model metadata

For a signed-in account, model discovery uses the account's `/v1/models` list. The selected site's public `/api/pricing` data is joined by exact model ID for currently priced models and endpoint types. Known model capabilities come from exact-ID Magpie `models.dev` entries; GPT-5.6/GPT-6 context, modalities, tool-call and effort metadata are drawn from the corresponding model-provider docs. Live `/v1/models` fields override catalog limits and capabilities.

The pre-login fallback is the verified public pricing snapshot. Facts not supplied by live responses or a named catalog source remain unset. The GPT specs are sourced from [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) and [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol); GPT-6 Astra metadata remains in the catalog for a live response but is no longer in the default fallback. The model-provider specification describes upstream capability, not a guarantee that every AgentRouter site/account/group enables it. Unknown context size, output size or reasoning tier is never filled with a generic estimate. The static catalog can age, so post-login model availability always follows the account's API list.

## Check-in and balance scheduling

Magpie owns the daily schedule and calls the plugin's `auth.checkin`; the plugin does not create timers. A successful password-login response counts as `claimed` when `data.checked_in === true`; this is the site's checked-in state and the plugin cannot independently prove that the current login added a new credit, so the UI wording says the site reported the state. `false` is `done`, and a missing/non-boolean marker is not success. Captcha responses are reported as captcha and never bypassed.

Balance is queried only when Magpie asks the usage hook. It prefers the selected site's `/api/user/self` and falls back to the other trusted AgentRouter site only for network, upstream, captcha, invalid-response, or untrusted-site failures, using the same system token. Credential rejection and identity mismatch do not fall back; it never retries through a different credential. Login and check-in keep the selected site.

## UI and tests

`npm test` covers four-field credential validation, site separation, model metadata enrichment, credential request boundaries, balance, check-in and existing request/response compatibility. `npm run test:magpie-ui` optionally verifies the actual Magpie UI with an isolated loopback Magpie process and fake AgentRouter service. It checks the two site buttons, four separate prompts, one final sign-in submission and no browser popup.
