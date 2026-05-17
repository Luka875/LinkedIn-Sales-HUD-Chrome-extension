(function initSalesHudScraper() {
  "use strict";

  const NOISE_PATTERNS = [
    /^about$/i,
    /^activity$/i,
    /^experience$/i,
    /^education$/i,
    /^show all/i,
    /^see more/i,
    /^see less/i,
    /^connect$/i,
    /^message$/i,
    /^follow$/i,
    /^more$/i,
    /^profile language$/i,
    /^public profile/i
  ];

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isUsefulLine(line) {
    const text = cleanText(line);
    return text.length > 1 && !NOISE_PATTERNS.some((pattern) => pattern.test(text));
  }

  function uniqueLines(lines) {
    const seen = new Set();
    const output = [];

    for (const line of lines.map(cleanText).filter(isUsefulLine)) {
      const key = line.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        output.push(line);
      }
    }

    return output;
  }

  function firstText(selectors, root) {
    for (const selector of selectors) {
      const element = (root || document).querySelector(selector);
      const text = cleanText(element && element.textContent);

      if (text) {
        return text;
      }
    }

    return "";
  }

  function getVisibleLines(root) {
    if (!root) {
      return [];
    }

    const candidates = Array.from(root.querySelectorAll("span[aria-hidden='true'], li, p"))
      .map((element) => cleanText(element.textContent))
      .flatMap((line) => line.split(/\n+/));

    return uniqueLines(candidates);
  }

  function findSection(label) {
    const normalizedLabel = label.toLowerCase();
    const sections = Array.from(document.querySelectorAll("main section, section"));

    return sections.find((section) => {
      const headingText = firstText(["h2", "h3"], section).toLowerCase();
      const anchor = section.querySelector(`[id='${normalizedLabel}']`);
      const ariaLabel = cleanText(section.getAttribute("aria-label")).toLowerCase();

      return (
        headingText.includes(normalizedLabel) ||
        Boolean(anchor) ||
        ariaLabel.includes(normalizedLabel)
      );
    });
  }

  function getProfileKey() {
    const match = window.location.pathname.match(/\/in\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : window.location.href;
  }

  function getName() {
    return firstText([
      "main h1",
      "section h1",
      "h1"
    ]);
  }

  function getHeadline() {
    const topCard = document.querySelector(".pv-text-details__left-panel, main section");

    return firstText([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "[data-generated-suggestion-target] + div",
      ".ph5 .mt2 .text-body-medium"
    ], topCard || document);
  }

  function getLocation() {
    return firstText([
      ".pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words",
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-top-card--list-bullet span"
    ]);
  }

  function getAbout() {
    const aboutSection = findSection("about");
    const lines = getVisibleLines(aboutSection);
    const aboutIndex = lines.findIndex((line) => /^about$/i.test(line));

    return lines
      .slice(aboutIndex >= 0 ? aboutIndex + 1 : 0)
      .filter((line) => !/^top skills$/i.test(line))
      .join(" ")
      .slice(0, 700);
  }

  function getExperienceLines() {
    const experienceSection = findSection("experience");
    const lines = getVisibleLines(experienceSection);
    const experienceIndex = lines.findIndex((line) => /^experience$/i.test(line));

    return lines.slice(experienceIndex >= 0 ? experienceIndex + 1 : 0).slice(0, 8);
  }

  function getCompanyFromHeadline(headline) {
    const match = cleanText(headline).match(/\b(?:at|@)\s+(.+)$/i);
    return match ? match[1].replace(/\s+\|\s+.*$/, "").trim() : "";
  }

  function snapshot() {
    const headline = getHeadline();
    const experience = getExperienceLines();
    const currentRole = experience[0] || headline;
    const currentCompany = getCompanyFromHeadline(headline) || experience[1] || "";

    return {
      profileKey: getProfileKey(),
      url: window.location.href,
      name: getName(),
      headline,
      location: getLocation(),
      about: getAbout(),
      currentRole,
      currentCompany,
      experience,
      scrapedAt: new Date().toISOString()
    };
  }

  function observeProfileChanges(callback) {
    let timer = 0;
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(snapshot()), 600);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }

  window.SalesHudScraper = {
    snapshot,
    observeProfileChanges
  };
})();
