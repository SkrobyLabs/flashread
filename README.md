# ⚡ FlashRead

A Chrome extension (Manifest V3) that speed-reads **selected text on any page**
using **RSVP** (Rapid Serial Visual Presentation) — words flash one at a time at
a fixed point with the optimal-recognition-point letter highlighted in red, so
your eyes stay still and you read faster.

## Features

- **Three ways to launch** any text selection:
  - Right-click → **Speed-read selection**
  - The floating **⚡ icon** that appears next to a selection
  - Keyboard shortcut — default `Ctrl/Cmd+Shift+Y` (change at `chrome://extensions/shortcuts`)
- **Overlay player** injected into the page in a Shadow DOM (style-isolated):
  word stage with ORP red pivot letter, progress bar, **Back / Play-Pause /
  Forward**, and a **WPM** stepper (100–1000). Opens **paused** on the first word;
  when you press play it **eases in over ~2s** from half-speed up to your target
  WPM. Back/forward jump **15 words** at a time.
- **In-page highlight** of the current word using the CSS Custom Highlight API —
  the page itself shows where you are, and the highlight stays put after you
  close the overlay so you know where you stopped.
- **Google Docs / canvas pages:** these draw text to a `<canvas>` with no DOM
  selection, so FlashRead can't read it directly. Fallback: if no selectable text
  is found it reads the **clipboard** — in Docs, select → copy (Ctrl/Cmd+C) →
  trigger FlashRead. (No in-page highlight in this mode — there's no DOM range.)
- Keyboard controls while open: `Space` play/pause, `←/→` jump 15 words, `↑/↓` speed, `Esc` close.
- Default WPM saved via `chrome.storage.sync` (also editable on the options page).

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder

## Project layout

```
manifest.json            MV3 manifest, permissions, shortcut, content-script registration
src/background.js        service worker: context menu + command → message the tab
src/content.js           selection capture, range→word tokenizer, floating icon, in-page highlight
src/player/player.js     RSVP engine + Shadow-DOM overlay UI
src/player/player.css    overlay styles (injected into the shadow root)
src/options/             default-WPM settings page
icons/                   generated app icons (regenerate with `python3 icons/mkicon.py`)
```

## How it works

The content script tokenizes the selection's **DOM Range** (not just its string)
so each word keeps a reference to its text node + offsets. The player calls back
with the current index; the content script rebuilds a `Range` for that word and
registers it in `CSS.highlights` — highlighting the live page without mutating
its DOM. Timing is per-word: base interval `60000 / wpm`, lengthened for
sentence/clause punctuation and long words.

## Permissions

`activeTab`, `storage`, `contextMenus`, `clipboardRead` (canvas-app fallback only).
The content script matches `<all_urls>`
because the floating selection icon needs to observe selections on every page;
no remote hosts are contacted and nothing is sent off-device.
