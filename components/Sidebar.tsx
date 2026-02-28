'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/token-stats', label: 'Token Stats', icon: '📊', active: true },
  { href: '#', label: 'Office', icon: '🏢', active: false },
  { href: '#', label: 'Agents', icon: '🤖', active: false },
  { href: '#', label: 'Config', icon: '⚙️', active: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-panel/70 p-4">
      <nav className="flex h-full flex-col gap-2">
        {items.map((item) => {
          const isActive = item.active && pathname === item.href;
          return (
            <Link
              href={item.active ? item.href : '/token-stats'}
              key={item.label}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                isActive
                  ? 'border-accent/40 bg-accent/10 text-accent shadow-[inset_3px_0_0_0_#7c3aed]'
                  : 'border-transparent text-zinc-400 hover:border-border hover:bg-[#151515] hover:text-zinc-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{item.icon}</span>
                {item.label}
              </span>
              {!item.active ? (
                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  Soon
                </span>
              ) : null}
            </Link>
          );
        })}

        <div className="mt-auto rounded-xl border border-border bg-[#0f0f0f] p-3 text-xs text-muted">
          <div className="mb-1 font-medium text-zinc-300">Roo Office</div>
          <div>v1.0.0</div>
        </div>
      </nav>
    </aside>
  );
}
