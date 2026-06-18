// RSVP engine + overlay UI. Runs in the page's isolated content-script world.
// Exposed as window.__flashread.RSVPPlayer for content.js to instantiate.
(function () {
  "use strict";

  const DEFAULT_WPM = 350;
  const MIN_WPM = 100;
  const MAX_WPM = 1000;
  const WPM_STEP = 25;
  const SKIP = 15; // default words to jump on back/forward
  const RAMP_MS = 2000; // ease-in: half-speed → full speed over this window

  const THEMES = {
    dark: {
      "--fr-overlay": "rgba(0,0,0,.55)",
      "--fr-bg": "#15171c",
      "--fr-fg": "#e7e9ee",
      "--fr-border": "#2a2e37",
      "--fr-track": "#2a2e37",
      "--fr-btn": "#232730",
      "--fr-btn-hover": "#2e333e",
      "--fr-muted": "#aab0bd",
      "--fr-muted2": "#6b7280",
    },
    light: {
      "--fr-overlay": "rgba(20,23,28,.35)",
      "--fr-bg": "#ffffff",
      "--fr-fg": "#15171c",
      "--fr-border": "#e3e5ea",
      "--fr-track": "#e6e8ee",
      "--fr-btn": "#eef0f4",
      "--fr-btn-hover": "#e3e6ec",
      "--fr-muted": "#5b6473",
      "--fr-muted2": "#9aa1ad",
    },
  };

  // Optimal Recognition Point: index of the pivot (red) letter by word length.
  function orpIndex(word) {
    const n = word.length;
    if (n <= 1) return 0;
    if (n <= 5) return 1;
    if (n <= 9) return 2;
    if (n <= 13) return 3;
    return 4;
  }

  class RSVPPlayer {
    // opts: { words, wpm?, skip?, theme?, focusColor?, cssUrl, onWord?, onClose?,
    //         embedded?, container? }
    constructor(opts) {
      this.words = opts.words || [];
      this.wpm = clampWpm(opts.wpm || DEFAULT_WPM);
      this.skip = opts.skip || SKIP;
      this.theme = opts.theme || "dark";
      this.focusColor = opts.focusColor || "#e74c3c";
      this.embedded = !!opts.embedded;
      this.container = opts.container || null;
      this.cssUrl = opts.cssUrl;
      this.onWord = opts.onWord || (() => {});
      this.onClose = opts.onClose || (() => {});
      this.i = 0;
      this.playing = false;
      this.timer = null;
      this.rampStart = null; // timestamp when the current play run began
      this._onKey = this._onKey.bind(this);
    }

    async mount() {
      this.host = document.createElement("div");
      // Actual UI lives in a shadow root for style isolation.
      this.shadow = this.host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = await fetchCss(this.cssUrl);
      this.shadow.appendChild(style);

      this.shadow.appendChild(this._buildUI());
      this._applyTheme();

      if (this.embedded && this.container) {
        this.host.style.cssText = "all:initial;display:block;";
        this.container.appendChild(this.host);
      } else {
        this.host.id = "flashread-host";
        this.host.style.cssText =
          "all:initial;position:fixed;inset:0;z-index:2147483647;";
        document.documentElement.appendChild(this.host);
        document.addEventListener("keydown", this._onKey, true);
      }

      this._render();
      this._updateWpm();
      // Start paused on the first word; the user presses play when ready.
    }

    _applyTheme() {
      const palette = THEMES[this.theme] || THEMES.dark;
      for (const [k, v] of Object.entries(palette)) this.root.style.setProperty(k, v);
      this.root.style.setProperty("--fr-accent", this.focusColor);
    }

    // Live updates for the options-page preview.
    setTheme(theme, focusColor) {
      if (theme) this.theme = theme;
      if (focusColor) this.focusColor = focusColor;
      if (this.root) this._applyTheme();
    }
    setSkip(n) {
      this.skip = Math.max(1, Math.round(n));
      if (this.btnBack) this.btnBack.title = `Back ${this.skip} words (←)`;
      if (this.btnFwd) this.btnFwd.title = `Forward ${this.skip} words (→)`;
    }

    _buildUI() {
      const root = el("div", this.embedded ? "fr-embed" : "fr-backdrop");
      this.root = root;
      if (!this.embedded) {
        root.addEventListener("mousedown", (e) => {
          if (e.target === root) this.destroy(); // click outside the card closes
        });
      }

      const card = el("div", "fr-card");

      // Reading reticle: ticks above/below mark the fixed pivot column.
      const stage = el("div", "fr-stage");
      stage.appendChild(el("div", "fr-tick fr-tick-top"));
      stage.appendChild(el("div", "fr-tick fr-tick-bottom"));
      const word = el("div", "fr-word");
      this.pre = el("span", "fr-pre");
      this.pivot = el("span", "fr-pivot");
      this.post = el("span", "fr-post");
      word.append(this.pre, this.pivot, this.post);
      stage.appendChild(word);
      card.appendChild(stage);

      // Progress bar
      const prog = el("div", "fr-progress");
      this.bar = el("div", "fr-bar");
      prog.appendChild(this.bar);
      prog.addEventListener("click", (e) => {
        const ratio = e.offsetX / prog.clientWidth;
        this.seek(Math.round(ratio * (this.words.length - 1)));
      });
      card.appendChild(prog);

      // Controls
      const ctrl = el("div", "fr-controls");
      this.btnBack = btn("⏮", `Back ${this.skip} words (←)`, () => this.step(-this.skip));
      this.btnPlay = btn("▶", "Play / Pause (Space)", () => this.toggle());
      this.btnFwd = btn("⏭", `Forward ${this.skip} words (→)`, () => this.step(this.skip));
      ctrl.append(this.btnBack, this.btnPlay, this.btnFwd);

      // The WPM stepper and close button only belong on the in-page overlay;
      // the options-page preview is driven by the settings form instead.
      if (!this.embedded) {
        const wpmBox = el("div", "fr-wpm");
        const minus = btn("−", "Slower (↓)", () => this.setWpm(this.wpm - WPM_STEP));
        this.wpmLabel = el("span", "fr-wpm-label");
        const plus = btn("+", "Faster (↑)", () => this.setWpm(this.wpm + WPM_STEP));
        wpmBox.append(minus, this.wpmLabel, plus);
        ctrl.appendChild(wpmBox);
        ctrl.appendChild(btn("✕", "Close (Esc)", () => this.destroy()));
      }
      card.appendChild(ctrl);

      this.counter = el("div", "fr-counter");
      card.appendChild(this.counter);

      root.appendChild(card);
      return root;
    }

    _render() {
      const word = this.words[this.i] || "";
      const p = orpIndex(word);
      this.pre.textContent = word.slice(0, p);
      this.pivot.textContent = word.slice(p, p + 1);
      this.post.textContent = word.slice(p + 1);
      const total = this.words.length;
      this.bar.style.width = total ? `${((this.i + 1) / total) * 100}%` : "0";
      this.counter.textContent = `${Math.min(this.i + 1, total)} / ${total}`;
      this.onWord(this.i);
    }

    // Ramp from half the target WPM up to the full target over RAMP_MS so the
    // reader can ease into the pace each time playback starts.
    _effectiveWpm() {
      if (this.rampStart == null) return this.wpm;
      const t = (Date.now() - this.rampStart) / RAMP_MS;
      if (t >= 1) return this.wpm;
      return this.wpm * (0.5 + 0.5 * t);
    }

    _delayFor(word) {
      let ms = 60000 / this._effectiveWpm();
      if (/[.!?]["')\]]?$/.test(word)) ms *= 2.2; // sentence end
      else if (/[,;:]["')\]]?$/.test(word)) ms *= 1.6; // clause
      if (word.length > 8) ms *= 1.3; // long words linger
      return ms;
    }

    _tick() {
      if (!this.playing) return;
      if (this.i >= this.words.length - 1) {
        this._render();
        this.pause();
        return;
      }
      const justShown = this.words[this.i];
      this.i++;
      this._render();
      this.timer = setTimeout(() => this._tick(), this._delayFor(justShown));
    }

    play() {
      if (this.playing || !this.words.length) return;
      if (this.i >= this.words.length - 1) this.i = 0; // restart from end
      this.playing = true;
      this.rampStart = Date.now();
      this.btnPlay.textContent = "⏸";
      this._render();
      this.timer = setTimeout(() => this._tick(), this._delayFor(this.words[this.i]));
    }

    pause() {
      this.playing = false;
      this.btnPlay.textContent = "▶";
      clearTimeout(this.timer);
    }

    toggle() {
      this.playing ? this.pause() : this.play();
    }

    step(delta) {
      this.pause();
      this.seek(this.i + delta);
    }

    seek(index) {
      this.i = Math.max(0, Math.min(index, this.words.length - 1));
      this._render();
    }

    setWpm(wpm) {
      this.wpm = clampWpm(wpm);
      this._updateWpm();
      chrome.storage?.sync?.set({ wpm: this.wpm });
    }

    _updateWpm() {
      if (this.wpmLabel) this.wpmLabel.textContent = `${this.wpm} wpm`;
    }

    _onKey(e) {
      switch (e.key) {
        case " ": e.preventDefault(); this.toggle(); break;
        case "ArrowLeft": e.preventDefault(); this.step(-this.skip); break;
        case "ArrowRight": e.preventDefault(); this.step(this.skip); break;
        case "ArrowUp": e.preventDefault(); this.setWpm(this.wpm + WPM_STEP); break;
        case "ArrowDown": e.preventDefault(); this.setWpm(this.wpm - WPM_STEP); break;
        case "Escape": e.preventDefault(); this.destroy(); break;
        default: return;
      }
      e.stopPropagation();
    }

    destroy() {
      this.pause();
      document.removeEventListener("keydown", this._onKey, true);
      this.host?.remove();
      this.onClose();
    }
  }

  function clampWpm(w) {
    return Math.max(MIN_WPM, Math.min(MAX_WPM, Math.round(w / WPM_STEP) * WPM_STEP));
  }

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function btn(label, title, onClick) {
    const b = el("button", "fr-btn");
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", onClick);
    return b;
  }

  async function fetchCss(url) {
    try {
      const res = await fetch(url);
      return await res.text();
    } catch {
      return "";
    }
  }

  window.__flashread = { RSVPPlayer };
})();
