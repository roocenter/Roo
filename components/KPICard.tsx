type Props = {
  title: string;
  value: string;
  subtitle?: string;
  changePct: number;
  accent?: 'blue' | 'purple' | 'green' | 'default';
};

const accentMap = {
  blue: 'text-blue-400',
  purple: 'text-accent',
  green: 'text-green-400',
  default: 'text-zinc-200',
};

export function KPICard({ title, value, subtitle, changePct, accent = 'default' }: Props) {
  const isUp = changePct >= 0;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{title}</div>
      <div className={`mt-2 text-3xl font-semibold ${accentMap[accent]}`}>{value}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-zinc-500">{subtitle}</span>
        <span className={isUp ? 'text-emerald-400' : 'text-red-400'}>{isUp ? '↑' : '↓'} {Math.abs(changePct).toFixed(1)}%</span>
      </div>
    </div>
  );
}
