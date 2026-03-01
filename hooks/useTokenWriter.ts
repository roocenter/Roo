'use client';

import { useEffect } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { estimateCostUSD } from '@/lib/costEstimator';

type GatewayUsageRow = {
  sessionKey: string;
  sessionId?: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheHitRate?: number;
};

type LastTotals = Record<string, { tokensIn: number; tokensOut: number }>; 

const GATEWAY_URL = 'http://localhost:18789';
const LOCAL_PROXY_URL = '/api/openclaw/sessions';
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'roo.tokenWriter.lastTotals.v2';

function stableSessionKey(row: GatewayUsageRow): string {
  if (row.sessionId) return `sessionId:${row.sessionId}`;
  return `sessionKey:${row.sessionKey}`;
}

function parseRows(payload: unknown): GatewayUsageRow[] {
  if (!payload || typeof payload !== 'object') return [];

  const root = payload as Record<string, unknown>;
  const candidates = [root.usage, root.rows, root.sessions, root.data];
  const arr = candidates.find((c) => Array.isArray(c));
  if (!Array.isArray(arr)) return [];

  return arr
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null;
      const row = raw as Record<string, unknown>;
      const tokensIn = Number(row.tokensIn ?? row.inputTokens ?? row.promptTokens ?? 0);
      const tokensOut = Number(row.tokensOut ?? row.outputTokens ?? row.completionTokens ?? 0);
      if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut)) return null;

      return {
        sessionKey: String(row.sessionKey ?? row.session ?? row.key ?? row.id ?? 'agent:unknown:unknown'),
        sessionId: row.sessionId ? String(row.sessionId) : undefined,
        model: String(row.model ?? row.modelId ?? 'openai/gpt-5.2'),
        tokensIn,
        tokensOut,
        cacheHitRate: Number(row.cacheHitRate ?? 0) || 0,
      } satisfies GatewayUsageRow;
    })
    .filter(Boolean) as GatewayUsageRow[];
}

function loadLastTotals(): LastTotals {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as LastTotals;
  } catch {
    return {};
  }
}

function saveLastTotals(totals: LastTotals) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(totals));
  } catch {
    // ignore
  }
}

async function pollGatewayAndWrite(token: string) {
  const endpoints = [
    { url: LOCAL_PROXY_URL },
    { url: `${GATEWAY_URL}/usage`, auth: true },
    { url: `${GATEWAY_URL}/v1/usage`, auth: true },
    { url: `${GATEWAY_URL}/sessions`, auth: true },
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        headers: endpoint.auth
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
        cache: 'no-store',
      });

      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const rows = parseRows(json);
      if (!rows.length) continue;

      const lastTotals = loadLastTotals();
      const nowIso = new Date().toISOString();

      const writes = rows
        .map((row) => {
          const key = stableSessionKey(row);
          const prev = lastTotals[key];
          const deltaIn = Math.max(0, row.tokensIn - (prev?.tokensIn ?? 0));
          const deltaOut = Math.max(0, row.tokensOut - (prev?.tokensOut ?? 0));

          lastTotals[key] = { tokensIn: row.tokensIn, tokensOut: row.tokensOut };

          if (deltaIn + deltaOut <= 0) return null;

          return addDoc(collection(db, 'token_snapshots'), {
            timestamp: nowIso,
            sessionKey: row.sessionKey,
            sessionId: row.sessionId ?? null,
            sessionStableKey: key,
            model: row.model,
            tokensIn: deltaIn,
            tokensOut: deltaOut,
            cacheHitRate: row.cacheHitRate ?? 0,
            estimatedCostUSD: estimateCostUSD(row.model, deltaIn, deltaOut),
          });
        })
        .filter(Boolean) as Promise<unknown>[];

      saveLastTotals(lastTotals);

      if (writes.length) await Promise.all(writes);
      return;
    } catch (error) {
      console.debug('Gateway poll failed on endpoint', endpoint.url, error);
    }
  }
}

export function useTokenWriter() {
  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' &&
      ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (!isLocalhost) return;

    const token = process.env.NEXT_PUBLIC_GATEWAY_TOKEN;
    if (!token) {
      console.warn('NEXT_PUBLIC_GATEWAY_TOKEN is missing. Writer is disabled.');
      return;
    }

    pollGatewayAndWrite(token);
    const timer = window.setInterval(() => pollGatewayAndWrite(token), SNAPSHOT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
}
