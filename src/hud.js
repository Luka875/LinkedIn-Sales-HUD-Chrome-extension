(function initSalesHud() {
  "use strict";

  if (window.__salesHudLoaded) {
    return;
  }

  window.__salesHudLoaded = true;

  const STORAGE_PREFIX = "salesHud:";
  const POSITION_KEY = "salesHud:position";
  const STATUS_OPTIONS = [
    ["new", "New lead"],
    ["queued", "Queued to call"],
    ["contacted", "Contacted"],
    ["follow-up", "Follow-up"],
    ["nurture", "Nurture"],
    ["do-not-call", "Do not call"]
  ];

  const state = {
    profile: getProfileSnapshot(),
    settings: {
      status: "new",
      notes: ""
    },
    position: {
      top: 96,
      right: 24
    },
    minimized: false,
    feedbackTimer: 0
  };

  const host = document.createElement("div");
  host.id = "sales-hud-root";
  const shadow = host.attachShadow({ mode: "open" });

  function getProfileSnapshot() {
    if (window.SalesHudScraper && typeof window.SalesHudScraper.snapshot === "function") {
      return window.SalesHudScraper.snapshot();
    }

    return {
      profileKey: window.location.href,
      url: window.location.href,
      name: "",
      headline: "",
      location: "",
      about: "",
      currentRole: "",
      currentCompany: "",
      experience: []
    };
  }

  function getTimezoneDetails() {
    const timezoneHelper = window.SalesHudTimezone;
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (!timezoneHelper) {
      return {
        guess: {
          timeZone: fallback,
          label: "Browser time",
          confidence: "low",
          reason: "Timezone helper is unavailable."
        },
        callingWindow: {
          status: "soon",
          label: "Check manually",
          detail: "Refresh the page if this does not update.",
          localTime: {
            display: new Intl.DateTimeFormat(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit"
            }).format(new Date())
          }
        }
      };
    }

    const guess = timezoneHelper.guessTimeZone(state.profile.location);
    return {
      guess,
      callingWindow: timezoneHelper.getCallingWindow(guess.timeZone)
    };
  }

  function storageKey() {
    return `${STORAGE_PREFIX}${state.profile.profileKey || window.location.href}`;
  }

  function getFromStorage(keys) {
    return new Promise((resolve) => {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }

      chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
  }

  function setInStorage(values) {
    return new Promise((resolve) => {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }

      chrome.storage.local.set(values, resolve);
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function truncate(value, maxLength) {
    const text = String(value || "").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  function profileFallback(value, fallback) {
    return escapeHtml(value || fallback);
  }

  function buildLeadSummary() {
    const lines = [
      state.profile.name && `Lead: ${state.profile.name}`,
      state.profile.headline && `Headline: ${state.profile.headline}`,
      state.profile.location && `Location: ${state.profile.location}`,
      state.profile.currentCompany && `Company: ${state.profile.currentCompany}`,
      state.profile.about && `Context: ${truncate(state.profile.about, 240)}`,
      `LinkedIn: ${state.profile.url}`
    ].filter(Boolean);

    return lines.join("\n");
  }

  function buildCallOpener() {
    const name = state.profile.name ? state.profile.name.split(/\s+/)[0] : "there";
    const company = state.profile.currentCompany || "your team";
    const role = (state.profile.currentRole || state.profile.headline || "your work")
      .split(/\s+(?:at|@)\s+/i)[0]
      .trim();

    return `Hi ${name}, I noticed ${role}${company ? ` at ${company}` : ""}. I had a quick idea that may be relevant - do you have 30 seconds?`;
  }

  function statusOptionsHtml() {
    return STATUS_OPTIONS.map(([value, label]) => {
      const selected = value === state.settings.status ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function setFeedback(message) {
    const feedback = shadow.querySelector("[data-feedback]");

    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    window.clearTimeout(state.feedbackTimer);
    state.feedbackTimer = window.setTimeout(() => {
      feedback.textContent = "Saved locally in this browser.";
    }, 2500);
  }

  async function copyText(text, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      setFeedback(successMessage);
    } catch (error) {
      setFeedback("Copy failed. Try selecting the text manually.");
    }
  }

  function updateHostPosition() {
    host.style.top = `${Math.max(8, state.position.top)}px`;
    host.style.right = `${Math.max(8, state.position.right)}px`;
  }

  function timeCardHtml() {
    const timezoneDetails = getTimezoneDetails();
    const confidenceClass = timezoneDetails.guess.confidence === "high" ? "high" : "low";

    return `
      <section class="time-card ${escapeHtml(timezoneDetails.callingWindow.status)}" data-time-card>
        <div class="time-row">
          <div>
            <div class="eyebrow">Local time</div>
            <strong data-time-display>${escapeHtml(timezoneDetails.callingWindow.localTime.display)}</strong>
          </div>
          <span class="call-badge">${escapeHtml(timezoneDetails.callingWindow.label)}</span>
        </div>
        <p data-time-detail>${escapeHtml(timezoneDetails.callingWindow.detail)}</p>
        <p class="timezone-note ${confidenceClass}" title="${escapeHtml(timezoneDetails.guess.reason)}">
          ${escapeHtml(timezoneDetails.guess.label)} - ${escapeHtml(timezoneDetails.guess.timeZone)}
        </p>
      </section>
    `;
  }

  function render() {
    updateHostPosition();

    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          color: #172033;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          position: fixed;
          z-index: 2147483647;
        }

        * {
          box-sizing: border-box;
        }

        .panel {
          width: 336px;
          overflow: hidden;
          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 18px 52px rgba(15, 23, 42, 0.2);
          font-size: 13px;
          line-height: 1.45;
        }

        .header {
          align-items: center;
          background: linear-gradient(135deg, #0f172a, #1d4ed8);
          color: #ffffff;
          cursor: grab;
          display: flex;
          justify-content: space-between;
          padding: 14px 14px 12px 16px;
          user-select: none;
        }

        .header:active {
          cursor: grabbing;
        }

        .title {
          display: grid;
          gap: 2px;
        }

        .title strong {
          font-size: 15px;
          letter-spacing: 0.01em;
        }

        .title span {
          color: rgba(255, 255, 255, 0.78);
          font-size: 11px;
        }

        button,
        select,
        textarea {
          font: inherit;
        }

        .icon-button {
          align-items: center;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          height: 28px;
          justify-content: center;
          width: 28px;
        }

        .body {
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .body[hidden] {
          display: none;
        }

        .time-card,
        .profile-card,
        .controls {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px;
        }

        .time-card {
          background: #f8fafc;
        }

        .time-card.good {
          background: #ecfdf5;
          border-color: #bbf7d0;
        }

        .time-card.soon {
          background: #fffbeb;
          border-color: #fde68a;
        }

        .time-card.avoid {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .time-row {
          align-items: flex-start;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .time-row strong {
          display: block;
          font-size: 22px;
          letter-spacing: -0.03em;
        }

        .eyebrow {
          color: #64748b;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .call-badge {
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.08);
          font-size: 11px;
          font-weight: 700;
          padding: 5px 8px;
          white-space: nowrap;
        }

        p {
          margin: 8px 0 0;
        }

        .timezone-note {
          color: #64748b;
          font-size: 11px;
        }

        .timezone-note.low {
          color: #b45309;
        }

        .profile-card {
          display: grid;
          gap: 6px;
        }

        .profile-name {
          font-size: 16px;
          font-weight: 800;
        }

        .muted {
          color: #64748b;
        }

        .context {
          color: #334155;
          font-size: 12px;
          margin-top: 4px;
        }

        .controls {
          display: grid;
          gap: 10px;
        }

        label {
          color: #334155;
          display: grid;
          font-size: 12px;
          font-weight: 700;
          gap: 5px;
        }

        select,
        textarea {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          color: #172033;
          outline: none;
          padding: 9px 10px;
          width: 100%;
        }

        select:focus,
        textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        textarea {
          min-height: 78px;
          resize: vertical;
        }

        .actions {
          display: grid;
          gap: 8px;
          grid-template-columns: 1fr 1fr;
        }

        .primary-button,
        .secondary-button {
          border-radius: 10px;
          cursor: pointer;
          font-weight: 800;
          padding: 9px 10px;
        }

        .primary-button {
          background: #2563eb;
          border: 1px solid #2563eb;
          color: #ffffff;
        }

        .secondary-button {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #172033;
        }

        .feedback {
          color: #64748b;
          font-size: 11px;
          min-height: 16px;
        }

        .minimized {
          width: 260px;
        }
      </style>
      <aside class="panel ${state.minimized ? "minimized" : ""}" aria-label="Sales HUD">
        <header class="header" data-drag-handle>
          <div class="title">
            <strong>Sales HUD</strong>
            <span>LinkedIn caller intelligence</span>
          </div>
          <button class="icon-button" type="button" data-action="toggle-minimize" aria-label="${state.minimized ? "Expand" : "Minimize"}">
            ${state.minimized ? "+" : "-"}
          </button>
        </header>

        <div class="body" ${state.minimized ? "hidden" : ""}>
          ${timeCardHtml()}

          <section class="profile-card">
            <div class="profile-name">${profileFallback(state.profile.name, "LinkedIn profile")}</div>
            <div>${profileFallback(state.profile.headline, "Headline not visible yet")}</div>
            <div class="muted">${profileFallback(state.profile.location, "Location not visible")}</div>
            <div class="context">${profileFallback(truncate(state.profile.about, 180), "Open the About section for richer call context.")}</div>
          </section>

          <section class="controls">
            <label>
              Call status
              <select data-status>
                ${statusOptionsHtml()}
              </select>
            </label>

            <label>
              Notes
              <textarea data-notes placeholder="Add context, objection notes, or next step...">${escapeHtml(state.settings.notes)}</textarea>
            </label>

            <div class="actions">
              <button class="primary-button" type="button" data-action="copy-opener">Copy opener</button>
              <button class="secondary-button" type="button" data-action="copy-summary">Copy brief</button>
            </div>

            <div class="feedback" data-feedback>Saved locally in this browser.</div>
          </section>
        </div>
      </aside>
    `;

    bindEvents();
  }

  function bindEvents() {
    const toggleButton = shadow.querySelector("[data-action='toggle-minimize']");
    const statusSelect = shadow.querySelector("[data-status]");
    const notesField = shadow.querySelector("[data-notes]");
    const openerButton = shadow.querySelector("[data-action='copy-opener']");
    const summaryButton = shadow.querySelector("[data-action='copy-summary']");
    const dragHandle = shadow.querySelector("[data-drag-handle]");

    if (toggleButton) {
      toggleButton.addEventListener("click", () => {
        state.minimized = !state.minimized;
        render();
      });
    }

    if (statusSelect) {
      statusSelect.addEventListener("change", async (event) => {
        state.settings.status = event.target.value;
        await saveProfileSettings();
        setFeedback("Status saved.");
      });
    }

    if (notesField) {
      notesField.addEventListener("input", async (event) => {
        state.settings.notes = event.target.value;
        await saveProfileSettings();
        setFeedback("Notes saved.");
      });
    }

    if (openerButton) {
      openerButton.addEventListener("click", () => copyText(buildCallOpener(), "Opener copied."));
    }

    if (summaryButton) {
      summaryButton.addEventListener("click", () => copyText(buildLeadSummary(), "Lead brief copied."));
    }

    if (dragHandle) {
      bindDragging(dragHandle);
    }
  }

  function bindDragging(dragHandle) {
    let startX = 0;
    let startY = 0;
    let startTop = 0;
    let startRight = 0;

    function onPointerMove(event) {
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      state.position.top = startTop + deltaY;
      state.position.right = Math.max(8, startRight - deltaX);
      updateHostPosition();
    }

    async function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      await setInStorage({ [POSITION_KEY]: state.position });
    }

    dragHandle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      startX = event.clientX;
      startY = event.clientY;
      startTop = state.position.top;
      startRight = state.position.right;
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  function refreshTimeCard() {
    const card = shadow.querySelector("[data-time-card]");

    if (!card || state.minimized) {
      return;
    }

    const replacement = document.createElement("div");
    replacement.innerHTML = timeCardHtml().trim();
    card.replaceWith(replacement.firstElementChild);
  }

  async function loadState() {
    const result = await getFromStorage([storageKey(), POSITION_KEY]);
    state.settings = {
      ...state.settings,
      ...(result[storageKey()] || {})
    };

    if (result[POSITION_KEY]) {
      state.position = {
        ...state.position,
        ...result[POSITION_KEY]
      };
    }
  }

  async function saveProfileSettings() {
    await setInStorage({
      [storageKey()]: {
        status: state.settings.status,
        notes: state.settings.notes
      }
    });
  }

  async function updateProfile(nextProfile) {
    const previousKey = state.profile.profileKey;
    const previousFingerprint = JSON.stringify({
      name: state.profile.name,
      headline: state.profile.headline,
      location: state.profile.location,
      about: state.profile.about,
      currentRole: state.profile.currentRole,
      currentCompany: state.profile.currentCompany
    });
    const nextFingerprint = JSON.stringify({
      name: nextProfile.name,
      headline: nextProfile.headline,
      location: nextProfile.location,
      about: nextProfile.about,
      currentRole: nextProfile.currentRole,
      currentCompany: nextProfile.currentCompany
    });

    if (nextProfile.profileKey === previousKey && nextFingerprint === previousFingerprint) {
      return;
    }

    state.profile = nextProfile;

    if (nextProfile.profileKey !== previousKey) {
      state.settings = {
        status: "new",
        notes: ""
      };
      await loadState();
    }

    render();
  }

  async function start() {
    document.documentElement.appendChild(host);
    await loadState();
    render();

    window.setInterval(refreshTimeCard, 60000);

    if (window.SalesHudScraper && typeof window.SalesHudScraper.observeProfileChanges === "function") {
      window.SalesHudScraper.observeProfileChanges(updateProfile);
    }
  }

  start();
})();
