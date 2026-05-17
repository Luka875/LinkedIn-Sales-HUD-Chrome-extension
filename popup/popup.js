"use strict";

const showButton = document.getElementById("showHud");
const reloadButton = document.getElementById("reloadTab");
const statusBox = document.getElementById("status");

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status ${type || ""}`.trim();
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0];
}

function isLinkedInProfile(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("linkedin.com") && /^\/in\/[^/]+/i.test(parsed.pathname);
  } catch (error) {
    return false;
  }
}

async function sendMessage(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function injectHudScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/timezone-map.js", "src/scraper.js", "src/hud.js"]
  });
}

async function showHud() {
  showButton.disabled = true;
  setStatus("Checking this tab...");

  try {
    const tab = await getActiveTab();

    if (!tab || !tab.id) {
      setStatus("No active tab found.", "error");
      return;
    }

    if (!isLinkedInProfile(tab.url || "")) {
      setStatus("Open a LinkedIn profile URL first, for example linkedin.com/in/name/.", "error");
      return;
    }

    try {
      await sendMessage(tab.id, { type: "saleshud:show" });
    } catch (error) {
      await injectHudScripts(tab.id);
      await sendMessage(tab.id, { type: "saleshud:show" });
    }

    setStatus("HUD requested. Look near the top-right of the LinkedIn page.", "ok");
  } catch (error) {
    setStatus(`Could not show HUD: ${error.message}`, "error");
  } finally {
    showButton.disabled = false;
  }
}

async function reloadTab() {
  reloadButton.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab || !tab.id || !isLinkedInProfile(tab.url || "")) {
      setStatus("Open a LinkedIn profile tab before refreshing.", "error");
      return;
    }

    await chrome.tabs.reload(tab.id);
    setStatus("LinkedIn tab refreshed. Wait for the page to load, then click Show HUD.", "ok");
  } catch (error) {
    setStatus(`Could not refresh tab: ${error.message}`, "error");
  } finally {
    reloadButton.disabled = false;
  }
}

showButton.addEventListener("click", showHud);
reloadButton.addEventListener("click", reloadTab);

getActiveTab().then((tab) => {
  if (tab && isLinkedInProfile(tab.url || "")) {
    setStatus("LinkedIn profile detected. Click Show HUD.");
  } else {
    setStatus("Go to a LinkedIn profile page first.");
  }
});
