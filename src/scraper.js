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

  const LOCATION_KEYWORDS = [
    "area",
    "region",
    "united states",
    "canada",
    "united kingdom",
    "germany",
    "france",
    "spain",
    "italy",
    "netherlands",
    "india",
    "australia",
    "singapore",
    "brazil",
    "new york",
    "san francisco",
    "los angeles",
    "london",
    "berlin",
    "paris",
    "toronto",
    "sydney"
  ];

  const TOP_CARD_NOISE_PATTERNS = [
    /connections$/i,
    /followers$/i,
    /^contact info$/i,
    /^message$/i,
    /^connect$/i,
    /^follow$/i,
    /^more$/i,
    /^open to$/i,
    /^premium$/i,
    /^verified$/i,
    /degree$/i,
    /^you both/i,
    /^mutual connection/i
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

  function getMetaContent(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content = cleanText(element && element.getAttribute("content"));

      if (content) {
        return content;
      }
    }

    return "";
  }

  function getTitleParts() {
    const rawTitle = getMetaContent([
      "meta[property='og:title']",
      "meta[name='twitter:title']"
    ]) || document.title;

    const title = cleanText(rawTitle)
      .replace(/\s+\|\s+LinkedIn.*$/i, "")
      .replace(/\s+-\s+LinkedIn.*$/i, "");

    if (!title || /^linkedin/i.test(title)) {
      return {
        name: "",
        headline: ""
      };
    }

    const parts = title
      .split(/\s+[-–—]\s+/)
      .map(cleanText)
      .filter(Boolean);

    return {
      name: parts[0] || "",
      headline: parts.slice(1).join(" - ")
    };
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

  function getTopCard() {
    const nameHeading = document.querySelector("main h1, h1");

    if (nameHeading) {
      const headingSection = nameHeading.closest("section");

      if (headingSection) {
        return headingSection;
      }
    }

    return document.querySelector(".pv-top-card, .pv-text-details__left-panel, main section");
  }

  function isTopCardNoise(line) {
    const text = cleanText(line);
    return (
      !text ||
      text.length > 180 ||
      TOP_CARD_NOISE_PATTERNS.some((pattern) => pattern.test(text))
    );
  }

  function getTopCardLines() {
    const topCard = getTopCard();

    if (!topCard) {
      return [];
    }

    const candidates = Array.from(topCard.querySelectorAll("h1, h2, span, div"))
      .map((element) => cleanText(element.textContent))
      .flatMap((line) => line.split(/\n+/))
      .filter((line) => isUsefulLine(line) && !isTopCardNoise(line));

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

  function getNameFromDom() {
    return firstText([
      "main h1",
      "section h1",
      "h1"
    ]);
  }

  function getName() {
    return getNameFromDom() || getTitleParts().name;
  }

  function getHeadline() {
    const topCard = getTopCard();
    const directHeadline = firstText([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "[data-generated-suggestion-target] + div",
      ".ph5 .mt2 .text-body-medium"
    ], topCard || document);

    if (directHeadline) {
      return directHeadline;
    }

    const name = getName();
    const titleHeadline = getTitleParts().headline;
    const topCardHeadline = getTopCardLines().find((line) => {
      const normalizedLine = line.toLowerCase();
      return (
        line !== name &&
        normalizedLine !== name.toLowerCase() &&
        !looksLikeLocation(line) &&
        !/@/.test(line) &&
        !/^https?:\/\//i.test(line)
      );
    });

    return topCardHeadline || titleHeadline;
  }

  function looksLikeLocation(line) {
    const text = cleanText(line);
    const normalized = text.toLowerCase();

    if (!text || isTopCardNoise(text) || /\d/.test(text)) {
      return false;
    }

    if (text.includes(",")) {
      return true;
    }

    return LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  function getLocation() {
    const directLocation = firstText([
      ".pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words",
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-top-card--list-bullet span"
    ]);

    if (directLocation && looksLikeLocation(directLocation)) {
      return directLocation;
    }

    return getTopCardLines().find(looksLikeLocation) || directLocation;
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
