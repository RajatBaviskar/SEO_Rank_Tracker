
import { rankTracker } from "./rankTrackerService.js";
import KeywordTracking from "../models/keywordTracking.js";

export async function keywordTracking(tracking) {
    const trackingId = tracking?._id;

    if (!trackingId) {
        return {
            success: false,
            error: "Tracking ID is missing.",
        };
    }

    if (!tracking?.keyword || !tracking?.domain) {
        await markFailed(trackingId);

        return {
            success: false,
            error: "Keyword or domain is missing.",
        };
    }

    try {
        let result;

        // Retry the rank check at most twice.
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                result = await rankTracker(
                    tracking.keyword,
                    tracking.domain
                );
            } catch (rankError) {
                result = {
                    success: false,
                    error: rankError.message,
                };
            }

            if (
                result?.success &&
                result?.data?.totalResultsScanned > 0
            ) {
                break;
            }

            if (attempt < 2) {
                const delay = result?.success ? 3000 : 5000;

                await new Promise((resolve) =>
                    setTimeout(resolve, delay)
                );
            }
        }

        // Mark the record failed if both attempts return unusable results.
        if (
            !result ||
            !result.success ||
            !result.data ||
            result.data.totalResultsScanned <= 0
        ) {
            const errorMessage = !result
                ? "Rank check did not return a result."
                : !result.success
                    ? result.error || "Rank check failed."
                    : "No Google search results were scanned.";

            await markFailed(trackingId);

            return {
                success: false,
                error: errorMessage,
            };
        }

        // Fetch the latest tracking document.
        const latestTracking =
            await KeywordTracking.findById(trackingId);

        if (!latestTracking) {
            return {
                success: false,
                error: "Keyword tracking record no longer exists.",
            };
        }

        // Prepare today's rank-history entry.
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const previousPosition = latestTracking.currentPosition;
        const position = result.data.position;

        const historyEntry = {
            date: today,
            position,
            page: result.data.page,
            title: result.data.title,
            snippet: result.data.snippet,
        };

        const rankHistory = Array.isArray(latestTracking.rankHistory)
            ? [...latestTracking.rankHistory]
            : [];

        // Keep only one history entry per calendar day.
        const historyIndex = rankHistory.findIndex((entry) => {
            if (!entry?.date) return false;

            return (
                new Date(entry.date).toDateString() ===
                today.toDateString()
            );
        });

        if (historyIndex >= 0) {
            rankHistory[historyIndex] = historyEntry;
        } else {
            rankHistory.push(historyEntry);
        }

        // Prepare the database update.
        const update = {
            currentPosition: position,
            currentPage: result.data.page,
            competitors: result.data.competitors,
            lastChecked: new Date(),
            status: "completed",
            positionChange:
                previousPosition != null && position != null
                    ? previousPosition - position
                    : 0,
            rankHistory,
        };

        // Update the best ranking when a better position is found.
        if (
            position != null &&
            (
                latestTracking.bestPosition == null ||
                position < latestTracking.bestPosition
            )
        ) {
            update.bestPosition = position;
        }

        // Persist the update in MongoDB.
        const updatedTracking =
            await KeywordTracking.findByIdAndUpdate(
                trackingId,
                { $set: update },
                {
                    returnDocument: "after",
                    runValidators: true,
                }
            );

        if (!updatedTracking) {
            return {
                success: false,
                error: "Keyword tracking record no longer exists.",
            };
        }

        return result;
    } catch (err) {
        await markFailed(trackingId);

        return {
            success: false,
            error: err.message,
        };
    }
}

// Mark a tracking record as failed without printing terminal logs.
async function markFailed(trackingId) {
    try {
        await KeywordTracking.findByIdAndUpdate(
            trackingId,
            { $set: { status: "failed" } },
            {
                returnDocument: "after",
                runValidators: true,
            }
        );
    } catch {
        // Ignore status-update errors to avoid masking the original failure.
    }
}
