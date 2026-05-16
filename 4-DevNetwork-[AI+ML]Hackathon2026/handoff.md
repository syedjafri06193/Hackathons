# 🗺️ Neighborhood Safety/Sentiment Map — Project Handoff

> DeveloperWeek AI/ML Hackathon 2026 | Solo Project | Submission Deadline: Thursday, May 29, 10:00 AM PST

---

## 🧠 Project Overview

A full-stack AI-powered web application that aggregates public data sources and applies NLP sentiment analysis to visualize neighborhood safety perceptions on an interactive map. Users can explore areas, view sentiment scores, read summarized public signals, and interact with an AI assistant for deeper insights.

---

## 🏗️ Tech Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Map:** Mapbox GL JS (`react-map-gl`)
- **Charts:** Recharts
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)

### Backend
- **Runtime:** Node.js (via Next.js API Routes)
- **AI/NLP:** Anthropic Claude API (`claude-sonnet-4-20250514`) for sentiment analysis & summarization
- **Vector DB:** Pinecone (for storing/querying neighborhood embeddings)
- **Cache:** Redis (Upstash) for rate-limiting and caching API responses

### Data Sources
- **Reddit API** — local subreddit posts (r/[cityname], r/[neighborhood])
- **OpenStreetMap / Nominatim** — neighborhood boundary polygons
- **Google Places API** — POI data, reviews, ratings
- **NYC Open Data / city-specific APIs** — crime stats, 311 complaints (if applicable)

### Infrastructure
- **Deployment:** Vercel (frontend + API routes)
- **Database:** Supabase (PostgreSQL) for persisting analyzed data
- **Auth:** Clerk (optional, for saved searches)
- **Environment:** `.env.local` for secrets

---

## 📁 Project Structure

```
neighborhood-safety-map/
├── app/
│   ├── page.tsx                  # Main map view
│   ├── api/
│   │   ├── analyze/route.ts      # POST: run sentiment analysis on a neighborhood
│   │   ├── neighborhoods/route.ts# GET: fetch neighborhood GeoJSON + scores
│   │   └── chat/route.ts         # POST: AI assistant streaming endpoint
│   └── layout.tsx
├── components/
│   ├── Map/
│   │   ├── MapView.tsx           # react-map-gl wrapper
│   │   ├── NeighborhoodLayer.tsx # Choropleth fill layer
│   │   └── PopupCard.tsx         # On-click neighborhood detail
│   ├── Sidebar/
│   │   ├── SentimentBreakdown.tsx
│   │   ├── SourceFeed.tsx        # Raw signals (tweets, posts)
│   │   └── AIChat.tsx            # Streaming Claude chat
│   └── ui/                       # shadcn components
├── lib/
│   ├── claude.ts                 # Anthropic SDK wrapper
│   ├── pinecone.ts               # Vector store client
│   ├── reddit.ts                 # Reddit data fetcher
│   ├── geocoder.ts               # Nominatim helpers
│   └── scoring.ts                # Weighted sentiment scoring logic
├── store/
│   └── mapStore.ts               # Zustand global state
├── types/
│   └── index.ts                  # Shared TypeScript interfaces
├── public/
├── .env.local                    # All secrets (never commit)
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## 🔑 Environment Variables

```env
# Anthropic
ANTHROPIC_API_KEY=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Pinecone
PINECONE_API_KEY=
PINECONE_INDEX=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Google Places
GOOGLE_PLACES_API_KEY=
```

---

## 🧩 Core Modules

### 1. Data Ingestion (`lib/reddit.ts`)
Fetches recent posts from local subreddits, filters by neighborhood mentions, and returns structured post objects.

```ts
export async function fetchNeighborhoodPosts(neighborhood: string, city: string) {
  const subreddits = [`r/${city}`, `r/${neighborhood.replace(/\s/g, '')}`];
  // OAuth token fetch + snoowrap or raw fetch
  // Returns: { id, title, body, score, created_at, url }[]
}
```

### 2. Sentiment Analysis (`lib/claude.ts`)
Batches posts into Claude for structured sentiment scoring.

```ts
export async function analyzeSentiment(posts: Post[]): Promise<SentimentResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are a neighborhood safety analyst. Given a list of social posts, 
             return a JSON object with: overall_score (0-100), categories 
             { safety, noise, cleanliness, community }, summary (2 sentences), 
             top_signals (array of 3 quotes). Return ONLY valid JSON.`,
    messages: [{ role: "user", content: JSON.stringify(posts.map(p => p.body)) }]
  });
  return JSON.parse(response.content[0].text);
}
```

### 3. Scoring Logic (`lib/scoring.ts`)
Combines multiple data sources into a weighted composite score.

```ts
export function computeCompositeScore(inputs: {
  sentimentScore: number;   // weight: 0.5
  crimeIndex: number;       // weight: 0.3  (inverted: lower crime = higher score)
  placesRating: number;     // weight: 0.2
}): number {
  return (
    inputs.sentimentScore * 0.5 +
    (100 - inputs.crimeIndex) * 0.3 +
    (inputs.placesRating / 5) * 100 * 0.2
  );
}
```

### 4. Map Choropleth (`components/Map/NeighborhoodLayer.tsx`)
Colors neighborhood polygons by composite score using Mapbox fill-color expressions.

```ts
fillColor: [
  'interpolate', ['linear'], ['get', 'score'],
  0,   '#d73027',   // red   — low safety
  50,  '#fee08b',   // yellow — moderate
  100, '#1a9850',   // green  — high safety
]
```

### 5. AI Chat (`app/api/chat/route.ts`)
Streaming endpoint so users can ask questions like "Is Brooklyn Heights safe at night?"

```ts
const stream = await anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  system: `You are a neighborhood safety assistant with access to real sentiment 
           data. Answer questions helpfully and cite data when possible.`,
  messages: conversationHistory,
});
return stream.toReadableStream(); // pipe to Response
```

---

## 🗃️ Database Schema (Supabase)

```sql
-- Neighborhoods
create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  geojson jsonb,           -- boundary polygon
  composite_score float,
  last_analyzed_at timestamptz,
  created_at timestamptz default now()
);

-- Analysis Results
create table sentiment_results (
  id uuid primary key default gen_random_uuid(),
  neighborhood_id uuid references neighborhoods(id),
  overall_score float,
  categories jsonb,        -- { safety, noise, cleanliness, community }
  summary text,
  top_signals jsonb,       -- array of quote strings
  source_count int,
  analyzed_at timestamptz default now()
);
```

---

## 🚀 Build Plan (by day)

| Day | Focus |
|-----|-------|
| **Day 1** | Project scaffold, Mapbox setup, Nominatim neighborhood boundaries loading |
| **Day 2** | Reddit ingestion pipeline, Claude sentiment analysis endpoint |
| **Day 3** | Scoring logic, Supabase persistence, choropleth map layer |
| **Day 4** | Sidebar UI (breakdown charts, source feed), AI chat streaming |
| **Day 5** | Polish, error handling, Vercel deploy, DevPost submission |

---

## 📦 Getting Started

```bash
# 1. Clone & install
git clone <repo>
cd neighborhood-safety-map
npm install

# 2. Set up environment
cp .env.example .env.local
# Fill in all keys

# 3. Run locally
npm run dev

# 4. Deploy
vercel --prod
```

---

## 🏆 Judging Alignment

| Criterion | How This Project Scores |
|-----------|------------------------|
| **Progress** | Working map with real data + AI analysis by demo day |
| **Concept** | Solves real urban safety perception gap using AI/ML |
| **Feasibility** | Clear B2C/B2G SaaS path; city planning, real estate, journalism verticals |

---

## 📬 Submission Checklist

- [ ] Register on DevPost: https://devnetwork-ai-ml-hack-2026.devpost.com/
- [ ] Create project entry with elevator pitch
- [ ] Add all team members (solo = just you)
- [ ] Fill in tech stack, image gallery, demo link
- [ ] Record a short video demo (Loom recommended)
- [ ] Select applicable Sponsor Challenges
- [ ] Submit by **Thursday, May 29, 10:00 AM PST**

---

*Questions? Email info@devnetwork.com — responses within 24 hours.*
