# ModTriage — Hackathon Submission Write-Up
## Reddit Mod Tools & Migrated Apps Hackathon 2026
### Category: Best New Mod Tool

---

## Project Name
**ModTriage** — Real-Time Mod Queue Dashboard & Triage

## Elevator Pitch
ModTriage replaces Reddit's flat, static modqueue with a living dashboard
that lives inside Reddit itself. Mods see their queue sorted by urgency,
act with one tap, coordinate with teammates in real time, and never lose
track of who did what.

---

## Tool Overview

### The Problem
Reddit's native modqueue presents items in a basic chronological list with
no priority signal, no co-mod awareness, and no audit trail. Research with
over 100 moderators (Bajpai & Chandrasekharan, 2025) found that mods
routinely leave the modqueue entirely because it "doesn't tell them enough"
— they rely on third-party browser extensions, private spreadsheets, and
Discord side-channels to coordinate. All of those external tools broke when
the Data API changed.

### What ModTriage Does

**1. Priority-sorted queue**
Each queued item receives a priority score derived from report count,
report severity (harassment escalates immediately), time since submission,
and post score. High-priority items float to the top automatically.
Moderators can also sort by recency or filter by report type (spam, rule
violation, harassment, misinformation).

**2. Tap-to-act**
Selecting a queue item expands it with three inline action buttons —
Approve, Remove, and Mark as Spam — without navigating away. Each action
is confirmed visually, logged, and broadcast to co-mods in real time.

**3. Co-mod presence & broadcast**
Using Devvit's Realtime channel, every open dashboard session announces
itself. Mods see a live "N mods active" badge. When any mod takes an
action, all open sessions receive a broadcast toast ("u/moderator123
approved an item") and silently refresh the queue, eliminating duplicate
work.

**4. Action audit log**
Every approve/remove/spam action is written to a persistent KV store log
with timestamp and actor username. The Log tab surfaces this history for
accountability and post-incident review.

**5. Hourly stats digest**
An optional scheduled job runs every hour, posting a formatted stats
comment to the dashboard post: queue depth, high-priority count, spam
volume, and age of the oldest item. The Stats tab shows a rolling 48-hour
snapshot so mods can spot unusual reporting spikes.

**6. Per-subreddit settings**
Mods configure the app through Devvit's settings panel: auto-refresh
interval, the report threshold that triggers a high-priority flag, whether
to post hourly digests, and whether to sticky the dashboard post on
creation.

---

## How Moderators Use It

1. Mod installs ModTriage from developers.reddit.com.
2. They open the "📋 Open ModTriage Dashboard" subreddit menu item.
3. Devvit creates (or navigates to) a pinned dashboard post in the sub.
4. The mod sees their live queue, sorted by priority, with filter controls
   in a left sidebar.
5. They tap an item to expand it and click Approve / Remove / Spam.
6. Other mods with the post open see the action reflected within seconds.
7. At any time they can switch to the Log tab for a history of all actions
   or the Stats tab for trend data.

---

## Project Impact

### Community 1 — r/worldnews (~30 M members)
Large news subs face coordinated spam campaigns during breaking events.
ModTriage's spam-filter view and high-priority scoring let a small mod
team triage hundreds of reports per hour without missing genuine rule
violations buried under spam noise.

### Community 2 — r/depression (~1.1 M members)
Mental-health communities have strict rules against harmful content and
need rapid response. The harassment escalation bonus in ModTriage's
priority score surfaces dangerous posts first, and the co-mod broadcast
means no report is actioned twice or missed during a busy shift.

### Community 3 — r/AskHistorians (~1.8 M members)
This sub has unusually strict quality standards and a large volunteer mod
team spread across time zones. The hourly digest and action audit log let
senior mods review what happened overnight without scrolling through
individual mod logs.

---

## Judging Criteria Self-Assessment

### Community Impact ✓
ModTriage directly addresses the top pain points identified in peer-reviewed
modqueue research: no prioritisation, no coordination, no audit trail. Mods
in large communities currently spend significant time on workflow overhead
that ModTriage eliminates.

### Polish ✓
The app follows Devvit UI conventions (vstack/hstack layout, semantic color
tokens, Devvit settings API). It handles cache invalidation gracefully,
shows loading states, surfaces errors with actionable messages, and degrades
safely (realtime channel reconnects silently if it drops).

### Reliable UX ✓
- Queue data is cached in KV Store (3-minute TTL) to avoid hammering the
  Reddit API on every render.
- All destructive actions require an explicit tap on the expanded card
  (no accidental removes).
- The app is stateless at the post level — any mod can open the dashboard
  post and get a full up-to-date view without needing to have been online
  previously.

### Ecosystem Impact ✓
No existing Devvit app provides a real-time multi-mod queue dashboard.
ModTriage brings net-new functionality: priority scoring, co-mod
broadcasting, and integrated audit logging. The pattern (realtime + KV
Store + scheduler) is reusable as a template for other coordination tools.

---

## Technical Notes

- **Framework**: Devvit (Reddit Developer Platform) with TypeScript/JSX
- **Storage**: Devvit KV Store (queue cache, action log, stats history)
- **Realtime**: Devvit Realtime channel (co-mod presence + action broadcast)
- **Scheduling**: Devvit Scheduler (hourly digest cron)
- **Reddit API calls**: `getModQueue`, `approve`, `remove`,
  `submitPost`, `submitComment`, `distinguish`

---

## Reddit Username
*[Your Reddit username here]*

## Demo Video
*[YouTube/Vimeo link — under 60 seconds — showing: opening the dashboard,
seeing the priority queue, approving/removing an item, viewing the log tab]*

## App Link
`developers.reddit.com/apps/modtriage`

## Test Subreddit
*[Link to a post running the app in a public subreddit with < 200 members]*

---

*Built for the Reddit Mod Tools & Migrated Apps Hackathon, April–May 2026.*
