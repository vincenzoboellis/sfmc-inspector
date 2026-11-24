# SFMC Inspector

> The definitive developer toolkit for Salesforce Marketing Cloud Engagement.

![Version](https://img.shields.io/badge/version-1.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Manifest](https://img.shields.io/badge/manifest-v3-orange)
![Browsers](https://img.shields.io/badge/browsers-Chrome%20%7C%20Firefox-lightgrey)

---

## What it does

SFMC Inspector runs inside your browser while you're logged into Salesforce Marketing Cloud. It reads your existing session — no OAuth setup, no credentials to enter — and gives you superpowers the native UI doesn't have.

### What's new in 1.2

- **Firefox support**: SFMC Inspector now runs on Firefox (140+) as well as Chrome, from the same codebase.
- **Fonts bundled locally**: Geist and JetBrains Mono ship with the extension, so the popup makes no request to Google Fonts or any other third party.
- **Leaner permissions**: removed the unused `activeTab` permission and the unused page content script.
- **More robust session restore**: when the browser suspends the background script, the session is restored before any API call is answered.

### What's new in 1.1

- **Click-through DE → Automation detail** — from any Data Extension, click directly on an automation that writes to it to jump straight to its detail view (activities + inline SQL with quality score). Previously you had to switch tab and search by name manually.
- **DE loading progress counter** — the Load button now reports live progress (`X / 39 prefixes…`) during the SFMC search workaround, so you can see the extension is working instead of staring at a spinner.
- **Load button guards** — disabled during fetch to prevent accidental double-loads and parallel API storms.
- **Polished search bar** — removed the redundant `⌘K` hint; the shortcut still works.
- **Icons shipped** — extension now has its full icon set in the toolbar and Chrome Web Store listing.

### Features

| Feature | Description |
|---|---|
| **Session Detection** | Automatically detects your SFMC session from any open SFMC tab |
| **Data Extension Explorer** | Browse all DEs with quick search |
| **DE → Automation Map** | For any DE, see which Query Activities write to it (with inline SQL) — and click any row to jump straight to the automation detail |
| **DE → Journey Map** | See which Journeys reference a DE as entry source or activity |
| **Automation Monitor** | Browse automations with status, schedule, and inline SQL preview |
| **SQL Linter** | 10-rule static analysis for SFMC Query Activity SQL |
| **AMPScript Linter** | 10-rule static analysis for AMPScript V1 blocks |
| **Global Search** | ⌘K search across DEs, Automations, Journeys simultaneously |

---

## How authentication works

SFMC Inspector uses the **same session your browser already has** when you're logged into SFMC. It executes authenticated API calls directly inside your open SFMC tab using the browser's scripting API: the browser's existing session is used automatically, without reading or storing cookies.

- ✅ No OAuth setup required
- ✅ No credentials stored
- ✅ No data sent to third parties
- ✅ Respects your SFMC permissions — you can only see what your user can access
- ✅ Detects session expiry and prompts you to refresh

---

## Installation

- **Chrome**: [Chrome Web Store](https://chromewebstore.google.com/detail/lljfkobpodlajfnkikekolokldggefci)
- **Firefox**: Firefox Add-ons (link coming soon)

## Development

### Chrome
1. Clone this repository
2. Open `chrome://extensions/` and enable **Developer mode**
3. Click **Load unpacked** and select the `sfmc-inspector/` folder
4. Open Salesforce Marketing Cloud in a tab and click the SFMC Inspector icon

### Firefox
1. Run `node scripts/build.js` (Node 18+, no dependencies)
2. Open `about:debugging#/runtime/this-firefox` and click **Load Temporary Add-on…**
3. Select `dist/firefox/manifest.json`
4. Open Salesforce Marketing Cloud in a tab and click the SFMC Inspector icon

### Building store packages
`node scripts/build.js` creates, with `manifest.json` at the ZIP root:
- `dist/sfmc-inspector-chrome-<version>.zip` for the Chrome Web Store
- `dist/sfmc-inspector-firefox-<version>.zip` for addons.mozilla.org

The base `sfmc-inspector/manifest.json` declares both `background.scripts` (Firefox) and `background.service_worker` (Chrome). The build strips the key each store does not use and adds the Firefox-only `browser_specific_settings`.

---

## Project structure

```
sfmc-inspector/
├── manifest.json                 # Manifest V3 (base, cross-browser)
├── background/
│   └── service-worker.js         # Session management, API proxy
├── panel/
│   ├── popup.html                # Extension popup UI
│   ├── popup.css                 # Styles (dark theme, bundled Geist + JetBrains Mono)
│   └── popup.js                  # UI controller
├── shared/
│   ├── sfmc-api.js               # REST API wrapper
│   ├── sql-linter.js             # SQL static analysis (10 rules)
│   └── ampscript-linter.js       # AMPScript static analysis (10 rules)
└── assets/
    ├── fonts/                    # Self-hosted woff2 fonts (SIL OFL 1.1)
    └── icons/                    # Extension icons (16/32/48/128 px)

scripts/
└── build.js                      # Builds Chrome and Firefox packages into dist/
```

---

## Linter rules

### SQL (Query Activities)

| Rule | Severity | Description |
|---|---|---|
| SQL001 | 🔴 Error | SELECT * used |
| SQL002 | 🟡 Warning | Missing NOLOCK on data views |
| SQL003 | 🔴 Error | NULL comparison with = or != |
| SQL004 | 🟡 Warning | No WHERE clause on high-volume data view |
| SQL005 | 🟡 Warning | Implicit type coercion in JOIN |
| SQL006 | 🔵 Info | DISTINCT on high-volume table |
| SQL007 | 🟡 Warning | Subquery in WHERE instead of JOIN |
| SQL009 | 🔵 Info | TOP without ORDER BY |
| SQL010 | 🟡 Warning | GETDATE() without timezone context |

### AMPScript (Emails / CloudPages / Templates)

| Rule | Severity | Description |
|---|---|---|
| AMP001 | 🔴 Error | Variable used without VAR declaration |
| AMP002 | 🔴 Error | IF block without ENDIF |
| AMP003 | 🔴 Error | FOR block without NEXT |
| AMP004 | 🟡 Warning | Output without EncodeValue() |
| AMP005 | 🟡 Warning | Hardcoded email address or ClientID |
| AMP006 | 🔴 Error | LookupRows without null check |
| AMP007 | 🟡 Warning | Lowercase AMPScript keywords |
| AMP008 | 🔵 Info | TreatAsContent() usage detected |
| AMP009 | 🟡 Warning | Data write without error handling |
| AMP010 | 🔵 Info | V2 syntax detected |

---

## Roadmap

- [x] Icons
- [ ] Journey dependency map (visual tree)
- [ ] DE Health Dashboard (NULL columns, orphaned DEs)
- [ ] Broken link detector for emails
- [ ] Export metadata to JSON/CSV
- [x] Chrome Web Store listing
- [x] Firefox support (1.2)
- [ ] Firefox Add-ons listing

---

## Contributing

PRs welcome. Before starting work on a feature, open an issue to discuss the approach.

**Code standards:**
- Vanilla JS only (no frameworks in content/background scripts)
- No `let`/`const`/arrow functions in content scripts (keep IE11-era compat for SFMC's older iframe contexts)
- All SFMC API calls go through `sfmc-api.js`

---

## License

MIT — free for everyone, forever.
