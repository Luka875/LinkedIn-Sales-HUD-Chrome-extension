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
    "serbia",
    "belgrade",
    "beograd",
    "novi sad",
    "new york",
    "detroit",
    "detroit metropolitan area",
    "michigan",
    "san francisco",
    "los angeles",
    "london",
    "berlin",
    "paris",
    "toronto",
    "greater toronto area",
    "ontario",
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
    /^home$/i,
    /^my network$/i,
    /^jobs$/i,
    /^messaging$/i,
    /^notifications$/i,
    /^sales nav$/i,
    /^for business$/i,
    /^save in sales navigator$/i,
    /^open to$/i,
    /^premium$/i,
    /^verified$/i,
    /degree$/i,
    /^you both/i,
    /^mutual connection/i
  ];

  const LOCATION_HINTS = [
    { pattern: /\bdetroit metropolitan area\b/i, label: "Detroit Metropolitan Area, United States" },
    { pattern: /\bdetroit\b/i, label: "Detroit, Michigan, United States" },
    { pattern: /\bmichigan\b/i, label: "Michigan, United States" },
    { pattern: /\bgreater toronto area\b/i, label: "Greater Toronto Area, Canada" },
    { pattern: /\btoronto\b/i, label: "Toronto, Ontario, Canada" },
    { pattern: /\bontario\b/i, label: "Ontario, Canada" },
    { pattern: /\bcanada\b/i, label: "Canada" },
    { pattern: /\bserbia\b/i, label: "Serbia" },
    { pattern: /\bbelgrade\b|\bbeograd\b/i, label: "Belgrade, Serbia" },
    { pattern: /\bnovi sad\b/i, label: "Novi Sad, Serbia" },
    { pattern: /\bnew york\b/i, label: "New York, United States" },
    { pattern: /\bsan francisco\b|\bbay area\b/i, label: "San Francisco Bay Area, United States" },
    { pattern: /\blos angeles\b/i, label: "Los Angeles, United States" },
    { pattern: /\blondon\b/i, label: "London, United Kingdom" },
    { pattern: /\bparis\b/i, label: "Paris, France" },
    { pattern: /\bberlin\b/i, label: "Berlin, Germany" },
    { pattern: /\bsydney\b/i, label: "Sydney, Australia" }
  ];

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitTextLines(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .split(/\n+/)
      .map(cleanText)
      .filter(Boolean);
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

  function getDescriptionParts() {
    const description = getMetaContent([
      "meta[name='description']",
      "meta[property='og:description']",
      "meta[name='twitter:description']"
    ]);

    const viewProfileMatch = description.match(/View\s+(.+?)['’]s\s+profile\s+on\s+LinkedIn/i);

    if (viewProfileMatch) {
      return {
        name: cleanText(viewProfileMatch[1]),
        headline: ""
      };
    }

    const profileMatch = description.match(/^(.+?)\s+-\s+(.+?)(?:\s+-\s+LinkedIn|\s+\|\s+LinkedIn|$)/i);

    if (profileMatch) {
      return {
        name: cleanText(profileMatch[1]),
        headline: cleanText(profileMatch[2])
      };
    }

    return {
      name: "",
      headline: ""
    };
  }

  function humanizeProfileSlug() {
    const key = getProfileKey()
      .replace(/[?#].*$/, "")
      .replace(/[_+]+/g, "-");

    const tokens = key
      .split("-")
      .filter(Boolean)
      .filter((token) => !/\d/.test(token))
      .filter((token) => !/^[a-f0-9]{6,}$/i.test(token))
      .slice(0, 3);

    if (!tokens.length) {
      return "";
    }

    return tokens
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
      .join(" ");
  }

  function normalizeJsonLdType(type) {
    if (Array.isArray(type)) {
      return type.map(normalizeJsonLdType).join(" ");
    }

    return cleanText(type).toLowerCase();
  }

  function collectJsonLdObjects(value, output) {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectJsonLdObjects(item, output));
      return;
    }

    if (typeof value !== "object") {
      return;
    }

    output.push(value);

    if (value["@graph"]) {
      collectJsonLdObjects(value["@graph"], output);
    }

    for (const nestedValue of Object.values(value)) {
      if (nestedValue && typeof nestedValue === "object") {
        collectJsonLdObjects(nestedValue, output);
      }
    }
  }

  function getJsonLdObjects() {
    const objects = [];

    for (const script of document.querySelectorAll("script[type='application/ld+json']")) {
      try {
        collectJsonLdObjects(JSON.parse(script.textContent || "{}"), objects);
      } catch (error) {
        // LinkedIn occasionally emits non-profile JSON-LD; ignore malformed entries.
      }
    }

    return objects;
  }

  function getJsonValue(value) {
    if (Array.isArray(value)) {
      return value.map(getJsonValue).filter(Boolean).join(", ");
    }

    if (value && typeof value === "object") {
      return cleanText(value.name || value["@id"] || value.text || "");
    }

    return cleanText(value);
  }

  function getJsonLdProfile() {
    const person = getJsonLdObjects().find((item) => {
      const type = normalizeJsonLdType(item["@type"]);
      return type.includes("person") || type.includes("profilepage");
    });

    if (!person) {
      return {
        name: "",
        headline: "",
        location: "",
        company: ""
      };
    }

    const address = person.address || person.homeLocation || person.location;
    const organization = person.worksFor || person.affiliation || person.memberOf;
    const location = address && typeof address === "object"
      ? [
          address.addressLocality,
          address.addressRegion,
          address.addressCountry && getJsonValue(address.addressCountry)
        ].map(cleanText).filter(Boolean).join(", ")
      : getJsonValue(address);

    return {
      name: getJsonValue(person.name),
      headline: getJsonValue(person.jobTitle || person.description),
      location,
      company: getJsonValue(organization)
    };
  }

  function isVisibleElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      element.getClientRects().length > 0
    );
  }

  function getTextNodeRect(node) {
    const range = document.createRange();

    try {
      range.selectNodeContents(node);
      const rect = Array.from(range.getClientRects()).find((candidate) => candidate.width > 0 && candidate.height > 0);
      return rect || node.parentElement.getBoundingClientRect();
    } finally {
      range.detach();
    }
  }

  function getPositionedTextEntries() {
    const entries = [];
    const maxLeft = Math.max(760, window.innerWidth * 0.78);
    const maxTop = Math.max(520, window.innerHeight * 0.68);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = cleanText(node.nodeValue);

        if (
          !text ||
          !node.parentElement ||
          node.parentElement.closest("#sales-hud-root") ||
          !isVisibleElement(node.parentElement)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = cleanText(node.nodeValue);
      const rect = getTextNodeRect(node);

      if (
        !rect ||
        rect.top < 45 ||
        rect.top > maxTop ||
        rect.left < 0 ||
        rect.left > maxLeft ||
        rect.width < 8 ||
        rect.height < 6 ||
        text.length > 180
      ) {
        continue;
      }

      const style = window.getComputedStyle(node.parentElement);
      entries.push({
        text,
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        fontSize: Number.parseFloat(style.fontSize) || 0,
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400
      });
    }

    const seen = new Set();

    return entries
      .sort((first, second) => first.top - second.top || first.left - second.left)
      .filter((entry) => {
        if (isTopCardNoise(entry.text)) {
          return false;
        }

        const key = `${entry.text.toLowerCase()}@${Math.round(entry.top / 4)}:${Math.round(entry.left / 4)}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }

  function getPositionedProfile() {
    const entries = getPositionedTextEntries();
    const likelyCardEntries = entries.filter((entry) => {
      const text = entry.text;
      return (
        entry.left < Math.max(560, window.innerWidth * 0.58) &&
        !/^sales insights$/i.test(text) &&
        !/^key signals$/i.test(text) &&
        !/^people who can introduce you$/i.test(text) &&
        !/^recently hired by/i.test(text) &&
        !/^shared group/i.test(text)
      );
    });
    const nameEntry =
      likelyCardEntries.find((entry) => looksLikeName(entry.text) && (entry.fontSize >= 16 || entry.fontWeight >= 600)) ||
      likelyCardEntries.find((entry) => looksLikeName(entry.text));
    const afterNameEntries = nameEntry
      ? likelyCardEntries.filter((entry) => entry.top >= nameEntry.top && entry.top <= nameEntry.top + 150)
      : likelyCardEntries.slice(0, 30);
    const locationEntry =
      afterNameEntries.find((entry) => looksLikeLocation(normalizeLocationCandidate(entry.text))) ||
      likelyCardEntries.find((entry) => looksLikeLocation(normalizeLocationCandidate(entry.text)));
    const headlineEntry = afterNameEntries.find((entry) => {
      const text = entry.text;

      return (
        (!nameEntry || entry.top >= nameEntry.top) &&
        text !== (nameEntry && nameEntry.text) &&
        text !== (locationEntry && locationEntry.text) &&
        looksLikeHeadline(text, nameEntry ? cleanNameCandidate(nameEntry.text) : "")
      );
    });

    return {
      name: nameEntry ? cleanNameCandidate(nameEntry.text) : "",
      headline: headlineEntry ? headlineEntry.text : "",
      location: locationEntry ? normalizeLocationCandidate(locationEntry.text) : detectKnownLocation(afterNameEntries.map((entry) => entry.text)),
      debugLines: likelyCardEntries.slice(0, 45).map((entry) => `${entry.text} [${entry.left},${entry.top}]`)
    };
  }

  function getVisibleTextLines(root) {
    const scope = root || document.querySelector("main") || document.body;
    const lines = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = cleanText(node.nodeValue);

        if (!text || !node.parentElement || !isVisibleElement(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    while (walker.nextNode()) {
      lines.push(walker.currentNode.nodeValue);
    }

    return uniqueLines(lines);
  }

  function getViewportTextLines() {
    const selectors = [
      "body h1",
      "body h2",
      "body h3",
      "body span",
      "body div",
      "body p",
      "body a",
      "body button"
    ].join(",");
    const lines = [];
    const maxLeft = Math.max(760, window.innerWidth * 0.78);
    const maxTop = Math.max(560, window.innerHeight * 0.72);

    for (const element of document.querySelectorAll(selectors)) {
      if (!isVisibleElement(element) || element.closest("#sales-hud-root")) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (
        rect.top < 35 ||
        rect.top > maxTop ||
        rect.left < 0 ||
        rect.left > maxLeft ||
        rect.width < 20 ||
        rect.height < 8
      ) {
        continue;
      }

      splitTextLines(element.innerText || element.textContent || element.getAttribute("aria-label") || element.getAttribute("title"))
        .filter((line) => line.length > 1 && line.length < 180)
        .forEach((line) => lines.push(line));
    }

    return uniqueLines([...lines, ...getAttributeTextLines()]).filter((line) => !isTopCardNoise(line));
  }

  function getAttributeTextLines() {
    const lines = [];

    for (const element of document.querySelectorAll("body [aria-label], body [title], body img[alt]")) {
      if (element.closest("#sales-hud-root")) {
        continue;
      }

      const rect = element.getBoundingClientRect();

      if (
        rect.top < 35 ||
        rect.top > Math.max(620, window.innerHeight * 0.75) ||
        rect.left > Math.max(820, window.innerWidth * 0.82)
      ) {
        continue;
      }

      [element.getAttribute("aria-label"), element.getAttribute("title"), element.getAttribute("alt")]
        .map(cleanText)
        .filter((line) => line.length > 1 && line.length < 180)
        .forEach((line) => lines.push(line));
    }

    return uniqueLines(lines);
  }

  function detectKnownLocation(lines) {
    for (const line of lines.map(normalizeLocationCandidate)) {
      if (!line || isTopCardNoise(line)) {
        continue;
      }

      for (const hint of LOCATION_HINTS) {
        if (hint.pattern.test(line)) {
          return line.length <= 80 ? line : hint.label;
        }
      }
    }

    return "";
  }

  function cleanNameCandidate(line) {
    return cleanText(line)
      .replace(/\s*[·•]\s*(?:1st|2nd|3rd|\d+(?:st|nd|rd|th))\b.*$/i, "")
      .replace(/\s+\b(?:1st|2nd|3rd|\d+(?:st|nd|rd|th))\b.*$/i, "")
      .replace(/\s*\([^)]{1,40}\)\s*$/g, "")
      .replace(/\s+verified\s*$/i, "")
      .trim();
  }

  function looksLikeName(line) {
    const text = cleanNameCandidate(line);
    const words = text.split(/\s+/).filter(Boolean);

    if (
      words.length < 2 ||
      words.length > 5 ||
      looksLikeLocation(text) ||
      looksLikeWebsiteOrHandle(text) ||
      text.includes("|") ||
      /[,/@]/.test(text)
    ) {
      return false;
    }

    return words.every((word) => /^[A-Z][A-Za-z'’-]{1,}$/.test(word));
  }

  function normalizeLocationCandidate(line) {
    return cleanText(line)
      .replace(/\s*[·•]\s*Contact info.*$/i, "")
      .replace(/\s*Contact info.*$/i, "")
      .trim();
  }

  function getVisibleProfile() {
    const positionedProfile = getPositionedProfile();
    const lines = getViewportTextLines();
    const nameIndex = lines.findIndex(looksLikeName);
    const name = nameIndex >= 0 ? cleanNameCandidate(lines[nameIndex]) : "";
    const searchStart = nameIndex >= 0 ? nameIndex + 1 : 0;
    const searchWindow = lines.slice(searchStart, searchStart + 14);
    const location = normalizeLocationCandidate(
      detectKnownLocation(searchWindow) ||
      detectKnownLocation(lines) ||
      searchWindow.find((line) => looksLikeLocation(normalizeLocationCandidate(line))) ||
      lines.find((line) => looksLikeLocation(normalizeLocationCandidate(line))) ||
      ""
    );
    const headline =
      searchWindow.find((line) => looksLikeHeadline(line, name)) ||
      lines.find((line) => looksLikeHeadline(line, name)) ||
      "";

    return {
      name: positionedProfile.name || name,
      headline: positionedProfile.headline || headline,
      location: positionedProfile.location || location,
      debugLines: [
        ...positionedProfile.debugLines,
        ...lines.slice(0, 30)
      ].slice(0, 60)
    };
  }

  function getVisibleLines(root) {
    if (!root) {
      return [];
    }

    const candidates = Array.from(root.querySelectorAll("span[aria-hidden='true'], li, p"))
      .flatMap((element) => splitTextLines(element.textContent));

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
      return getVisibleTextLines().slice(0, 80);
    }

    const elementLines = Array.from(topCard.querySelectorAll("h1, h2, span, div"))
      .flatMap((element) => splitTextLines(element.innerText || element.textContent))
      .filter((line) => isUsefulLine(line) && !isTopCardNoise(line));

    return uniqueLines([
      ...elementLines,
      ...getVisibleTextLines(topCard),
      ...getVisibleTextLines().slice(0, 80)
    ]).filter((line) => !isTopCardNoise(line));
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
    const visibleProfile = getVisibleProfile();
    const jsonLdProfile = getJsonLdProfile();
    const titleParts = getTitleParts();
    const descriptionParts = getDescriptionParts();
    const visibleName = getTopCardLines().find((line) => {
      const wordCount = line.split(/\s+/).length;
      return (
        wordCount >= 2 &&
        wordCount <= 4 &&
        /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+$/.test(line)
      );
    });

    return (
      visibleProfile.name ||
      getNameFromDom() ||
      jsonLdProfile.name ||
      titleParts.name ||
      descriptionParts.name ||
      visibleName ||
      humanizeProfileSlug()
    );
  }

  function getHeadline() {
    const topCard = getTopCard();
    const visibleProfile = getVisibleProfile();
    const jsonLdProfile = getJsonLdProfile();
    const titleParts = getTitleParts();
    const descriptionParts = getDescriptionParts();
    const directHeadline = firstText([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "[data-generated-suggestion-target] + div",
      ".ph5 .mt2 .text-body-medium"
    ], topCard || document);

    const name = getName();

    if (visibleProfile.headline) {
      return visibleProfile.headline;
    }

    if (directHeadline && looksLikeHeadline(directHeadline, name)) {
      return directHeadline;
    }

    const headlineCandidates = getTopCardLines().filter((line) => looksLikeHeadline(line, name));
    const topCardHeadline =
      headlineCandidates.find((line) => line.includes("|")) ||
      headlineCandidates[0] ||
      "";

    return topCardHeadline || jsonLdProfile.headline || titleParts.headline || descriptionParts.headline;
  }

  function looksLikeLocation(line) {
    const text = cleanText(line);
    const normalized = text.toLowerCase();

    if (!text || isTopCardNoise(text) || /\d/.test(text)) {
      return false;
    }

    return LOCATION_KEYWORDS.some((keyword) => normalized.includes(keyword));
  }

  function looksLikeWebsiteOrHandle(line) {
    const text = cleanText(line);
    return (
      /^https?:\/\//i.test(text) ||
      /^www\./i.test(text) ||
      /^[a-z0-9-]+\.[a-z]{2,}(?:\/.*)?$/i.test(text) ||
      /^@/.test(text)
    );
  }

  function looksLikeHeadline(line, name) {
    const text = cleanText(line);
    const normalized = text.toLowerCase();

    if (
      !text ||
      text === name ||
      normalized === cleanText(name).toLowerCase() ||
      looksLikeLocation(text) ||
      looksLikeWebsiteOrHandle(text) ||
      text.length < 8
    ) {
      return false;
    }

    return (
      text.includes("|") ||
      /\b(founder|sales|business|development|revenue|marketing|engineer|manager|director|lead|consultant|saas|b2b|reports?)\b/i.test(text) ||
      text.split(/\s+/).length >= 4
    );
  }

  function getLocation() {
    const visibleProfile = getVisibleProfile();
    const jsonLdProfile = getJsonLdProfile();
    const directLocation = firstText([
      ".pv-text-details__left-panel span.text-body-small.inline.t-black--light.break-words",
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-top-card--list-bullet span"
    ]);

    if (directLocation && looksLikeLocation(directLocation)) {
      return directLocation;
    }

    return (
      visibleProfile.location ||
      detectKnownLocation(getTopCardLines()) ||
      detectKnownLocation(getVisibleTextLines()) ||
      (jsonLdProfile.location && looksLikeLocation(jsonLdProfile.location) ? jsonLdProfile.location : "") ||
      normalizeLocationCandidate(getTopCardLines().find((line) => looksLikeLocation(normalizeLocationCandidate(line)))) ||
      normalizeLocationCandidate(getVisibleTextLines().find((line) => looksLikeLocation(normalizeLocationCandidate(line)))) ||
      directLocation ||
      jsonLdProfile.location
    );
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
    const visibleProfile = getVisibleProfile();
    const headline = visibleProfile.headline || getHeadline();
    const experience = getExperienceLines();
    const currentRole = experience[0] || headline;
    const currentCompany = getCompanyFromHeadline(headline) || experience[1] || "";

    return {
      profileKey: getProfileKey(),
      url: window.location.href,
      name: visibleProfile.name || getName(),
      headline,
      location: visibleProfile.location || getLocation(),
      about: getAbout(),
      currentRole,
      currentCompany,
      experience,
      debugLines: visibleProfile.debugLines,
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
