// Options page: edit settings (saved to chrome.storage.sync) and preview them
// live with the real RSVP player in embedded mode.

const DEFAULTS = {
  wpm: 350,
  theme: "dark",
  focusColor: "#e74c3c",
  skip: 15,
  text:
    "FlashRead shows one word at a time so your eyes stay still instead of " +
    "darting across lines. Tune the speed, theme, and focus color here, then " +
    "watch this preview to find a pace that feels comfortable.",
};

const SWATCHES = ["#e74c3c", "#f39c12", "#2ecc71", "#3498db", "#9b59b6", "#e84393"];

const $ = (id) => document.getElementById(id);
let cfg;
let preview;

function save(patch) {
  cfg = { ...cfg, ...patch };
  chrome.storage.sync.set(patch);
}

function applyPageTheme() {
  document.documentElement.dataset.theme = cfg.theme;
  document.documentElement.style.setProperty("--accent", cfg.focusColor);
}

function buildPreview() {
  if (preview) preview.destroy();
  const words = (cfg.text || DEFAULTS.text).trim().split(/\s+/).filter(Boolean);
  const container = $("preview");
  container.innerHTML = "";
  const { RSVPPlayer } = window.__flashread;
  preview = new RSVPPlayer({
    words,
    wpm: cfg.wpm,
    skip: cfg.skip,
    theme: cfg.theme,
    focusColor: cfg.focusColor,
    cssUrl: chrome.runtime.getURL("src/player/player.css"),
    embedded: true,
    container,
  });
  preview.mount();
}

function syncThemeButtons() {
  document.querySelectorAll("#theme button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.themeVal === cfg.theme));
  });
}

function syncSwatches() {
  document.querySelectorAll(".swatch").forEach((s) => {
    s.setAttribute("aria-pressed", String(s.dataset.color === cfg.focusColor));
  });
  $("colorHex").textContent = cfg.focusColor.toUpperCase();
}

async function init() {
  const stored = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  cfg = { ...DEFAULTS, ...stored };

  // Theme segmented control
  $("theme").addEventListener("click", (e) => {
    const v = e.target.dataset.themeVal;
    if (!v) return;
    save({ theme: v });
    applyPageTheme();
    syncThemeButtons();
    preview?.setTheme(v);
  });

  // Focus color: picker + preset swatches
  const sw = $("swatches");
  SWATCHES.forEach((c) => {
    const s = document.createElement("button");
    s.className = "swatch";
    s.dataset.color = c;
    s.style.background = c;
    s.title = c;
    s.addEventListener("click", () => setColor(c));
    sw.appendChild(s);
  });
  $("color").addEventListener("input", (e) => setColor(e.target.value));

  function setColor(c) {
    save({ focusColor: c });
    $("color").value = c;
    applyPageTheme();
    syncSwatches();
    preview?.setTheme(undefined, c);
  }

  // WPM
  $("wpm").addEventListener("input", (e) => {
    const wpm = Number(e.target.value);
    $("wpmVal").textContent = `${wpm} wpm`;
    save({ wpm });
    if (preview) preview.wpm = wpm;
  });

  // Jump distance
  $("skip").addEventListener("input", (e) => {
    const skip = Number(e.target.value);
    $("skipVal").textContent = `${skip} word${skip === 1 ? "" : "s"}`;
    save({ skip });
    preview?.setSkip(skip);
  });

  // Test text (rebuild on blur/enter to avoid thrashing the player)
  $("text").addEventListener("change", (e) => {
    save({ text: e.target.value });
    buildPreview();
  });
  $("restart").addEventListener("click", buildPreview);

  // Seed controls from cfg
  $("color").value = cfg.focusColor;
  $("wpm").value = cfg.wpm;
  $("wpmVal").textContent = `${cfg.wpm} wpm`;
  $("skip").value = cfg.skip;
  $("skipVal").textContent = `${cfg.skip} word${cfg.skip === 1 ? "" : "s"}`;
  $("text").value = cfg.text;

  applyPageTheme();
  syncThemeButtons();
  syncSwatches();
  buildPreview();
}

init();
