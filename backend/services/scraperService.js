import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const bb = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY,
});

export async function scrapeUrl(url) {
  let browser;

  try {
    const session = await bb.sessions.create({
      browserSettings: { blockAds: true },
    });

    browser = await chromium.connectOverCDP(session.connectUrl);

    const defaultContext = browser.contexts()[0];
    const page = defaultContext.pages()[0];

    page.setDefaultNavigationTimeout(30000);

    const startTime = Date.now();
    let response;

    try {
      response = await page.goto(url, {
        waitUntil: "domcontentloaded",
      });
    } catch (navError) {
      await browser.close().catch(() => {});
      browser = null;

      return {
        success: false,
        error: navError.message,
      };
    }

    const loadTime = Date.now() - startTime;

    await page.waitForTimeout(2000);

    // Extract all SEO-relevant data from the rendered page
    const scrapedData = await page.evaluate(() => {
      const getMeta = (name) => {
        const el =
          document.querySelector(`meta[name="${name}"]`) ||
          document.querySelector(`meta[property="${name}"]`);

        return el ? el.getAttribute("content") || "" : "";
      };

      const title = document.title || "";
      const description = getMeta("description");
      const canonical =
        document.querySelector('link[rel="canonical"]')?.href || "";
      const robots = getMeta("robots");
      const ogTitle = getMeta("og:title");
      const ogDescription = getMeta("og:description");
      const ogImage = getMeta("og:image");
      const twitterCard = getMeta("twitter:card");
      const viewport = getMeta("viewport");

      const charsetMeta = document.querySelector("meta[charset]");
      const charset = charsetMeta
        ? charsetMeta.getAttribute("charset") || ""
        : "";

      const h1Elements = document.querySelectorAll("h1");
      const h1Texts = Array.from(h1Elements).map(
        (el) => el.textContent?.trim() || ""
      );

      const headings = {
        h1: document.querySelectorAll("h1").length,
        h2: document.querySelectorAll("h2").length,
        h3: document.querySelectorAll("h3").length,
        h4: document.querySelectorAll("h4").length,
        h5: document.querySelectorAll("h5").length,
        h6: document.querySelectorAll("h6").length,
        h1Texts,
      };

      const allLinks = Array.from(
        document.querySelectorAll("a[href]")
      );

      const currentHost = window.location.hostname;
      let internalLinks = 0;
      let externalLinks = 0;

      allLinks.forEach((link) => {
        try {
          const href = link.href;

          if (
            href.startsWith("mailto:") ||
            href.startsWith("tel:")
          ) {
            return;
          }

          const linkUrl = new URL(href);

          if (linkUrl.hostname === currentHost) {
            internalLinks++;
          } else {
            externalLinks++;
          }
        } catch {}
      });

      const allImages = Array.from(
        document.querySelectorAll("img")
      );

      const missingAlt = allImages.filter(
        (img) => !img.alt || img.alt.trim() === ""
      ).length;

      const bodyText = document.body?.innerText || "";
      const wordCount = bodyText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      const pageSize = document.documentElement.outerHTML.length;

      return {
        metaData: {
          title,
          description,
          canonical,
          robots,
          ogTitle,
          ogDescription,
          ogImage,
          twitterCard,
          viewport,
          charset,
        },
        headings,
        links: {
          internal: internalLinks,
          external: externalLinks,
          total: allLinks.length,
        },
        images: {
          total: allImages.length,
          missingAlt,
          withAlt: allImages.length - missingAlt,
        },
        wordCount,
        pageSize,
        bodyText: bodyText.substring(0, 3000),
      };
    });

    const statusCode = response?.status() || 0;

    await page.close();
    await browser.close();

    return {
      success: true,
      data: {
        ...scrapedData,
        loadTime,
        statusCode,
        url,
      },
    };
  } catch (error) {
    console.error(
      "[SCRAPER] Playwright session failed:",
      error.message
    );

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error(
          "[SCRAPER] Browser close failed:",
          error.message
        );
      }
    }

    return {
      success: false,
      error: error.message,
    };
  }
}