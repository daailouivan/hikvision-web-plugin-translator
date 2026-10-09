/**
 * Background Service Worker (Manifest V3)
 * Manages camera profiles, CORS/header modifications, and standalone viewer tabs.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Annke/Hikvision Bridge] Extension installed successfully.");
  chrome.storage.local.set({
    emulationEnabled: true,
    preferredStream: "101", // 101: Main stream, 102: Sub stream
    hardwareAcceleration: true
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({ active: true, version: "1.0.0" });
  } else if (message.type === "OPEN_VIEWER") {
    chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") });
    sendResponse({ success: true });
  }
  return true;
});
