/**
 * Background service worker
 * Handles extension icon clicks
 */

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  
  // Skip restricted URLs
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    return;
  }
  
  // Send message to content script to toggle view
  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggle" });
  } catch (error) {
    console.error("MD: Failed to send message to content script", error);
  }
});
