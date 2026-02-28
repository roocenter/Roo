'use client';

import { useEffect } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { estimateCostUSD } from '@/lib/costEstimator';

type GatewayUsageRow = {
  sessionKey: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheHitRate?: number;
};

const GATEWAY_URL = 'http://localhost:18789';

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
        sessionKey: String(row.sessionKey ?? row.session ?? row.id ?? 'agent:unknown:unknown'),
        model: String(row.model ?? row.modelId ?? 'openai/gpt-5.2'),
        tokensIn,
        tokensOut,
        cacheHitRate: Number(row.cacheHitRate ?? 0) || 0,
      } satisfies GatewayUsageRow;
    })
    .filter(Boolean) as GatewayUsageRow[];
}

async function pollGatewayAndWrite(token: string) {
  const endpoints = ['/usage', '/v1/usage', '/sessions'];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${GATEWAY_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const rows = parseRows(json);
      if (!rows.length) continue;

      await Promise.all(
        rows.map((row) =>
          addDoc(collection(db, 'token_snapshots'), {
            timestamp: new Date().toISOString(),
            sessionKey: row.sessionKey,
            model: row.model,
            tokensIn: row.tokensIn,
            tokensOut: row.tokensOut,
            cacheHitRate: row.cacheHitRate ?? 0,
            estimatedCostUSD: estimateCostUSD(row.model, row.tokensIn, row.tokensOut),
          })
        )
      );

      return;
    } catch (error) {
      console.debug('Gateway poll failed on endpoint', endpoint, error);
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
    const timer = window.setInterval(() => pollGatewayAndWrite(token), 30_000);
    return () => window.clearInterval(timer);
  }, []);
}
