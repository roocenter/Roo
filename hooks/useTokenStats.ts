'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { estimateCostUSD, modelMeta } from '@/lib/costEstimator';

export type TimeRange = '1H' | '6H' | '24H' | '7D' | '30D';

export type TokenSnapshot = {
  id?: string;
  timestamp: unknown;
  sessionKey: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheHitRate?: number;
  estimatedCostUSD?: number;
};

type AggregatedPoint = {
  label: string;
  tokensIn: number;
  tokensOut: number;
};

const RANGE_MS: Record<TimeRange, number> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

const BUCKETS: Record<TimeRange, number> = {
  '1H': 12,
  '6H': 12,
  '24H': 24,
  '7D': 14,
  '30D': 15,
};

const PINNED_MODELS = ['gpt-5.2', 'codex-5.3', 'claude-sonnet', 'codex-mini'] as const;
type PinnedModel = (typeof PINNED_MODELS)[number];

const PINNED_MODEL_META: Record<PinnedModel, { label: string; color: string; fallbackRaw: string }> = {
  'gpt-5.2': { label: 'gpt-5.2', color: '#3b82f6', fallbackRaw: 'openai/gpt-5.2' },
  'codex-5.3': { label: 'codex-5.3', color: '#7c3aed', fallbackRaw: 'openai-codex/gpt-5.3-codex' },
  'claude-sonnet': { label: 'claude-sonnet', color: '#f97316', fallbackRaw: 'anthropic/claude-sonnet-4-6' },
  'codex-mini': { label: 'codex-mini', color: '#22c55e', fallbackRaw: 'openai-codex/gpt-5.1-codex-mini' },
};

const MOCK_MODELS = [
  'openai/gpt-5.2',
  'openai-codex/gpt-5.3-codex',
  'anthropic/claude-sonnet-4-6',
  'openai-codex/gpt-5.1-codex-mini',
];

function createMockData(): TokenSnapshot[] {
  const now = Date.now();
  const snapshots: TokenSnapshot[] = [];
  for (let i = 0; i < 48; i += 1) {
    const baseTs = now - i * 30 * 60 * 1000;
    MOCK_MODELS.forEach((model, idx) => {
      const wave = Math.sin(i / 4 + idx) * 0.5 + 0.75;
      const tokensIn = Math.floor((1200 + idx * 300) * wave + Math.random() * 300);
      const tokensOut = Math.floor((700 + idx * 220) * wave + Math.random() * 220);
      snapshots.push({
        id: `${model}-${i}`,
        timestamp: new Date(baseTs).toISOString(),
        sessionKey: `agent:main:${idx + 1}`,
        model,
        tokensIn,
        tokensOut,
        cacheHitRate: 0.7 + Math.random() * 0.28,
        estimatedCostUSD: estimateCostUSD(model, tokensIn, tokensOut),
      });
    });
  }
  return snapshots;
}

function formatBucketLabel(date: Date, range: TimeRange) {
  if (range === '7D' || range === '30D') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function shortSession(sessionKey: string) {
  const parts = sessionKey.split(':');
  return parts.slice(-2).join(':') || sessionKey;
}

function getTimestampMs(timestamp: unknown): number {
  if (!timestamp) return 0;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp).getTime();
  if (timestamp instanceof Date) return timestamp.getTime();

  if (typeof timestamp === 'object') {
    const ts = timestamp as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1_000_000);
  }

  return 0;
}

function mapModelToPinned(model: string): PinnedModel | null {
  const normalized = model.toLowerCase();
  if (normalized.includes('gpt-5.3-codex')) return 'codex-5.3';
  if (normalized.includes('gpt-5.1-codex-mini')) return 'codex-mini';
  if (normalized.includes('claude-sonnet')) return 'claude-sonnet';
  if (normalized.includes('gpt-5.2')) return 'gpt-5.2';
  return null;
}

function normalizeUnknownModelLabel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) return 'unknown-model';

  const slashPart = trimmed.includes('/') ? trimmed.split('/').pop() ?? trimmed : trimmed;
  return slashPart.replace(/^models?\//i, '') || trimmed;
}

function colorForModel(model: string): string {
  const meta = modelMeta(model);
  return meta.color || '#71717a';
}

export function useTokenStats(range: TimeRange) {
  const [rawSnapshots, setRawSnapshots] = useState<TokenSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'token_snapshots'), orderBy('timestamp', 'desc'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<TokenSnapshot, 'id'>) }));
        setRawSnapshots(data);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load token snapshots:', err);
        setError('Using fallback mock data. Firestore is not reachable right now.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return useMemo(() => {
    const now = Date.now();
    const windowMs = RANGE_MS[range];
    const previousStart = now - windowMs * 2;
    const currentStart = now - windowMs;

    const sourceData = rawSnapshots.length ? rawSnapshots : createMockData();

    const current = sourceData.filter((s) => {
      const t = getTimestampMs(s.timestamp);
      return t >= currentStart && t <= now;
    });

    const previous = sourceData.filter((s) => {
      const t = getTimestampMs(s.timestamp);
      return t >= previousStart && t < currentStart;
    });

    const tokensIn = current.reduce((acc, s) => acc + (s.tokensIn || 0), 0);
    const tokensOut = current.reduce((acc, s) => acc + (s.tokensOut || 0), 0);
    const totalTokens = tokensIn + tokensOut;
    const estimatedCost = current.reduce(
      (acc, s) => acc + (s.estimatedCostUSD ?? estimateCostUSD(s.model, s.tokensIn || 0, s.tokensOut || 0)),
      0
    );

    const prevIn = previous.reduce((acc, s) => acc + (s.tokensIn || 0), 0);
    const prevOut = previous.reduce((acc, s) => acc + (s.tokensOut || 0), 0);
    const prevTotal = prevIn + prevOut;
    const prevCost = previous.reduce(
      (acc, s) => acc + (s.estimatedCostUSD ?? estimateCostUSD(s.model, s.tokensIn || 0, s.tokensOut || 0)),
      0
    );

    const change = (currentValue: number, previousValue: number) => {
      if (!previousValue) return currentValue ? 100 : 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    };

    const bucketCount = BUCKETS[range];
    const bucketSize = windowMs / bucketCount;
    const points: AggregatedPoint[] = Array.from({ length: bucketCount }, (_, i) => {
      const start = currentStart + i * bucketSize;
      const end = start + bucketSize;
      const bucketData = current.filter((s) => {
        const t = getTimestampMs(s.timestamp);
        return t >= start && t < end;
      });
      const pointTime = new Date(start + bucketSize / 2);
      return {
        label: formatBucketLabel(pointTime, range),
        tokensIn: bucketData.reduce((acc, s) => acc + (s.tokensIn || 0), 0),
        tokensOut: bucketData.reduce((acc, s) => acc + (s.tokensOut || 0), 0),
      };
    });

    const grouped = current.reduce(
      (acc, s) => {
        const pinned = mapModelToPinned(s.model || '');
        const key = pinned ?? s.model;
        const tokensIn = s.tokensIn || 0;
        const tokensOut = s.tokensOut || 0;

        if (!acc[key]) {
          acc[key] = {
            key,
            rawModel: pinned ? PINNED_MODEL_META[pinned].fallbackRaw : s.model,
            label: pinned ? PINNED_MODEL_META[pinned].label : normalizeUnknownModelLabel(s.model),
            color: pinned ? PINNED_MODEL_META[pinned].color : colorForModel(s.model),
            pinned,
            tokensIn: 0,
            tokensOut: 0,
            estimatedCostUSD: 0,
          };
        }

        acc[key].tokensIn += tokensIn;
        acc[key].tokensOut += tokensOut;
        acc[key].estimatedCostUSD += s.estimatedCostUSD ?? estimateCostUSD(acc[key].rawModel, tokensIn, tokensOut);

        return acc;
      },
      {} as Record<
        string,
        {
          key: string;
          rawModel: string;
          label: string;
          color: string;
          pinned: PinnedModel | null;
          tokensIn: number;
          tokensOut: number;
          estimatedCostUSD: number;
        }
      >
    );

    const byModel = Object.values(grouped)
      .sort((a, b) => {
        const aPinnedIdx = a.pinned ? PINNED_MODELS.indexOf(a.pinned) : Number.POSITIVE_INFINITY;
        const bPinnedIdx = b.pinned ? PINNED_MODELS.indexOf(b.pinned) : Number.POSITIVE_INFINITY;
        if (aPinnedIdx !== bPinnedIdx) return aPinnedIdx - bPinnedIdx;

        const aTotal = a.tokensIn + a.tokensOut;
        const bTotal = b.tokensIn + b.tokensOut;
        if (aTotal !== bTotal) return bTotal - aTotal;

        return a.label.localeCompare(b.label);
      })
      .map((row) => {
        const total = row.tokensIn + row.tokensOut;
        return {
          model: row.key,
          label: row.label,
          color: row.color,
          tokensIn: row.tokensIn,
          tokensOut: row.tokensOut,
          estimatedCostUSD: row.estimatedCostUSD,
          percentOfTotal: totalTokens ? (total / totalTokens) * 100 : 0,
        };
      });

    const activity = [...current]
      .sort((a, b) => getTimestampMs(b.timestamp) - getTimestampMs(a.timestamp))
      .slice(0, 10)
      .map((s) => {
        const pinned = mapModelToPinned(s.model || '');
        const label = pinned ? PINNED_MODEL_META[pinned].label : modelMeta(s.model).label;
        const color = pinned ? PINNED_MODEL_META[pinned].color : modelMeta(s.model).color;

        return {
          id: s.id ?? `${s.model}-${getTimestampMs(s.timestamp)}`,
          model: label,
          color,
          tokens: (s.tokensIn || 0) + (s.tokensOut || 0),
          session: shortSession(s.sessionKey),
          timestamp: new Date(getTimestampMs(s.timestamp)).toISOString(),
        };
      });

    return {
      loading,
      error,
      kpis: {
        totalTokens,
        tokensIn,
        tokensOut,
        estimatedCost,
        changeTotal: change(totalTokens, prevTotal),
        changeIn: change(tokensIn, prevIn),
        changeOut: change(tokensOut, prevOut),
        changeCost: change(estimatedCost, prevCost),
      },
      chartData: points,
      modelBreakdown: byModel,
      activity,
      usingMockData: rawSnapshots.length === 0,
    };
  }, [rawSnapshots, loading, error, range]);
}
