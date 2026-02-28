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

const MODEL_BUCKETS = ['gpt-5.2', 'codex-5.3', 'claude-sonnet', 'codex-mini'] as const;
type ModelBucket = (typeof MODEL_BUCKETS)[number] | 'other';

const MODEL_BUCKET_META: Record<ModelBucket, { label: string; color: string }> = {
  'gpt-5.2': { label: 'gpt-5.2', color: '#3b82f6' },
  'codex-5.3': { label: 'codex-5.3', color: '#7c3aed' },
  'claude-sonnet': { label: 'claude-sonnet', color: '#f97316' },
  'codex-mini': { label: 'codex-mini', color: '#22c55e' },
  other: { label: 'other', color: '#71717a' },
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

function mapModelToBucket(model: string): ModelBucket {
  const normalized = model.toLowerCase();
  if (normalized.includes('gpt-5.3-codex')) return 'codex-5.3';
  if (normalized.includes('gpt-5.1-codex-mini')) return 'codex-mini';
  if (normalized.includes('claude-sonnet')) return 'claude-sonnet';
  if (normalized.includes('gpt-5.2')) return 'gpt-5.2';
  return 'other';
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
        const bucket = mapModelToBucket(s.model || '');
        const tokensIn = s.tokensIn || 0;
        const tokensOut = s.tokensOut || 0;
        const fallbackModel =
          bucket === 'gpt-5.2'
            ? 'openai/gpt-5.2'
            : bucket === 'codex-5.3'
              ? 'openai-codex/gpt-5.3-codex'
              : bucket === 'claude-sonnet'
                ? 'anthropic/claude-sonnet-4-6'
                : bucket === 'codex-mini'
                  ? 'openai-codex/gpt-5.1-codex-mini'
                  : s.model;

        acc[bucket].tokensIn += tokensIn;
        acc[bucket].tokensOut += tokensOut;
        acc[bucket].estimatedCostUSD += s.estimatedCostUSD ?? estimateCostUSD(fallbackModel, tokensIn, tokensOut);
        return acc;
      },
      {
        'gpt-5.2': { tokensIn: 0, tokensOut: 0, estimatedCostUSD: 0 },
        'codex-5.3': { tokensIn: 0, tokensOut: 0, estimatedCostUSD: 0 },
        'claude-sonnet': { tokensIn: 0, tokensOut: 0, estimatedCostUSD: 0 },
        'codex-mini': { tokensIn: 0, tokensOut: 0, estimatedCostUSD: 0 },
        other: { tokensIn: 0, tokensOut: 0, estimatedCostUSD: 0 },
      } as Record<ModelBucket, { tokensIn: number; tokensOut: number; estimatedCostUSD: number }>
    );

    const byModel = MODEL_BUCKETS.map((model) => {
      const row = grouped[model];
      const total = row.tokensIn + row.tokensOut;
      return {
        model,
        label: MODEL_BUCKET_META[model].label,
        color: MODEL_BUCKET_META[model].color,
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
        const bucket = mapModelToBucket(s.model || '');
        const meta = MODEL_BUCKET_META[bucket];
        return {
          id: s.id ?? `${s.model}-${getTimestampMs(s.timestamp)}`,
          model: meta?.label ?? modelMeta(s.model).label,
          color: meta?.color ?? modelMeta(s.model).color,
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
