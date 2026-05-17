(function initSalesHudTimezone() {
  "use strict";

  const DEFAULT_TIME_ZONE = "UTC";

  const LOCATION_RULES = [
    {
      timeZone: "America/Los_Angeles",
      label: "Pacific Time",
      keywords: [
        "san francisco",
        "bay area",
        "silicon valley",
        "san jose",
        "los angeles",
        "la area",
        "orange county",
        "san diego",
        "seattle",
        "portland",
        "vancouver",
        "british columbia",
        "california",
        "washington state",
        "oregon"
      ]
    },
    {
      timeZone: "America/Denver",
      label: "Mountain Time",
      keywords: ["denver", "boulder", "salt lake city", "utah", "colorado", "arizona", "phoenix", "calgary", "edmonton"]
    },
    {
      timeZone: "America/Chicago",
      label: "Central Time",
      keywords: [
        "chicago",
        "austin",
        "dallas",
        "houston",
        "minneapolis",
        "nashville",
        "st louis",
        "kansas city",
        "toronto",
        "winnipeg",
        "illinois",
        "texas",
        "ontario"
      ]
    },
    {
      timeZone: "America/New_York",
      label: "Eastern Time",
      keywords: [
        "new york",
        "nyc",
        "boston",
        "washington dc",
        "washington d.c.",
        "philadelphia",
        "miami",
        "atlanta",
        "charlotte",
        "raleigh",
        "montreal",
        "ottawa",
        "massachusetts",
        "new jersey",
        "pennsylvania",
        "florida",
        "georgia"
      ]
    },
    {
      timeZone: "America/Sao_Paulo",
      label: "Brasilia Time",
      keywords: ["sao paulo", "são paulo", "rio de janeiro", "brazil", "brasil"]
    },
    {
      timeZone: "Europe/London",
      label: "UK Time",
      keywords: ["london", "united kingdom", "uk", "england", "scotland", "wales", "ireland", "dublin"]
    },
    {
      timeZone: "Europe/Paris",
      label: "Central European Time",
      keywords: [
        "paris",
        "france",
        "berlin",
        "germany",
        "amsterdam",
        "netherlands",
        "madrid",
        "spain",
        "rome",
        "italy",
        "stockholm",
        "sweden",
        "zurich",
        "switzerland",
        "warsaw",
        "poland"
      ]
    },
    {
      timeZone: "Europe/Belgrade",
      label: "Serbia Time",
      keywords: ["serbia", "belgrade", "beograd", "novi sad", "nis", "niš", "kragujevac"]
    },
    {
      timeZone: "Asia/Dubai",
      label: "Gulf Time",
      keywords: ["dubai", "abu dhabi", "united arab emirates", "uae"]
    },
    {
      timeZone: "Asia/Kolkata",
      label: "India Time",
      keywords: ["india", "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "hyderabad", "pune", "chennai"]
    },
    {
      timeZone: "Asia/Singapore",
      label: "Singapore Time",
      keywords: ["singapore", "kuala lumpur", "malaysia"]
    },
    {
      timeZone: "Asia/Tokyo",
      label: "Japan Time",
      keywords: ["tokyo", "japan", "osaka"]
    },
    {
      timeZone: "Australia/Sydney",
      label: "Australia Eastern Time",
      keywords: ["sydney", "melbourne", "canberra", "australia", "new south wales", "victoria"]
    }
  ];

  function normalizeLocation(location) {
    return String(location || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\w\s.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getBrowserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  }

  function guessTimeZone(location) {
    const normalizedLocation = normalizeLocation(location);

    if (!normalizedLocation) {
      return {
        timeZone: getBrowserTimeZone(),
        label: "Browser time",
        confidence: "low",
        matchedOn: "",
        reason: "No LinkedIn location found."
      };
    }

    for (const rule of LOCATION_RULES) {
      const match = rule.keywords.find((keyword) => normalizedLocation.includes(normalizeLocation(keyword)));

      if (match) {
        return {
          timeZone: rule.timeZone,
          label: rule.label,
          confidence: "high",
          matchedOn: match,
          reason: `Matched "${match}" from the LinkedIn location.`
        };
      }
    }

    return {
      timeZone: getBrowserTimeZone(),
      label: "Browser time",
      confidence: "low",
      matchedOn: "",
      reason: "Location was not recognized; using browser time as a fallback."
    };
  }

  function getLocalTimeParts(timeZone, date) {
    const safeDate = date || new Date();
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false
    });

    const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short"
    });

    return {
      display: formatter.format(safeDate),
      hour: Number(hourFormatter.format(safeDate)),
      weekday: weekdayFormatter.format(safeDate)
    };
  }

  function getCallingWindow(timeZone, date) {
    const localTime = getLocalTimeParts(timeZone, date);
    const isWeekend = localTime.weekday === "Sat" || localTime.weekday === "Sun";

    if (isWeekend) {
      return {
        status: "avoid",
        label: "Weekend",
        detail: "Best to schedule for a weekday.",
        localTime
      };
    }

    if (localTime.hour < 8) {
      return {
        status: "soon",
        label: "Too early",
        detail: "Queue for later this morning.",
        localTime
      };
    }

    if (localTime.hour < 12) {
      return {
        status: "good",
        label: "Good calling window",
        detail: "Morning outreach is usually safe.",
        localTime
      };
    }

    if (localTime.hour < 14) {
      return {
        status: "soon",
        label: "Lunch window",
        detail: "Try early afternoon if this is a cold call.",
        localTime
      };
    }

    if (localTime.hour < 17) {
      return {
        status: "good",
        label: "Good calling window",
        detail: "Afternoon outreach is usually safe.",
        localTime
      };
    }

    if (localTime.hour < 19) {
      return {
        status: "soon",
        label: "Late day",
        detail: "Consider email now and a call tomorrow.",
        localTime
      };
    }

    return {
      status: "avoid",
      label: "After hours",
      detail: "Avoid calling unless there is an agreed time.",
      localTime
    };
  }

  window.SalesHudTimezone = {
    guessTimeZone,
    getCallingWindow,
    getLocalTimeParts
  };
})();
