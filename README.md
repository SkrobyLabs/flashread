# ⚡ FlashRead

**Read faster, one word at a time.**

FlashRead is a free Chrome extension that helps you speed-read. Instead of moving
your eyes across lines of text, it flashes the words one after another in the same
spot — with one letter highlighted in color to keep your focus steady. This
technique is called **RSVP** (Rapid Serial Visual Presentation), and with a little
practice it can noticeably speed up your reading.

It works on the text you select on (almost) any web page. No account, no ads,
nothing is sent anywhere — it all runs on your computer.

---

## How to use it

1. **Select** some text on a web page (click and drag over it).
2. **Start FlashRead** in any of these ways:
   - Click the **⚡ icon** that pops up next to your selection
   - **Right-click** the selection → **Speed-read selection**
   - Press the keyboard shortcut **Ctrl+Shift+Y** (on Mac: **Cmd+Shift+Y**)
   - Click the **FlashRead toolbar button** (top-right of Chrome) for a menu
3. A small reader box opens, paused on the first word. Press **Play** (or the
   spacebar) and the words start flowing — easing up to your chosen speed over
   the first couple of seconds.

**While reading:** `Space` = play/pause, `←` / `→` = skip back/forward,
`↑` / `↓` = slower/faster, `Esc` = close.

Want to change the look or speed? Right-click the toolbar button → **Options**
(or open the extension's **Settings**). There you can set light/dark theme, the
highlight color, your default speed, and how far the skip buttons jump — with a
live preview so you can try it out.

> **If a page won't cooperate:** some pages — like **Google Docs**, **PDFs**, and
> certain apps — don't let the extension reach into them to grab your selection,
> so the ⚡ icon, right-click, and shortcut may do nothing there. Easy workaround:
>
> 1. **Select** the text and **copy** it (Ctrl+C, or Cmd+C on Mac).
> 2. Click the **FlashRead toolbar button** and choose **Speed-read clipboard**.
>
> FlashRead reads whatever you just copied, so it works even on those pages.

---

## How to install it (step by step)

FlashRead isn't in the Chrome Web Store, so you install it manually from these
files. It only takes a minute. You'll need [Google Chrome](https://www.google.com/chrome/)
(or another Chromium browser like Edge or Brave).

### Step 1 — Get the files onto your computer

**If you have Git**, open a terminal and run:

```bash
git clone <repository-url>
```

This creates a `flashread` folder.

**If you don't have Git** (totally fine): on the project's web page, click the
green **Code** button → **Download ZIP**, then unzip it. Remember where you put
the folder — Chrome will need it, and you shouldn't delete or move it afterwards.

### Step 2 — Open Chrome's extensions page

In Chrome, type this into the address bar and press Enter:

```
chrome://extensions
```

### Step 3 — Turn on Developer mode

In the **top-right corner** of that page, flip the **Developer mode** switch
**on**. A new row of buttons appears.

### Step 4 — Load the extension

Click **Load unpacked**, then select the **flashread** folder from Step 1
(the folder that contains the `manifest.json` file).

### Step 5 — You're done! 🎉

FlashRead now appears in your list of extensions. Click the little **puzzle-piece
icon** in Chrome's toolbar and **pin** ⚡ FlashRead so it's always visible.

Go to any article, select some text, and give it a try.

> **Keeping it updated:** if you used Git, run `git pull` in the folder, then click
> the **refresh ↻** icon on FlashRead's card at `chrome://extensions`. If you
> downloaded the ZIP, download the new one and re-do Step 4.

---

## For developers

Plain Manifest V3, vanilla JS, no build step — the folder you load *is* the
extension.

```
manifest.json            MV3 manifest, permissions, shortcut, content-script registration
src/background.js        service worker: context menu + command → message the tab
src/popup/               toolbar popup menu (selection / clipboard / settings)
src/content.js           selection capture, range→word tokenizer, floating icon, in-page highlight
src/player/player.js     RSVP engine + Shadow-DOM overlay UI (themeable, embeddable)
src/player/player.css    overlay styles (theme CSS variables; injected into the shadow root)
src/options/             styled settings page + live embedded preview
icons/                   generated app icons (regenerate with `python3 icons/mkicon.py`)
```

**How it works:** the content script tokenizes the selection's **DOM Range** (not
just its string) so each word keeps a reference to its text node + offsets. The
player calls back with the current index; the content script rebuilds a `Range`
for that word and registers it in `CSS.highlights` — highlighting the live page
without mutating its DOM. Timing is per-word: base interval `60000 / wpm`,
lengthened for sentence/clause punctuation and long words.

**Permissions:** `activeTab`, `storage`, `contextMenus`, `clipboardRead`
(clipboard reading), `scripting` (popup injects the content script into tabs
opened before install). The content script matches `<all_urls>` because the
floating selection icon needs to observe selections on every page. No remote
hosts are contacted and nothing is sent off-device.
