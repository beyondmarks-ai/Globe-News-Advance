# Globe News

Globe News is a real-time and historical news intelligence app. It shows world news on an interactive 3D globe, lets users move through past news windows, and uses AI to turn selected articles into simple, structured summaries.

The goal of the project is to help a user understand **what happened, where it happened, when it happened, and why it matters**. Instead of reading many raw links one by one, the user can explore news by location, time, tone, and source.

## Simple Project Description

This project is like a **news map plus historical AI assistant**.

News stories are collected from a GDELT-based Azure timeline service. Each story has a location, source, URL, and tone score. The app places those stories on a globe as colored points. A user can click a point to read AI-generated details about that article.

The app also has a historical machine. A user can choose a date, hour, and 15-minute time slot to see what news was happening around the world at that time. This makes it useful for exploring how events appeared across time.

## What Is Already Built

- Interactive 3D globe using MapLibre GL
- Dark map and satellite map modes
- Live timeline updates based on the latest completed 15-minute IST slot
- Historical date and time selection
- Up to 1,000 geolocated news stories per timeline request
- Colored news dots by GDELT tone:
  - Red for negative tone
  - Yellow for neutral tone
  - Green for positive tone
- Clickable news points on the globe
- Article detail panel with AI-generated explanation
- Grid News page for browsing the same timeline in card format
- Search and filter news by country or place in Grid News
- Location search and reverse geocoding through Mapbox
- Article crawling through Firecrawl
- Azure OpenAI article summarization
- Multilingual article summaries
- Text-to-speech playback for article summaries
- Server-side API routes so private keys are not exposed to the browser

## AI Features

The current AI feature is article enrichment.

When a user selects a news story, the app sends the article URL to the server. The server uses Firecrawl to extract readable article content. Then Azure OpenAI converts that article into a small structured news card.

The generated card includes:

- Title
- Emoji
- What happened
- When it happened
- Why it happened
- How it happened
- Where it happened
- Main article image when available

The AI response is designed to be short and easy to understand. It avoids ads, navigation text, and unrelated page content.

## Historical AI Vision

The project is designed to become a historical news intelligence system.

The next major AI layer can use **Azure AI Search, embeddings, and Azure OpenAI** to connect related stories together. This would allow the app to explain how one article is linked to other news, similar to a network of connected events.

Example:

A user clicks a news article about an election protest. The system can search older and newer stories with similar embeddings, then show related articles from the same category, location, people, organization, or event chain.

This future network can help answer questions like:

- Which older news stories led to this event?
- Which later stories are connected to it?
- Are there similar stories in other countries?
- Which stories belong to the same category?
- Which sources are reporting the same event?
- How did the story change over time?

## Upcoming Features

1. **Embedding system and connected news network**

   The app will use embeddings to understand the meaning of every news article. Similar or related articles can then be linked together as a news network. This will help users see how one story connects to older stories, later updates, same-category news, same-location news, and similar events around the world.

2. **Voice assistant for direct questions and interaction**

   Users will be able to ask questions by voice and get direct answers from the news system. The assistant can help users search news, explain an article, compare related stories, and interact in different languages.

3. **Worldwide multilingual news experience**

   The app will support news understanding in different languages across the world. Users will be able to read, listen to, and ask questions about global news in their preferred language.

## Planned Azure AI Search And Embedding Flow

This repository already uses Azure OpenAI for article summarization. Azure AI Search and embedding-based relationship search are not implemented in the current source code yet, but the recommended design is:

1. Collect timeline news from the Azure GDELT updater.
2. Crawl selected or scheduled article URLs.
3. Generate embeddings for title, summary, location, category, source, and article text.
4. Store articles and vectors in Azure AI Search.
5. When a user opens a story, run vector search to find related stories.
6. Use Azure OpenAI to explain the relationship in simple language.
7. Display the result as a connected news network.

Possible relationship types:

- Same topic
- Same location
- Same category
- Same source
- Same people or organization
- Cause and effect
- Earlier background story
- Later follow-up story
- Similar event in another region

## Main User Flow

1. Open the app.
2. The globe loads the latest completed timeline slot.
3. News appears as colored dots around the world.
4. The user can search for a city, country, or region.
5. The user can switch between dark and satellite maps.
6. The user can click a news dot.
7. The app opens an AI-generated news explanation.
8. The user can change the article language.
9. The user can listen to the summary using text-to-speech.
10. The user can open Grid News to browse the timeline as cards.
11. The user can use the historical machine to load older news windows.

## Data Source

Timeline news is pulled from this Azure-hosted GDELT updater endpoint:

```text
https://gdelt-live-updater-bqgza4a6b2gqakdc.southeastasia-01.azurewebsites.net/api/timeline_news
```

The app does not call this endpoint directly from the browser. The browser calls the local Next.js route:

```text
GET /api/timeline-news?date=YYYY-MM-DD&time=HH:mm
```

The server route validates the date and time, attaches the private Azure Function code, requests up to 1,000 stories, and returns the result to the frontend.

## API Routes

| Route | Purpose |
| --- | --- |
| `GET /api/timeline-news?date=YYYY-MM-DD&time=HH:mm` | Loads timeline news from the Azure GDELT updater |
| `POST /api/article-details` | Crawls an article and generates AI article details |
| `GET /api/geocode?query=<place>` | Searches for a location through Mapbox |
| `GET /api/reverse-geocode?lng=<lng>&lat=<lat>` | Converts coordinates into a place name through Mapbox |

## Technology Stack

- Next.js 16
- React 19
- TypeScript
- MapLibre GL JS
- CARTO Dark Matter basemap
- Esri World Imagery satellite basemap
- Mapbox Geocoding API
- Azure-hosted GDELT timeline service
- Firecrawl article extraction
- Azure OpenAI chat completions

## Required Environment Variables

Create `.env.local` from `.env.example`:

```env
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
TIMELINE_NEWS_CODE=your_timeline_news_code_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
AZURE_OPENAI_CHAT_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment/chat/completions?api-version=2025-01-01-preview
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
```

Do not commit real secrets. `.env.local` is ignored by Git.

## Local Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

## Available Commands

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Run the production build
npm run lint     # Run ESLint
npx tsc --noEmit # Run TypeScript validation
```

## Project Structure

```text
src/
  app/
    api/
      article-details/     Firecrawl + Azure OpenAI article enrichment
      geocode/             Mapbox forward-geocoding proxy
      reverse-geocode/     Mapbox reverse-geocoding proxy
      timeline-news/       Azure timeline-news proxy
    grid-news/             Grid-based timeline news page
    globals.css            Application styles
    layout.tsx             Root layout
    page.tsx               Main globe page
  components/
    GridNewsView.tsx       Card-based news browser
    LocationSearch.tsx     Search and basemap controls
    MapView.tsx            Globe, timeline, map layers, and detail panel
public/
  mic.png                  Voice-control image asset
```

## Production Notes

The deployment environment must provide the required environment variables and must be able to reach:

- Azure timeline-news endpoint
- Azure OpenAI endpoint
- Firecrawl API
- Mapbox APIs
- CARTO map tiles
- Esri satellite tiles

Before pushing or deploying, run:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Never place production access codes, API keys, or Mapbox secrets in source files, screenshots, issues, or commit messages.
