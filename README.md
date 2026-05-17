# Sales HUD - LinkedIn Caller Intelligence

Sales HUD is a lightweight Chrome extension that adds a private caller-intelligence panel to LinkedIn profile pages. It helps sales reps quickly understand whether a lead is likely in a good calling window, track call status, save profile-specific notes, and copy a short opener or lead brief.

## Features

- Floating HUD on LinkedIn profile pages, including when LinkedIn changes pages without a full reload
- Local-time and calling-window guidance inferred from the profile location
- Profile summary scraped from visible LinkedIn content
- Per-profile call status and notes saved with `chrome.storage.local`
- Editable name, headline, and city/country fields when LinkedIn hides profile data from the page scripts
- One-click copy for a call opener and lead brief
- Toolbar popup with a manual **Show HUD** button for troubleshooting or first load
- Draggable and minimizable panel
- No build step, remote code, analytics, or third-party services

## Install locally

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.
5. Open or refresh a LinkedIn profile URL such as `https://www.linkedin.com/in/example/`.
6. If the panel does not appear automatically, click the Sales HUD extension icon in Chrome and then click **Show HUD on this tab**.

If LinkedIn does not expose the location to the extension, type the city/country into **Correct city / country for time zone** in the HUD. The local-time card updates from that saved value.

If the HUD does not appear after updating files, return to `chrome://extensions` and click the reload icon on the extension card. Chrome does not automatically pick up local file changes.

## How it works

The extension runs three content scripts on LinkedIn. The HUD only displays on profile URLs:

- `src/timezone-map.js` maps common city, region, and country strings to IANA time zones and turns local time into a calling recommendation.
- `src/scraper.js` extracts visible profile details such as name, headline, location, about text, and experience snippets, with title/meta fallbacks for LinkedIn markup changes.
- `src/hud.js` renders the Sales HUD, persists notes/status locally, and provides copy actions.
- `popup/popup.html` and `popup/popup.js` provide the toolbar popup and manual HUD injection button.

LinkedIn changes its markup frequently, so the scraper intentionally uses several broad selectors and graceful fallbacks rather than depending on a single brittle DOM path.

## Privacy

Sales HUD stores only the notes and call status you enter for each profile, plus the HUD position. Data is stored locally in the browser through `chrome.storage.local`. The extension does not send profile data to any server.

## Permissions

- `storage`: saves profile-specific notes, status, and HUD position locally.
- `clipboardWrite`: powers the copy opener and copy brief buttons.
- `activeTab` and `scripting`: allow the toolbar popup to show the HUD on the active LinkedIn profile tab.
- `*://*.linkedin.com/*`: allows the HUD content scripts to run on LinkedIn profile pages.
