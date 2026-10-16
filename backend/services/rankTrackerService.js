
import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

export async function rankTracker(keyword, targetDomain) {
  let browser;

  try {
    if (!process.env.BROWSERBASE_API_KEY) {
      throw new Error("BROWSERBASE_API_KEY is missing");
    }

    if (
      typeof keyword !== "string" ||
      !keyword.trim() ||
      typeof targetDomain !== "string" ||
      !targetDomain.trim()
    ) {
      throw new Error("Keyword and targetDomain are required");
    }

    let cleanTarget;

    try {
      const normalizedInput = targetDomain.includes("://")
        ? targetDomain
        : `https://${targetDomain}`;

      cleanTarget = new URL(normalizedInput).hostname
        .replace(/^www\./i, "")
        .toLowerCase();
    } catch {
      throw new Error(`Invalid target domain: ${targetDomain}`);
    }

    const session = await bb.sessions.create({
      browserSettings: { blockAds: true },
    });

    if (!session.connectUrl) {
      throw new Error("Browserbase session did not return connectUrl");
    }

    browser = await chromium.connectOverCDP(session.connectUrl);

    const contexts = browser.contexts();

    if (!contexts.length) {
      throw new Error("Browserbase browser has no browser contexts");
    }

    const pages = contexts[0].pages();
    const page = pages.length ? pages[0] : await contexts[0].newPage();

    page.setDefaultNavigationTimeout(45000);
    page.setDefaultTimeout(10000);

    await page.goto("https://www.google.com", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    try {
      const consentButton = await page.$(
        'button[id="L2AGLb"], form [action*="consent"] button'
      );

      if (consentButton) {
        await consentButton.click();
        await page.waitForTimeout(1500);
      }
    } catch {
      // Consent handling is optional.
    }

    let found = null;
    const allResults = [];

    for (let gPage = 0; gPage < 5; gPage++) {
      const searchUrl =
        `https://www.google.com/search?q=${encodeURIComponent(keyword)}` +
        `&start=${gPage * 10}&num=10&hl=en&gl=us`;

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });

      let pageResults = [];

      for (let retry = 0; retry < 3; retry++) {
        try {
          await page.waitForSelector("h3", {
            state: "attached",
            timeout: 8000,
          });

          await page.waitForTimeout(1500);

          pageResults = await page.evaluate(() => {
            const isGoogleDomain = (hostname) => {
              const host = hostname.toLowerCase();

              return (
                host === "google.com" ||
                host.endsWith(".google.com") ||
                host === "google.co.uk" ||
                host.endsWith(".google.co.uk")
              );
            };

            return Array.from(document.querySelectorAll("h3"))
              .map((h3) => {
                let anchor = h3.closest("a");

                if (!anchor) {
                  let parent = h3.parentElement;

                  for (
                    let j = 0;
                    j < 5 && parent;
                    j++, parent = parent.parentElement
                  ) {
                    if (parent.tagName === "A") {
                      anchor = parent;
                      break;
                    }

                    const candidates = parent.querySelectorAll("a[href]");

                    for (const candidate of candidates) {
                      if (candidate.contains(h3)) {
                        anchor = candidate;
                        break;
                      }
                    }

                    if (anchor) break;
                  }
                }

                if (!anchor) return null;

                // Prefer a direct destination URL when Google provides one.
                const candidateUrls = [
                  anchor.getAttribute("data-href"),
                  anchor.getAttribute("href"),
                ].filter(Boolean);

                let resultUrl = null;

                for (const candidate of candidateUrls) {
                  try {
                    const parsed = new URL(candidate, location.origin);

                    if (
                      !["http:", "https:"].includes(parsed.protocol) ||
                      isGoogleDomain(parsed.hostname)
                    ) {
                      continue;
                    }

                    resultUrl = parsed;
                    break;
                  } catch {
                    // Ignore invalid candidate URLs.
                  }
                }

                // Google /goto?url=CAES... links are opaque redirects.
                // Do not count these as organic results unless their
                // actual destination can be resolved.
                if (!resultUrl) return null;

                let snippet = "";
                let container = anchor.parentElement;

                for (
                  let j = 0;
                  j < 6 && container;
                  j++, container = container.parentElement
                ) {
                  const text = container.innerText || "";
                  const headingText = (h3.innerText || "").trim();

                  if (text.length > headingText.length + 50) {
                    snippet = (
                      text
                        .split("\n")
                        .find(
                          (line) =>
                            line.length > 30 &&
                            !line.includes(headingText.substring(0, 20))
                        ) || ""
                    )
                      .trim()
                      .substring(0, 300);

                    if (snippet) break;
                  }
                }

                return {
                  url: resultUrl.href,
                  domain: resultUrl.hostname
                    .replace(/^www\./i, "")
                    .toLowerCase(),
                  title: (h3.innerText || h3.textContent || "").trim(),
                  snippet,
                };
              })
              .filter(Boolean);
          });

          if (pageResults.length > 0) {
            break;
          }

          if (retry < 2) {
            await page.reload({
              waitUntil: "domcontentloaded",
              timeout: 45000,
            });
          }
        } catch {
          if (retry < 2) {
            try {
              await page.reload({
                waitUntil: "domcontentloaded",
                timeout: 45000,
              });
            } catch {
              // Continue to the next extraction attempt.
            }
          }
        }
      }

      if (!pageResults.length) {
        break;
      }

      for (const result of pageResults) {
        result.position = allResults.length + 1;
        allResults.push(result);

        const domainMatches =
          result.domain === cleanTarget ||
          result.domain.endsWith(`.${cleanTarget}`);

        if (!found && domainMatches) {
          found = { ...result, page: gPage + 1 };
        }
      }

      if (found) {
        break;
      }

      if (gPage < 4) {
        const delay = 2000 + Math.random() * 2000;
        await page.waitForTimeout(delay);
      }
    }

    const competitors = allResults
      .filter((result) => {
        const matchesTarget =
          result.domain === cleanTarget ||
          result.domain.endsWith(`.${cleanTarget}`);

        return !matchesTarget;
      })
      .slice(0, 10);

    await browser.close();
    browser = null;

    if (allResults.length === 0) {
      return {
        success: false,
        error:
          "Google search results could not be extracted. " +
          "Google may have changed its result URLs or page layout.",
      };
    }

    return {
      success: true,
      data: {
        keyword,
        targetDomain,
        position: found?.position ?? null,
        page: found?.page ?? null,
        title: found?.title || "",
        snippet: found?.snippet || "",
        competitors,
        totalResultsScanned: allResults.length,
      },
    };
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore cleanup errors.
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
}
