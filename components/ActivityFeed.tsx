'use client';

import { useEffect, useState } from 'react';

type ActivityRow = {
  id: string;
  model: string;
  color: string;
  tokens: number;
  session: string;
  timestamp: string;
};

function relativeTime(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => forceTick((v) => v + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-200">Live Activity</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-zinc-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.tokens.toLocaleString()} tokens used
              </span>
              <span className="text-zinc-500">{relativeTime(row.timestamp)}</span>
            </div>
            <div className="mt-1 text-zinc-500">{row.model} · {row.session}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
