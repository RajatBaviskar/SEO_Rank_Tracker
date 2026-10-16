
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const seoAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        overallScore: {
            type: Type.INTEGER,
        },
        categories: {
            type: Type.OBJECT,
            properties: {
                seo: { type: Type.INTEGER },
                performance: { type: Type.INTEGER },
                accessibility: { type: Type.INTEGER },
                bestPractices: { type: Type.INTEGER },
            },
            required: [
                "seo",
                "performance",
                "accessibility",
                "bestPractices",
            ],
        },
        keywords: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    count: { type: Type.INTEGER },
                    density: { type: Type.NUMBER },
                },
                required: ["word", "count", "density"],
            },
        },
        issues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    severity: {
                        type: Type.STRING,
                        enum: ["critical", "warning", "info"],
                    },
                    category: { type: Type.STRING },
                    message: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                },
                required: [
                    "severity",
                    "category",
                    "message",
                    "recommendation",
                ],
            },
        },
    },
    required: ["overallScore", "categories", "keywords", "issues"],
};

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export async function analyzeSeoData(scrapedData) {
    if (!process.env.GEMINI_API_KEY) {
        return {
            success: false,
            error: "GEMINI_API_KEY is missing from the backend environment.",
        };
    }

    const metaData = scrapedData.metaData || {};
    const headings = scrapedData.headings || {};
    const links = scrapedData.links || {};
    const images = scrapedData.images || {};

    const bodyText = (scrapedData.bodyText || "").slice(0, 3000);

    const prompt = `
You are an expert SEO analyst. Analyze the following website data
and return a comprehensive SEO audit matching the provided JSON schema.

WEBSITE
URL: ${scrapedData.url || "Unknown"}
Load Time: ${scrapedData.loadTime ?? 0} ms
Status Code: ${scrapedData.statusCode ?? "Unknown"}
Page Size: ${Math.round((scrapedData.pageSize || 0) / 1024)} KB
Word Count: ${scrapedData.wordCount ?? 0}

META DATA
Title: "${metaData.title || ""}"
Description: "${metaData.description || ""}"
Canonical: "${metaData.canonical || ""}"
Robots: "${metaData.robots || ""}"
OG Title: "${metaData.ogTitle || ""}"
OG Description: "${metaData.ogDescription || ""}"
OG Image: "${metaData.ogImage || ""}"
Twitter Card: "${metaData.twitterCard || ""}"
Viewport: "${metaData.viewport || ""}"
Charset: "${metaData.charset || ""}"

HEADINGS
H1 count: ${headings.h1 ?? 0}
H1 texts: ${JSON.stringify(headings.h1Texts || [])}
H2 count: ${headings.h2 ?? 0}
H3 count: ${headings.h3 ?? 0}
H4 count: ${headings.h4 ?? 0}
H5 count: ${headings.h5 ?? 0}
H6 count: ${headings.h6 ?? 0}

LINKS
Internal: ${links.internal ?? 0}
External: ${links.external ?? 0}
Total: ${links.total ?? 0}

IMAGES
Total: ${images.total ?? 0}
Missing alt text: ${images.missingAlt ?? 0}
With alt text: ${images.withAlt ?? 0}

PAGE CONTENT
${bodyText}

SCORING GUIDELINES
- Return an overall SEO score from 0 to 100.
- Return scores from 0 to 100 for SEO, performance, accessibility,
  and best practices.
- A title of 50-60 characters is generally desirable.
- A description of 150-160 characters is generally desirable.
- One H1 heading is ideal.
- Images should have appropriate alt text.
- Load time below 3 seconds is good; above 5 seconds needs attention.
- Page size below 3 MB is generally desirable.
- Check viewport, charset, canonical URL, Open Graph, and Twitter tags.
- Evaluate internal links and heading hierarchy.
- Content pages generally benefit from substantive, relevant content.
- Identify up to 10 important keywords from the supplied content.
- Provide 5-15 specific, actionable issues when applicable.
- Use only "critical", "warning", or "info" as issue severity.
- Sort issues by severity: critical first, then warning, then info.
- Base findings only on the supplied data. Do not invent measurements.
- For keyword density, return a percentage as a number.
`;

    const maxAttempts = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: seoAnalysisSchema,
                },
            });

            if (!response.text) {
                throw new Error("Gemini returned an empty response.");
            }

            const analysis = JSON.parse(response.text);

            return {
                success: true,
                data: analysis,
            };
        } catch (error) {
            lastError = error;

            console.error(
                `Gemini analysis attempt ${attempt}/${maxAttempts} failed:`,
                error.message
            );

            const errorMessage = String(
                error.message || ""
            ).toLowerCase();

            const isRetryable =
                error.status === 429 ||
                error.status === 500 ||
                error.status === 502 ||
                error.status === 503 ||
                error.status === 504 ||
                errorMessage.includes("internal") ||
                errorMessage.includes("overloaded") ||
                errorMessage.includes("timeout") ||
                errorMessage.includes("temporarily unavailable") ||
                errorMessage.includes("503") ||
                errorMessage.includes("429");

            if (!isRetryable || attempt === maxAttempts) {
                break;
            }

            await sleep(attempt * 2000);
        }
    }

    console.error(
        "Gemini analysis failed after retries:",
        lastError?.message
    );

    return {
        success: false,
        error: lastError?.message || "Gemini analysis failed.",
    };
}
