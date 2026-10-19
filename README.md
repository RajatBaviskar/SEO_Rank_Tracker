# SEO Rank Tracker

A full-stack web application for tracking website keyword rankings in Google Search and collecting on-page SEO metrics. The application combines a React + TypeScript frontend with a Node.js/Express backend, MongoDB persistence, and browser automation powered by Playwright and Browserbase.

> **Project Status:** In development. Google Search markup and redirect URLs can vary, so ranking extraction should be validated in your environment before relying on it for production SEO reporting.

---

## Table of Contents

* [Overview](https://www.google.com/search?q=%23overview)
* [Features](https://www.google.com/search?q=%23features)
* [Technology Stack](https://www.google.com/search?q=%23technology-stack)
* [Architecture](https://www.google.com/search?q=%23architecture)
* [How It Works](https://www.google.com/search?q=%23how-it-works)
* [Data Model](https://www.google.com/search?q=%23data-model)
* [Getting Started](https://www.google.com/search?q=%23getting-started)
* [Environment Variables](https://www.google.com/search?q=%23environment-variables)
* [API Capabilities](https://www.google.com/search?q=%23api-capabilities)
* [SEO Data Collected](https://www.google.com/search?q=%23seo-data-collected)
* [Known Limitations](https://www.google.com/search?q=%23known-limitations)
* [Potential Improvements](https://www.google.com/search?q=%23potential-improvements)
* [Responsible Use](https://www.google.com/search?q=%23responsible-use)

---

## Overview

**SEO Rank Tracker** helps users monitor where a website appears in Google Search for a specified keyword. A user submits a keyword and target website URL; the backend creates a tracking record, runs a browser-based search scan, attempts to identify the target domain in the results, and stores the resulting ranking data.

The project also includes a separate webpage SEO analysis service that extracts page metadata, heading structure, link counts, image alt-text statistics, word count, HTML length, load duration, and HTTP response status.

---

## Features

* **Keyword tracking:** Create and manage keyword/domain tracking records.
* **Rank checks:** Use Playwright with a remote Browserbase browser session to inspect Google Search results.
* **Ranking history:** Store daily rank snapshots for trend tracking.
* **Position metrics:** Maintain the latest position, best recorded position, and position change when comparable values are available.
* **Competitor information:** Store information about other extracted search results.
* **Tracking status:** Represent checks as `pending`, `checking`, `completed`, or `failed`.
* **Retry handling:** Retry a rank check when the first attempt fails or produces no usable results.
* **Duplicate prevention:** Check for duplicate records in the application and enforce a compound unique index in MongoDB.
* **On-page SEO analysis:** Extract metadata, headings, links, image alt-text information, and basic page statistics.
* **REST API:** Separate HTTP request handling from tracking and scraping services.

---

## Technology Stack

| Technology | Purpose |
| --- | --- |
| **React** | Frontend user interface |
| **TypeScript** | Frontend type safety |
| **Node.js** | Backend JavaScript runtime |
| **Express.js** | HTTP API and routing |
| **MongoDB** | Persistent storage for tracking records |
| **Mongoose** | MongoDB schemas, validation, and queries |
| **Playwright** | Browser automation and DOM extraction |
| **Browserbase** | Hosted browser sessions for automation |
| **REST / JSON** | Communication between frontend and backend |

---

## Architecture

```text
┌──────────────────────────┐
│   React + TypeScript UI  │
│ Submit keywords / view   │
│ tracking and SEO data    │
└────────────┬─────────────┘
             │ HTTP / JSON
             ▼
┌──────────────────────────┐
│    Node.js + Express     │
│ Controllers and API      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Tracking / Scraping      │
│ Services                 │
└───────┬──────────┬───────┘
        │          │
        ▼          ▼
┌──────────────┐  ┌────────────────────┐
│ MongoDB +    │  │ Playwright +        │
│ Mongoose     │  │ Browserbase         │
│ Tracking     │  │ Google / target     │
│ records      │  │ webpage automation  │
└──────────────┘  └────────────────────┘

```

The keyword rank tracker and the webpage SEO scraper are separate service flows. Both use browser automation, but they collect different information.

---

## How It Works

1. **Submit a keyword:** The user provides a search keyword and target website URL.
2. **Validate and normalize:** The backend validates the request, normalizes the URL, and derives the target domain.
3. **Prevent duplicates:** The controller checks whether the user already tracks the same normalized keyword and domain.
4. **Create a record:** A tracking document is saved with an initial status such as `checking`.
5. **Run a rank check:** The tracking service calls the rank tracker and retries once when the result is unsuccessful or unusable.
6. **Inspect search results:** Playwright connects to Browserbase, opens Google Search, and attempts to extract result titles, URLs, snippets, and domains.
7. **Match the target:** Extracted domains are compared with the target domain, including subdomains where supported by the implementation.
8. **Persist results:** The service updates ranking fields, competitor information, the last-checked timestamp, and daily history.
9. **Display status:** The frontend retrieves updated records and presents the current tracking state.

> **Note:** A tracking record can be created successfully even if the external search scan later fails. The stored status distinguishes the record's existence from the outcome of the scan.

---

## Data Model

The keyword tracking document includes fields such as:

| Field | Description |
| --- | --- |
| `userId` | User who owns the tracking record |
| `keyword` | Search phrase being tracked |
| `url` | Submitted target website URL |
| `domain` | Normalized domain used for matching |
| `currentPosition` | Latest detected position, if available |
| `currentPage` | Search results page where the target was detected |
| `bestPosition` | Best recorded numerical position |
| `positionChange` | Previous position minus current position when both are available |
| `rankHistory` | Daily snapshots of ranking information |
| `competitors` | Other extracted search results |
| `active` | Whether the tracking record is enabled |
| `lastChecked` | Timestamp of the latest completed check |
| `status` | `pending`, `checking`, `completed`, or `failed` |

A compound unique index on `userId`, `keyword`, and `domain` helps prevent duplicate tracking records for the same user, keyword, and domain.

### Position Change

The service calculates position change as:


$$\text{Position change} = \text{Previous position} - \text{Current position}$$

For example, a change from position 8 to position 3 gives $8 - 3 = +5$, indicating an improvement of five positions. A change from position 3 to position 8 gives $3 - 8 = -5$, indicating a decline of five positions.

If either position is unavailable, the current implementation uses `0`; this means the change may be non-comparable rather than necessarily unchanged.

### Daily History

The service normalizes the date to the start of the day and replaces that day's existing history entry when one is already present. Otherwise, it appends a new daily snapshot.

---

## Getting Started

The exact commands and scripts can vary depending on the repository's `package.json` files. The following is a general setup guide; use the scripts defined in your project.

### Prerequisites

* Node.js and npm
* A MongoDB instance or MongoDB Atlas connection string
* A Browserbase account and API key
* Git

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd SEO_Rank_Tracker

```

*(Replace `<YOUR_REPOSITORY_URL>` with your GitHub repository URL)*

### 2. Install dependencies

If the repository has separate frontend and backend directories, install each application's dependencies:

```bash
cd backend
npm install

```

Then, in a separate terminal:

```bash
cd frontend
npm install

```

*(If your actual folder names differ, run these commands in the directories containing the respective `package.json` files.)*

### 3. Configure environment variables

Create a `.env` file in the backend directory and configure the variables required by your code. See [Environment Variables](https://www.google.com/search?q=%23environment-variables).

> **Warning:** Do not commit `.env` files, API keys, database credentials, or other secrets.

### 4. Start the backend

Run the start or development script defined in the backend `package.json`. For example, if your project defines a `dev` script:

```bash
npm run dev

```

### 5. Start the frontend

Run the start or development script defined in the frontend `package.json`. For example, if your project uses Vite:

```bash
npm run dev

```

Use the local URL printed by the frontend development server. Ensure the frontend's API base URL matches the address and port where the backend is running.

---

## Environment Variables

The exact variable names depend on your configuration. The code shared for this project uses `BROWSERBASE_API_KEY`; configure the MongoDB URI and any authentication or frontend API URL variables required by your implementation.

**Example template:**

```env
# Backend
MONGODB_URI=your_mongodb_connection_string
BROWSERBASE_API_KEY=your_browserbase_api_key
PORT=your_backend_port

# Add any other variables your code requires, such as a JWT secret,
# session secret, or frontend origin/API URL.

```

> This is a template, not a guarantee that every variable name matches your current code. Check your database connection file, authentication middleware, server entry point, and frontend API configuration before running the application. Never publish real secret values.

---

## API Capabilities

The backend controller code described for this project supports these operations:

* Add a keyword and target URL
* List a user's tracked keywords
* Retrieve one tracking record
* Refresh a keyword's ranking check
* Delete a tracking record
* Toggle a tracking record's active status

> The exact HTTP methods, endpoint paths, authentication requirements, and response formats should be taken from the route definitions in your repository. They are intentionally not guessed here.

---

## SEO Data Collected

The separate webpage SEO scraper can collect the following information:

* Page title and meta description
* Canonical URL and robots directive
* Open Graph and Twitter card metadata
* Viewport and character encoding
* H1–H6 heading counts and H1 text
* Internal and external link counts
* Total images and images missing alt text
* Visible body-text word count
* Serialized HTML character length
* Navigation duration and HTTP response status

> **Note:** HTML character length is not the same as the actual response size in bytes. Navigation duration is also a basic measurement, not a comprehensive Core Web Vitals or laboratory performance audit.

---

## Known Limitations

* **Google result extraction is still being validated:** Google can change its markup and may use encoded redirect URLs. The current extraction logic may reject these URLs and return no usable organic results.
* **Inconclusive scan failures:** A failed scan does not prove that a website is unranked. It may indicate that the scraper could not extract or interpret the results.
* **Search result variance:** Location, language, personalization, timing, and Google's interface can affect the results returned.
* **Polling overhead:** Repeated frontend requests are straightforward to implement but can add overhead as usage grows.
* **Production hardening needed:** Robust background job processing, automated tests, rate limiting, monitoring, and careful handling of external-service failures are potential improvements.

> **Caution:** Do not treat ranking results as authoritative until the extraction process has been tested against representative queries and its behavior verified.

---

## Potential Improvements

* Improve and test Google redirect destination resolution and result parsing.
* Add automated tests for domain normalization, rank calculations, duplicate handling, and failure cases.
* Move long-running rank checks to a background job queue.
* Add rate limiting, structured error reporting, and service monitoring.
* Consider WebSockets or Server-Sent Events if push-based status updates become necessary.
* Add clearer ranking trend visualizations and competitor comparisons.
* Add configurable search locale and device settings where feasible.
* Improve SEO analysis with additional performance and accessibility checks.

---

## Responsible Use

Use this project in accordance with the terms and policies of the websites and services you access, including Google and Browserbase. Respect applicable rate limits, avoid excessive requests, protect API credentials, and do not use collected information in ways that violate applicable laws or service terms.
