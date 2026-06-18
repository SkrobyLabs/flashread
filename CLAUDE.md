# FlashRead

Chrome extension (Manifest V3, vanilla JS — no build step, no dependencies) that
speed-reads selected text on any page using RSVP. Load unpacked from the repo root.

## Architecture

- `manifest.json` — MV3. Permissions: `activeTab`, `storage`, `contextMenus`,
  `clipboardRead` (Google-Docs/canvas fallback + popup clipboard action),
  `scripting` (popup on-demand content-script injection).
  Content script matches `<all_urls>` (needed for the floating selection icon).
  Keyboard command `read-selection` (default `Ctrl/Cmd+Shift+Y`).
- `src/background.js` — service worker. Creates the context menu and forwards
  context-menu clicks and the keyboard command to the active tab as an
  `{type:"open-rsvp"}` message.
- `src/content.js` — runs in every page. Captures the selection as a **DOM Range**,
  tokenizes it into words while keeping each word's `{node, start, end}` so it can
  be re-highlighted in place via the **CSS Custom Highlight API** (`CSS.highlights`,
  feature-detected). Manages the floating ⚡ icon and instantiates the player.
- `src/player/player.js` — `RSVPPlayer` class, exposed at `window.__flashread`.
  Themeable via CSS variables (`THEMES` dark/light + `--fr-accent` focus color)
  applied to the shadow root in `_applyTheme()`. Supports `embedded` mode (mounts
  into a given `container`, no backdrop/global keys/wpm-stepper/close) — used by
  the options-page preview. Live setters: `setTheme(theme, color)`, `setSkip(n)`.
  RSVP scheduling (per-word `setTimeout`), ORP pivot letter, Shadow-DOM overlay UI,
  controls, WPM persistence. Loaded **before** content.js in the same content-script
  world. Opens paused; `play()` sets `rampStart` and `_effectiveWpm()` eases from
  half→full WPM over `RAMP_MS` (2s). Back/forward jump `SKIP` (15) words.
- `src/player/player.css` — overlay styles; fetched via `chrome.runtime.getURL`
  (a `web_accessible_resource`) and injected into the shadow root.
- `src/options/` — styled, theme-aware settings page (theme, focus color, WPM,
  jump distance, test text) persisted to `chrome.storage.sync`, with a live
  preview built from an embedded `RSVPPlayer`. Settings keys: `wpm`, `theme`,
  `focusColor`, `skip`, `text`. `src/content.js` reads these when launching.
- `icons/mkicon.py` — pure-Python PNG generator (no Pillow). Regenerate: `python3 icons/mkicon.py`.

## Conventions

- Modify files in place; no new "v2" copies.
- No build tooling — keep it dependency-free vanilla JS so the unpacked folder is
  also the shippable artifact.
- All RSVP word styling is scoped inside the shadow root (class prefix `fr-`).
  The only style injected into the host page is the `::highlight()` rule for the
  in-page current-word highlight.

## Testing

No automated tests yet. Manual: load unpacked, select text on any page, launch via
right-click / ⚡ icon / shortcut, verify the overlay plays and the page word
highlights track it (and remain after closing).
