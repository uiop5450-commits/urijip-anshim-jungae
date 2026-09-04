# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**우리집 안심 중개** — a B2B2C brokerage platform prototype matching interior-renovation
contractors ("partners") in Busan with homeowners ("clients"). Core flow: client submits a
quote request → matching → partners bid → contract. Includes a partner console
(portfolio/bids) and an admin/manager console (KPIs, order allocation, blacklist/strike
management).

This is a **pure frontend prototype**. There is no backend, no database, no build tool, and
no package.json. State lives entirely in the in-memory `window.AppState` global object and
resets on every page refresh.

## Running / developing

There is no build, lint, or test tooling in this repo — just open `index.html` in a browser
(no server required):

```bash
start index.html
```

To see changes, edit the relevant `.js`/`.css`/`.html` file and reload the browser — there is
no watcher/bundler. There are no automated tests; verify changes manually in the browser.

## Architecture

### Script load order is the dependency graph

`index.html` loads scripts in this fixed order, which matters because there's no module
system:

```
config_state.js → utils_ui.js → cms.js → partner_panel.js → client_panel.js
```

`config_state.js` must load first — it defines `window.AppState`, `window.CONFIG`, and the
`window.APIService` stub. `utils_ui.js` defines shared helpers (`showToast`, `pushLog`,
`maskName`, `maskPhone`, `safeUpdateText`/`safeUpdateValue`).

Each of the later files re-declares those shared helpers defensively at the top
(`var showToast = window.showToast || function(...) {...}`) so the file doesn't crash if
loaded standalone or out of order — but in the real app the `utils_ui.js` versions always win
since they load first. When adding a new cross-file helper, follow this pattern rather than
assuming load order.

### Global state, manual re-render

There is no framework/reactivity. All app data lives on `window.AppState` (orders, bids,
partners, client accounts, blacklist, KPIs, logs, calendar, pamphlets/hero slides, etc. — see
`config_state.js`). Mutating `AppState` does **not** update the DOM by itself; you must call
the relevant `render*`/`sync*` function afterward (e.g. `renderPartnerOrderList()`,
`renderCalendar()`, `recalculateKPIs()`, `switchPanel(...)`).

### Panel-based navigation (no routing)

`switchPanel(panelId)` in `partner_panel.js` is the app's entire "router": it toggles the
`.hidden` class across six top-level `<section>` panels in `index.html`
(`home-panel`, `client-panel`, `partner-search-panel`, `client-mypage-panel`, `partner-panel`,
`admin-panel`) and triggers that panel's render function. There is no URL/hash routing.

### Functions called from inline `onclick` must be exported to `window`

`index.html` wires up all interactivity with inline `onclick="..."` attributes, not JS event
listeners. Every function invoked this way is declared normally in its `.js` file and then
explicitly assigned to `window.fnName = fnName` near the bottom of that file. **When adding a
new function that HTML will call directly, you must add this export line**, or it will fail
silently (undefined function on click) since there's no build step to catch it.

### File responsibilities

| File | Responsibility |
| --- | --- |
| `index.html` | All markup: 6 panels (home/quote-request/partner-search/my-page/partner-console/admin-console) + modals |
| `config_state.js` | `CONFIG` presets, `window.AppState` initial data (orders, partners, blacklist, pamphlets...), `window.APIService` stub |
| `utils_ui.js` | Shared UI utils: masking (`maskName`/`maskPhone`), `pushLog`, toast |
| `cms.js` | Partner portfolio editor, reviews, lightbox (zoom/pan/drag), scene rendering |
| `partner_panel.js` | Panel switching/"routing", partner login/console, admin/manager console (KPIs, allocation, blacklist, strikes, hero/pamphlet display management) |
| `client_panel.js` | Client quote form + calendar, matching simulation, bid review, contract e-sign stubs, my-page, review writing |
| `premium_theme.css` | Design tokens — Toss-style: brand blue (`--brand-500: #2f6fed`), large rounded cards, custom `--ink-*`/shadow variables |

### Auth model

Three separate role logins (client, partner, admin/manager), each validated in
`partner_panel.js`/`client_panel.js` by plain string comparison against arrays already sitting
in `AppState` (`partners[].pw`, `clientAccounts[].pw`) — see `validatePartnerLogin`,
`validateManagerLogin`. There is no hashing and no server-side check; treat this purely as
prototype UX, not a security boundary.

### Mock/stub points worth knowing before extending

- `window.APIService` (`config_state.js`) is the intended seam for a future real backend —
  currently it just mutates `AppState` in place and resolves immediately.
- `triggerMatchingSim` (`client_panel.js`) is a fake progress-bar animation, not a real
  matching algorithm — partner assignment is effectively random.
- SMS verification (`sendClientAuthCode`) shows the "sent" code directly in the UI instead of
  sending it.
- `clearSignatureCanvas` / `submitSignatureCanvas` (`client_panel.js`) are empty stub
  functions — e-signature/contract flow is unimplemented.
- `commissionPaid` on an order is just a boolean flag; there is no real payment/escrow
  integration.
- Partner/client passwords are hardcoded in plaintext in `config_state.js` and visible in
  client-side JS — do not treat this as real credential storage.

These are documented (not just discovered) gaps — see `README.md`'s "알려진 이슈" section.
