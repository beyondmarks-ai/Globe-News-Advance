# OSIRIS Globe News

OSIRIS Globe News is an interactive 3D news-intelligence globe built with Next.js and MapLibre GL. It plots geolocated timeline stories, supports live 15-minute updates, and lets users inspect historical one-hour windows.

## Features

- Interactive 3D globe with dark and satellite basemaps
- Up to 1,000 geolocated news points per timeline request
- Automatic live updates at `:00`, `:15`, `:30`, and `:45` IST
- Historical date, hour, and 15-minute slot selection
- Timeline news counter and loading status
- Clickable news points with source, tone, location, and article URL
- Location search and reverse geocoding through Mapbox
- Responsive desktop and mobile controls

## Data Source

Timeline data is pulled from this Azure-hosted GDELT updater endpoint:

```text
https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/timeline_news
```

Request format:

```text
https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/timeline_news?code=<TIMELINE_NEWS_CODE>&date=2026-06-20&time=02:15&limit=1000
```

| Parameter | Format | Description |
| --- | --- | --- |
| `code` | String | Azure function access code stored in `TIMELINE_NEWS_CODE` |
| `date` | `YYYY-MM-DD` | Requested timeline date |
| `time` | `HH:mm` | Quarter-hour slot: `00`, `15`, `30`, or `45` |
| `limit` | Integer | Maximum number of stories; the app requests `1000` |

The browser does not call the Azure endpoint directly. It requests `/api/timeline-news`, and the Next.js server route validates the date/time, attaches the private access code, disables caching, and forwards the response.

Do not commit the real `TIMELINE_NEWS_CODE`. Azure function codes grant access to the endpoint and must remain in local or deployment environment variables.

## Technology

- Next.js 16 with the App Router
- React 19
- TypeScript
- MapLibre GL JS
- CARTO Dark Matter and Esri World Imagery basemaps
- Mapbox Geocoding API

## Requirements

- Node.js 20 or newer
- npm
- A Mapbox access token
- A valid Azure timeline-news function code

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example`:

   ```env
   MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
   TIMELINE_NEWS_CODE=your_timeline_news_code_here
   FIRECRAWL_API_KEY=your_firecrawl_api_key_here
   AZURE_OPENAI_CHAT_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2025-01-01-preview
   AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Environment files containing real credentials are excluded by `.gitignore`.

## Timeline Behavior

On initial load, the app calculates the previous completed 15-minute slot in IST. It converts that selection to the UTC timestamp required by GDELT, fetches it immediately, and refreshes at the next quarter-hour boundary.

Opening the clock control allows a user to choose:

- A calendar date
- A one-hour IST window
- One of four 15-minute slots

Changes remain pending until `ACTIVATE` is pressed. Activating a historical selection stops automatic live updates and keeps that dataset visible until another selection is activated or the page is reloaded.

## API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/timeline-news?date=YYYY-MM-DD&time=HH:mm` | Validates and proxies timeline requests |
| `POST /api/article-details` | Crawls a selected news URL and generates structured article details |
| `GET /api/geocode?query=<place>` | Finds a location through Mapbox |
| `GET /api/reverse-geocode?lng=<lng>&lat=<lat>` | Resolves coordinates through Mapbox |

The timeline route returns `400` for invalid dates or times, `500` when its access code is missing, and `502` when the upstream service cannot be reached.

## Available Commands

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Run the production build
npm run lint     # Run ESLint
npx tsc --noEmit # Run TypeScript validation
```

## Production Deployment

Configure these environment variables in the hosting platform before building or starting the application:

```text
MAPBOX_ACCESS_TOKEN
TIMELINE_NEWS_CODE
```

Run `npm run build` as the build command and `npm run start` as the start command. The deployment environment must be able to reach the Azure timeline endpoint, Mapbox APIs, CARTO tiles, and Esri imagery tiles over HTTPS.

## Project Structure

```text
src/
  app/
    api/
      geocode/             Mapbox forward-geocoding proxy
      reverse-geocode/     Mapbox reverse-geocoding proxy
      timeline-news/       Azure timeline-news proxy
    globals.css            Application and map-control styles
    layout.tsx             Root layout
    page.tsx               Main page
  components/
    LocationSearch.tsx     Search and basemap controls
    MapView.tsx            Globe, timeline, news layers, and detail UI
public/
  mic.png                  Voice-control icon
```

## Pre-Push Checklist

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Before pushing, confirm that `.env`, `.env.local`, build output, and development logs are not staged. Never place production access codes or Mapbox secrets in source files, screenshots, issues, or commit messages.
