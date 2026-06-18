// Toolbar popup: launch the RSVP player on the active tab.
const msgEl = document.getElementById("msg");
const showMsg = (text) => { msgEl.textContent = text || ""; };

// Match the popup chrome to the user's chosen theme.
chrome.storage.sync.get("theme").then(({ theme }) => {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
});

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Send to the content script; if it isn't there (tab opened before install /
// on-demand pages), inject it via activeTab access and retry once.
async function sendToTab(tab, message) {
  if (!tab?.id) return false;
  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/player/player.js", "src/content.js"],
      });
      await chrome.tabs.sendMessage(tab.id, message);
      return true;
    } catch {
      return false;
    }
  }
}

const restrictedMsg =
  "Can't run here — try a normal web page (not chrome:// or the Web Store).";

document.getElementById("sel").addEventListener("click", async () => {
  const tab = await activeTab();
  const ok = await sendToTab(tab, { type: "open-rsvp" });
  if (ok) window.close();
  else showMsg(restrictedMsg);
});

document.getElementById("clip").addEventListener("click", async () => {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    showMsg("Couldn't read the clipboard.");
    return;
  }
  if (!text.trim()) {
    showMsg("Clipboard is empty — copy some text first.");
    return;
  }
  const tab = await activeTab();
  const ok = await sendToTab(tab, { type: "open-rsvp", text, ignoreSelection: true });
  if (ok) window.close();
  else showMsg(restrictedMsg);
});

document.getElementById("opts").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
