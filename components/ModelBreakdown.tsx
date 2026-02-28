type ModelRow = {
  model: string;
  label: string;
  color: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUSD: number;
  percentOfTotal: number;
};

function formatTokens(value: number) {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function ModelBreakdown({ rows }: { rows: ModelRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-200">Model Breakdown</h3>
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-3 text-sm text-zinc-500">No model usage in selected period.</div>
        ) : null}

        {rows.map((row) => (
          <div key={row.model} className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                <span>{row.label}</span>
              </div>
              <span className="text-xs text-zinc-500">{row.percentOfTotal.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#1a1a1a]">
              <div className="h-2 rounded-full" style={{ width: `${Math.max(row.percentOfTotal, 2)}%`, backgroundColor: row.color }} />
            </div>
            <div className="mt-2 grid grid-cols-3 text-xs text-zinc-400">
              <span>In: {formatTokens(row.tokensIn)}</span>
              <span>Out: {formatTokens(row.tokensOut)}</span>
              <span className="text-right text-green-400">${row.estimatedCostUSD.toFixed(4)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
