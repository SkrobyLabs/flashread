// FlashRead content script: selection capture, floating launch icon,
// and in-page highlight of the current RSVP word.
(function () {
  "use strict";

  const HIGHLIGHT_NAME = "flashread-current";
  const supportsHighlight =
    typeof Highlight !== "undefined" && CSS && CSS.highlights;

  let icon = null;
  let player = null;
  let tokens = []; // [{ node, start, end }] aligned 1:1 with the player's words

  // ---- Tokenize a DOM Range into words + their text-node positions ----
  function tokenizeRange(range) {
    const words = [];
    const toks = [];
    const root = range.commonAncestorContainer;
    const walker = document.createTreeWalker(
      root.nodeType === Node.TEXT_NODE ? root.parentNode : root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(n) {
          return range.intersectsNode(n)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      const full = node.nodeValue;
      // Clamp to the selected portion of the first/last node.
      const from = node === range.startContainer ? range.startOffset : 0;
      const to = node === range.endContainer ? range.endOffset : full.length;
      const slice = full.slice(from, to);
      const re = /\S+/g;
      let m;
      while ((m = re.exec(slice))) {
        words.push(m[0]);
        toks.push({ node, start: from + m.index, end: from + m.index + m[0].length });
      }
    }
    return { words, toks };
  }

  function highlightToken(i) {
    if (!supportsHighlight || !tokens[i]) return;
    const t = tokens[i];
    const range = document.createRange();
    range.setStart(t.node, t.start);
    range.setEnd(t.node, t.end);
    const hl = new Highlight(range);
    CSS.highlights.set(HIGHLIGHT_NAME, hl);
    scrollIntoViewIfNeeded(range);
  }

  function clearHighlight() {
    if (supportsHighlight) CSS.highlights.delete(HIGHLIGHT_NAME);
  }

  function scrollIntoViewIfNeeded(range) {
    const r = range.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) {
      range.startContainer.parentElement?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }

  // Inject the ::highlight() rule once into the page document.
  function ensureHighlightStyle() {
    if (!supportsHighlight || document.getElementById("flashread-hl-style")) return;
    const s = document.createElement("style");
    s.id = "flashread-hl-style";
    s.textContent = `::highlight(${HIGHLIGHT_NAME}){background:#ffe27a;color:#15171c;}`;
    document.head.appendChild(s);
  }

  // ---- Open the player from the current selection ----
  async function openFromSelection(fallbackText, ignoreSelection) {
    const sel = window.getSelection();
    let words, toks;

    if (!ignoreSelection && sel && sel.rangeCount && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      ({ words, toks } = tokenizeRange(range));
    }
    if ((!words || !words.length) && fallbackText && fallbackText.trim()) {
      words = fallbackText.trim().split(/\s+/).filter(Boolean);
      toks = []; // no range available → no in-page highlight
    }
    // Canvas-rendered apps (Google Docs/Sheets/Slides, some PDF viewers) expose
    // no DOM selection. Fall back to whatever the user last copied.
    if (!words || !words.length) {
      const clip = await readClipboard();
      if (clip && clip.trim()) {
        words = clip.trim().split(/\s+/).filter(Boolean);
        toks = [];
      }
    }
    if (!words || !words.length) {
      toast(
        "FlashRead: no selectable text here. In Google Docs and similar, " +
          "select the text and copy it (Ctrl/Cmd+C), then trigger FlashRead again."
      );
      return;
    }

    tokens = toks;
    ensureHighlightStyle();
    clearHighlight();
    hideIcon();
    if (player) player.destroy();

    const cfg = await chrome.storage.sync
      .get(["wpm", "theme", "focusColor", "skip"])
      .catch(() => ({}));
    const { RSVPPlayer } = window.__flashread;
    player = new RSVPPlayer({
      words,
      wpm: cfg.wpm ?? 350,
      theme: cfg.theme || "dark",
      focusColor: cfg.focusColor || "#e74c3c",
      skip: cfg.skip || 15,
      cssUrl: chrome.runtime.getURL("src/player/player.css"),
      onWord: (i) => highlightToken(i),
      // Keep the last highlight in place after closing so the user sees where they stopped.
      onClose: () => { player = null; },
    });
    await player.mount();
  }

  async function readClipboard() {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  }

  function toast(message) {
    const t = document.createElement("div");
    t.textContent = message;
    t.style.cssText = [
      "all:initial",
      "position:fixed",
      "left:50%",
      "bottom:28px",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "max-width:420px",
      "padding:12px 16px",
      "background:#15171c",
      "color:#e7e9ee",
      "border-radius:10px",
      "font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif",
      "box-shadow:0 8px 28px rgba(0,0,0,.45)",
    ].join(";");
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), 4500);
  }

  // ---- Floating icon next to a fresh selection ----
  function showIcon(rect) {
    if (!icon) {
      icon = document.createElement("div");
      icon.id = "flashread-icon";
      icon.textContent = "⚡";
      icon.title = "Speed-read this selection";
      icon.style.cssText = [
        "all:initial",
        "position:absolute",
        "z-index:2147483646",
        "width:26px",
        "height:26px",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:#e74c3c",
        "color:#fff",
        "border-radius:50%",
        "font-size:14px",
        "cursor:pointer",
        "box-shadow:0 2px 8px rgba(0,0,0,.35)",
        "font-family:sans-serif",
      ].join(";");
      icon.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFromSelection();
      });
      document.documentElement.appendChild(icon);
    }
    icon.style.top = `${scrollY + rect.bottom + 6}px`;
    icon.style.left = `${scrollX + rect.right - 13}px`;
  }

  function hideIcon() {
    icon?.remove();
    icon = null;
  }

  function onSelectionSettled() {
    if (player) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hideIcon();
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width || rect.height) showIcon(rect);
  }

  document.addEventListener("mouseup", () => setTimeout(onSelectionSettled, 10));
  document.addEventListener("scroll", hideIcon, true);

  // ---- Messages from the service worker (shortcut / context menu) ----
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "open-rsvp") openFromSelection(msg.text, msg.ignoreSelection);
  });
})();
