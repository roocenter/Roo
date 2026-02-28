type TopBarProps = {
  snapshotCountdownLabel?: string;
};

export function TopBar({ snapshotCountdownLabel }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-[#0d0d0d] px-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-lg">🦘</span>
        <span>Roo Office</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1 text-zinc-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live
        </div>
        {snapshotCountdownLabel ? (
          <div className="rounded-full border border-border bg-panel px-3 py-1 text-zinc-400">{snapshotCountdownLabel}</div>
        ) : null}
        <div className="rounded-full border border-border bg-panel px-3 py-1 text-zinc-400">Status: Connected</div>
      </div>
    </header>
  );
}
