'use client';

import { useEffect, useMemo, useState } from 'react';
import { ActivityFeed } from '@/components/ActivityFeed';
import { KPICard } from '@/components/KPICard';
import { ModelBreakdown } from '@/components/ModelBreakdown';
import { Sidebar } from '@/components/Sidebar';
import { TokenChart } from '@/components/TokenChart';
import { TopBar } from '@/components/TopBar';
import { TimeRange, useTokenStats } from '@/hooks/useTokenStats';
import { useTokenWriter } from '@/hooks/useTokenWriter';

const ranges: TimeRange[] = ['1H', '6H', '24H', '7D', '30D'];
const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000;

function formatCompact(value: number) {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatCountdown(msRemaining: number) {
  const safe = Math.max(0, msRemaining);
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function TokenStatsPage() {
  const [range, setRange] = useState<TimeRange>('24H');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const data = useTokenStats(range);

  // Prefer the external `firestore-writer` service for reliability (works even when the
  // OpenClaw gateway endpoints don’t expose JSON usage). Enable local writer only when
  // explicitly requested.
  if (process.env.NEXT_PUBLIC_ENABLE_LOCAL_TOKEN_WRITER === 'true') {
    useTokenWriter();
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const snapshotCountdownLabel = useMemo(() => {
    if (!data.latestSnapshotAt) return 'Waiting for first update…';

    // Writer runs every ~30 minutes, but the dashboard might be opened long after the
    // last snapshot. Roll the next expected time forward so it’s always in the future.
    const lastAt = data.latestSnapshotAt;
    const elapsed = nowMs - lastAt;

    const cycles = elapsed > 0 ? Math.floor(elapsed / SNAPSHOT_INTERVAL_MS) : 0;
    const nextAt = lastAt + (cycles + 1) * SNAPSHOT_INTERVAL_MS;
    const remainingMs = Math.max(0, nextAt - nowMs);

    return `Next update in ${formatCountdown(remainingMs)}`;
  }, [data.latestSnapshotAt, nowMs]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <TopBar snapshotCountdownLabel={snapshotCountdownLabel} />
      <div className="flex min-h-[calc(100vh-56px)]">
        <Sidebar />

        <main className="flex-1 p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Token Stats</h1>
              <p className="mt-1 text-sm text-muted">Monitor token consumption, model mix, and estimated spend in real time.</p>
            </div>
            <div className="flex gap-2 rounded-xl border border-border bg-panel p-1">
              {ranges.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                    range === r ? 'bg-accent text-white' : 'text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {data.error ? <div className="mb-4 rounded-xl border border-yellow-700/40 bg-yellow-900/20 p-3 text-xs text-yellow-300">{data.error}</div> : null}
          {data.usingMockData ? (
            <div className="mb-4 rounded-xl border border-blue-800/40 bg-blue-900/20 p-3 text-xs text-blue-300">No Firestore rows yet — showing intelligent mock activity fallback.</div>
          ) : null}

          <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <KPICard title="Total Tokens" value={formatCompact(data.kpis.totalTokens)} subtitle="selected period" changePct={data.kpis.changeTotal} />
            <KPICard title="Tokens In" value={formatCompact(data.kpis.tokensIn)} subtitle="prompt/input" changePct={data.kpis.changeIn} accent="blue" />
            <KPICard title="Tokens Out" value={formatCompact(data.kpis.tokensOut)} subtitle="completion/output" changePct={data.kpis.changeOut} accent="purple" />
            <KPICard title="Est. Cost" value={`$${data.kpis.estimatedCost.toFixed(4)}`} subtitle="~estimated" changePct={data.kpis.changeCost} accent="green" />
          </section>

          <section className="mb-6">
            <TokenChart data={data.chartData} />
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ModelBreakdown rows={data.modelBreakdown} />
            </div>
            <div>
              <ActivityFeed rows={data.activity} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
