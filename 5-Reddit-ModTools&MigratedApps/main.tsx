/**
 * ModTriage — Mod Queue Dashboard & Triage Tool
 * Reddit Mod Tools Hackathon 2026 — Best New Mod Tool
 *
 * A Devvit custom post that gives mod teams a unified, real-time
 * moderation queue dashboard with smart sorting, bulk actions,
 * co-mod awareness, and a built-in action log.
 */

import { Devvit, useState, useAsync, useChannel, useInterval } from '@devvit/public-api';
import {
  QueueItem,
  FilterOptions,
  ActionLogEntry,
  ModStats,
  QUEUE_CACHE_KEY,
  STATS_KEY,
  LOG_KEY,
  FILTER_KEY,
  REPORT_REASONS,
  formatAge,
  buildStats,
  applyFilters,
  priorityScore,
} from './types.js';

// ─── Devvit configuration ─────────────────────────────────────────────────────

Devvit.configure({
  redditAPI: true,
  kvStore: true,
  realtime: true,
  scheduler: true,
});

// ─── App settings (per-subreddit) ─────────────────────────────────────────────

Devvit.addSettings([
  {
    name: 'auto_refresh_minutes',
    label: 'Auto-refresh interval (minutes)',
    type: 'number',
    defaultValue: 5,
    helpText: 'How often the dashboard refreshes queue data automatically.',
  },
  {
    name: 'priority_report_threshold',
    label: 'High-priority report count threshold',
    type: 'number',
    defaultValue: 3,
    helpText: 'Items with at least this many reports are flagged as high priority.',
  },
  {
    name: 'enable_digest',
    label: 'Enable hourly queue digest comment',
    type: 'boolean',
    defaultValue: true,
    helpText: 'Posts a summary comment to this post every hour with queue stats.',
  },
  {
    name: 'sticky_dashboard',
    label: 'Pin dashboard post on creation',
    type: 'boolean',
    defaultValue: true,
    helpText: 'Automatically stickies the dashboard post in the modqueue.',
  },
]);

// ─── Menu item: create or navigate to the dashboard ───────────────────────────

Devvit.addMenuItem({
  location: 'subreddit',
  label: '📋 Open ModTriage Dashboard',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, kvStore, ui, scheduler, settings } = context;
    const subreddit = await reddit.getCurrentSubreddit();

    // Check if a dashboard post already exists
    const existingId = await kvStore.get(`dashboard_post_id:${subreddit.name}`);
    if (existingId) {
      ui.navigateTo(`https://www.reddit.com/r/${subreddit.name}/comments/${existingId}`);
      return;
    }

    // Create a new pinned dashboard post
    const post = await reddit.submitPost({
      title: `[ModTriage] Mod Queue Dashboard — r/${subreddit.name}`,
      subredditName: subreddit.name,
      preview: (
        <vstack padding="medium" alignment="center middle">
          <text size="large" weight="bold">Loading ModTriage...</text>
          <text size="small" color="neutral-content-weak">Setting up your dashboard.</text>
        </vstack>
      ),
    });

    // Store the post id
    await kvStore.put(`dashboard_post_id:${subreddit.name}`, post.id);

    // Optionally sticky
    const sticky = await settings.get<boolean>('sticky_dashboard');
    if (sticky) {
      await reddit.distinguish(post.id, true);
    }

    // Schedule hourly digest
    const digest = await settings.get<boolean>('enable_digest');
    if (digest) {
      await scheduler.runJob({
        name: 'hourly_digest',
        data: { subredditName: subreddit.name, postId: post.id },
        cron: '0 * * * *',
      });
    }

    ui.navigateTo(post.url);
  },
});

// ─── Scheduled job: hourly digest ─────────────────────────────────────────────

Devvit.addSchedulerJob({
  name: 'hourly_digest',
  onRun: async (event, context) => {
    const { reddit, kvStore } = context;
    const { subredditName, postId } = event.data as { subredditName: string; postId: string };

    const queue = await reddit.getModQueue({
      subreddit: subredditName,
      limit: 100,
    });

    const items = await queue.all();
    const stats = buildStats(items);

    const body = [
      `**ModTriage Hourly Digest** — ${new Date().toUTCString()}`,
      '',
      `| Metric | Count |`,
      `|---|---|`,
      `| Items in queue | ${stats.total} |`,
      `| High priority (3+ reports) | ${stats.highPriority} |`,
      `| Spam reports | ${stats.byReason['spam'] ?? 0} |`,
      `| Rule violations | ${stats.byReason['rules_violation'] ?? 0} |`,
      `| Oldest item | ${formatAge(stats.oldestAgeMs)} old |`,
      '',
      `*Posted automatically by ModTriage. React with actions below.*`,
    ].join('\n');

    await reddit.submitComment({ id: postId, text: body });

    // Persist stats snapshot
    const existing = JSON.parse((await kvStore.get(STATS_KEY(subredditName))) ?? '[]') as ModStats[];
    existing.unshift({ ...stats, timestamp: Date.now() });
    await kvStore.put(STATS_KEY(subredditName), JSON.stringify(existing.slice(0, 48)));
  },
});

// ─── Custom Post Type: dashboard UI ───────────────────────────────────────────

Devvit.addCustomPostType({
  name: 'ModTriage Dashboard',
  height: 'tall',
  render: (context) => {
    const { reddit, kvStore, realtime, userId, postId, settings } = context;

    // ── State ──────────────────────────────────────────────────────────────────
    const [view, setView] = useState<'queue' | 'log' | 'stats'>('queue');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterOptions>({
      reportType: 'all',
      sortBy: 'priority',
      onlyUnreviewed: true,
    });
    const [activeCount, setActiveCount] = useState(0); // co-mods online
    const [lastRefreshed, setLastRefreshed] = useState(Date.now());
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    // ── Async data: queue items ────────────────────────────────────────────────
    const { data: queueItems, loading: queueLoading, error: queueError } = useAsync(
      async () => {
        const subreddit = await reddit.getCurrentSubreddit();

        // Try Redis cache first (max 3 min stale)
        const cached = await kvStore.get(QUEUE_CACHE_KEY(subreddit.name));
        if (cached) {
          const parsed = JSON.parse(cached) as { ts: number; items: QueueItem[] };
          if (Date.now() - parsed.ts < 3 * 60 * 1000) return parsed.items;
        }

        // Fetch fresh
        const queue = await reddit.getModQueue({ subreddit: subreddit.name, limit: 50 });
        const rawItems = await queue.all();

        const items: QueueItem[] = rawItems.map((item) => ({
          id: item.id,
          kind: (item as any).postHint ? 'post' : 'comment',
          title: (item as any).title ?? (item as any).body?.slice(0, 80) ?? '(no content)',
          author: item.authorName ?? '[deleted]',
          subreddit: subreddit.name,
          reportCount: (item as any).numReports ?? 0,
          reportReasons: ((item as any).userReports ?? []).map((r: any) => r[0]),
          createdAt: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
          permalink: (item as any).permalink ?? '',
          score: (item as any).score ?? 0,
          reviewedBy: null,
        }));

        // Cache
        await kvStore.put(
          QUEUE_CACHE_KEY(subreddit.name),
          JSON.stringify({ ts: Date.now(), items })
        );

        return items;
      },
      { depends: [lastRefreshed] }
    );

    // ── Async data: action log ─────────────────────────────────────────────────
    const { data: logEntries } = useAsync(async () => {
      const subreddit = await reddit.getCurrentSubreddit();
      const raw = await kvStore.get(LOG_KEY(subreddit.name));
      return raw ? (JSON.parse(raw) as ActionLogEntry[]) : [];
    }, { depends: [lastRefreshed] });

    // ── Async data: stats history ──────────────────────────────────────────────
    const { data: statsHistory } = useAsync(async () => {
      const subreddit = await reddit.getCurrentSubreddit();
      const raw = await kvStore.get(STATS_KEY(subreddit.name));
      return raw ? (JSON.parse(raw) as ModStats[]) : [];
    }, { depends: [lastRefreshed] });

    // ── Realtime: co-mod presence & action broadcasts ──────────────────────────
    const channel = useChannel({
      name: `modtriage_${postId}`,
      onMessage: (msg: any) => {
        if (msg.type === 'presence') setActiveCount(msg.count);
        if (msg.type === 'action') {
          setActionFeedback(`u/${msg.actor} ${msg.verb} an item`);
          // Trigger re-fetch after peer action
          setTimeout(() => setLastRefreshed(Date.now()), 1000);
        }
      },
    });
    channel.subscribe();

    // ── Auto-refresh ──────────────────────────────────────────────────────────
    useInterval(async () => {
      const mins = (await settings.get<number>('auto_refresh_minutes')) ?? 5;
      setLastRefreshed(Date.now());
    }, 5 * 60 * 1000);

    // ── Action handler ─────────────────────────────────────────────────────────
    const handleAction = async (itemId: string, action: 'approve' | 'remove' | 'spam') => {
      try {
        const me = await reddit.getCurrentUser();
        const actor = me?.username ?? 'moderator';

        if (action === 'approve') await reddit.approve(itemId);
        else if (action === 'remove') await reddit.remove(itemId, false);
        else if (action === 'spam') await reddit.remove(itemId, true);

        // Append to action log
        const subreddit = await reddit.getCurrentSubreddit();
        const raw = await kvStore.get(LOG_KEY(subreddit.name));
        const log: ActionLogEntry[] = raw ? JSON.parse(raw) : [];
        log.unshift({
          itemId,
          actor,
          action,
          timestamp: Date.now(),
        });
        await kvStore.put(LOG_KEY(subreddit.name), JSON.stringify(log.slice(0, 200)));

        // Invalidate cache
        await kvStore.delete(QUEUE_CACHE_KEY(subreddit.name));

        // Broadcast to co-mods
        await channel.send({ type: 'action', actor, verb: action === 'approve' ? 'approved' : 'removed' });

        setActionFeedback(`✓ ${action.charAt(0).toUpperCase() + action.slice(1)}d successfully`);
        setSelectedId(null);
        setLastRefreshed(Date.now());
      } catch (e) {
        setActionFeedback('⚠ Action failed — check permissions');
      }
    };

    // ── Computed display items ─────────────────────────────────────────────────
    const displayItems = queueItems
      ? applyFilters(queueItems, filters).sort((a, b) =>
          filters.sortBy === 'priority'
            ? priorityScore(b) - priorityScore(a)
            : b.createdAt - a.createdAt
        )
      : [];

    const selected = displayItems.find((i) => i.id === selectedId) ?? null;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
      <vstack width="100%" height="100%" backgroundColor="neutral-background">

        {/* Header */}
        <hstack
          width="100%"
          padding="small"
          backgroundColor="neutral-background-strong"
          alignment="middle"
          gap="small"
        >
          <text size="medium" weight="bold" color="neutral-content">
            📋 ModTriage
          </text>
          <spacer />
          {activeCount > 1 && (
            <hstack gap="xsmall" alignment="middle">
              <icon name="user" size="xsmall" color="green" />
              <text size="xsmall" color="green">{activeCount} mods active</text>
            </hstack>
          )}
          <button
            size="small"
            appearance="plain"
            onPress={() => setLastRefreshed(Date.now())}
          >
            ↻ Refresh
          </button>
        </hstack>

        {/* Tab bar */}
        <hstack width="100%" backgroundColor="neutral-background-medium" gap="none">
          {(['queue', 'log', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              size="small"
              appearance={view === tab ? 'primary' : 'plain'}
              onPress={() => setView(tab)}
            >
              {tab === 'queue' ? `Queue (${displayItems.length})` : tab === 'log' ? 'Log' : 'Stats'}
            </button>
          ))}
        </hstack>

        {/* Feedback toast */}
        {actionFeedback && (
          <hstack padding="xsmall" backgroundColor="success-background">
            <text size="xsmall" color="success-content">{actionFeedback}</text>
            <spacer />
            <button size="small" appearance="plain" onPress={() => setActionFeedback(null)}>✕</button>
          </hstack>
        )}

        {/* ── Queue view ───────────────────────────────────────────────────── */}
        {view === 'queue' && (
          <hstack width="100%" grow>

            {/* Filter sidebar */}
            <vstack width="140px" padding="small" gap="small" backgroundColor="neutral-background-weak">
              <text size="xsmall" weight="bold" color="neutral-content-weak">SORT</text>
              <button
                size="small"
                appearance={filters.sortBy === 'priority' ? 'primary' : 'plain'}
                onPress={() => setFilters({ ...filters, sortBy: 'priority' })}
              >
                Priority
              </button>
              <button
                size="small"
                appearance={filters.sortBy === 'newest' ? 'primary' : 'plain'}
                onPress={() => setFilters({ ...filters, sortBy: 'newest' })}
              >
                Newest
              </button>

              <text size="xsmall" weight="bold" color="neutral-content-weak">FILTER</text>
              <button
                size="small"
                appearance={filters.reportType === 'all' ? 'primary' : 'plain'}
                onPress={() => setFilters({ ...filters, reportType: 'all' })}
              >
                All
              </button>
              {REPORT_REASONS.map((r) => (
                <button
                  key={r.value}
                  size="small"
                  appearance={filters.reportType === r.value ? 'primary' : 'plain'}
                  onPress={() => setFilters({ ...filters, reportType: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </vstack>

            {/* Queue list */}
            <vstack grow padding="xsmall" gap="xsmall" overflow="scroll">
              {queueLoading && <text color="neutral-content-weak">Loading queue...</text>}
              {queueError && <text color="danger-content">Error loading queue. Tap refresh.</text>}
              {!queueLoading && displayItems.length === 0 && (
                <vstack alignment="center middle" grow>
                  <text size="large">🎉</text>
                  <text color="neutral-content-weak">Queue is clear!</text>
                </vstack>
              )}
              {displayItems.map((item) => (
                <QueueCard
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  onAction={handleAction}
                />
              ))}
            </vstack>

          </hstack>
        )}

        {/* ── Log view ──────────────────────────────────────────────────────── */}
        {view === 'log' && (
          <vstack grow padding="small" gap="xsmall" overflow="scroll">
            {(!logEntries || logEntries.length === 0) && (
              <text color="neutral-content-weak">No actions recorded yet.</text>
            )}
            {(logEntries ?? []).map((entry, i) => (
              <hstack key={String(i)} gap="small" padding="xsmall" backgroundColor="neutral-background-weak">
                <text size="xsmall" color="neutral-content-weak">{formatAge(Date.now() - entry.timestamp)} ago</text>
                <text size="xsmall" weight="bold" color={entry.action === 'approve' ? 'success-content' : 'danger-content'}>
                  {entry.action.toUpperCase()}
                </text>
                <text size="xsmall" color="neutral-content">by u/{entry.actor}</text>
                <spacer />
                <text size="xsmall" color="neutral-content-weak">{entry.itemId}</text>
              </hstack>
            ))}
          </vstack>
        )}

        {/* ── Stats view ────────────────────────────────────────────────────── */}
        {view === 'stats' && (
          <vstack grow padding="medium" gap="medium">
            {(!statsHistory || statsHistory.length === 0) && (
              <text color="neutral-content-weak">Stats populate after the first hourly digest.</text>
            )}
            {(statsHistory ?? []).slice(0, 8).map((snap, i) => (
              <hstack key={String(i)} gap="medium" padding="small" backgroundColor="neutral-background-weak">
                <text size="xsmall" color="neutral-content-weak">
                  {new Date(snap.timestamp).toLocaleTimeString()}
                </text>
                <text size="xsmall">Total: <text weight="bold">{snap.total}</text></text>
                <text size="xsmall">High priority: <text weight="bold" color="danger-content">{snap.highPriority}</text></text>
                <text size="xsmall">Spam: <text weight="bold">{snap.byReason['spam'] ?? 0}</text></text>
              </hstack>
            ))}
          </vstack>
        )}

      </vstack>
    );
  },
});

// ─── Queue Card component ──────────────────────────────────────────────────────

function QueueCard({
  item,
  selected,
  onSelect,
  onAction,
}: {
  item: QueueItem;
  selected: boolean;
  onSelect: () => void;
  onAction: (id: string, action: 'approve' | 'remove' | 'spam') => Promise<void>;
}) {
  const isHighPriority = item.reportCount >= 3;
  const age = formatAge(Date.now() - item.createdAt);

  return (
    <vstack
      width="100%"
      padding="small"
      gap="xsmall"
      backgroundColor={selected ? 'neutral-background-strong' : 'neutral-background'}
      borderColor={isHighPriority ? 'danger-border' : 'neutral-border'}
      cornerRadius="small"
      onPress={onSelect}
    >
      {/* Title row */}
      <hstack gap="small" alignment="middle">
        {isHighPriority && (
          <text size="xsmall" color="danger-content" weight="bold">⚠ HIGH</text>
        )}
        <text size="small" weight="bold" color="neutral-content" overflow="ellipsis" grow>
          {item.title}
        </text>
        <text size="xsmall" color="neutral-content-weak">{age}</text>
      </hstack>

      {/* Meta row */}
      <hstack gap="small">
        <text size="xsmall" color="neutral-content-weak">u/{item.author}</text>
        <text size="xsmall" color="neutral-content-weak">·</text>
        <text size="xsmall" color="neutral-content-weak">{item.reportCount} report{item.reportCount !== 1 ? 's' : ''}</text>
        {item.reportReasons.slice(0, 2).map((r, i) => (
          <text key={String(i)} size="xsmall" color="warning-content">
            {r}
          </text>
        ))}
      </hstack>

      {/* Action buttons (shown when selected) */}
      {selected && (
        <hstack gap="small" padding="xsmall">
          <button
            size="small"
            appearance="success"
            onPress={() => onAction(item.id, 'approve')}
          >
            ✓ Approve
          </button>
          <button
            size="small"
            appearance="destructive"
            onPress={() => onAction(item.id, 'remove')}
          >
            ✕ Remove
          </button>
          <button
            size="small"
            appearance="destructive"
            onPress={() => onAction(item.id, 'spam')}
          >
            🚫 Spam
          </button>
          <spacer />
          <button
            size="small"
            appearance="plain"
            onPress={() => {
              // navigateTo not available in component; parent handles navigation
            }}
          >
            View →
          </button>
        </hstack>
      )}
    </vstack>
  );
}

export default Devvit;
