// Service worker: registers the context menu and forwards launch events
// (context-menu click / keyboard command) to the active tab's content script.

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "flashread-read",
    title: "Speed-read selection",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "flashread-read" || !tab?.id) return;
  // The live selection still exists; pass selectionText only as a fallback.
  chrome.tabs.sendMessage(tab.id, {
    type: "open-rsvp",
    text: info.selectionText,
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "read-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "open-rsvp" });
});
