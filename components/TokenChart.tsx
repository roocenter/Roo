'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Point = {
  label: string;
  tokensIn: number;
  tokensOut: number;
};

export function TokenChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[340px] w-full rounded-xl border border-border bg-panel p-4">
      <div className="mb-3 text-sm font-medium text-zinc-200">Token Flow</div>
      <ResponsiveContainer width="100%" height="92%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#71717a" tickLine={false} axisLine={false} />
          <YAxis stroke="#71717a" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111111',
              border: '1px solid #1a1a1a',
              borderRadius: 12,
              color: '#f4f4f5',
            }}
          />
          <Area type="monotone" dataKey="tokensIn" stroke="#3b82f6" fill="url(#inFill)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="tokensOut" stroke="#7c3aed" fill="url(#outFill)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
