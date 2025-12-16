/**
 * Background service worker
 * Handles extension icon clicks to convert HTML pages to Markdown
 */

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  
  // Skip chrome:// and other restricted URLs
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    console.log("MD: Cannot run on browser internal pages");
    return;
  }
  
  try {
    // 1. Inject styles first
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["styles.css"],
    });
    
    // 2. Convert HTML to markdown (replaces page with <pre>)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["converter.js"],
    });
    
    // 3. Render the markdown with full UI
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (error) {
    console.error("MD: Failed to inject converter", error);
  }
});
