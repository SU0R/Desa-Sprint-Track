'use client';

import { formatSeconds } from '@/lib/format';

type BarDatum = {
  label: string;
  value: number;
};

export function SplitBarChart({ data }: { data: BarDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-muted-foreground">
        Add attempts across events to compare your current splits.
      </div>
    );
  }

  const max = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      {data.map((entry) => (
        <div key={entry.label} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-white">{entry.label}</span>
            <span className="text-muted-foreground">
              {formatSeconds(entry.value)}
            </span>
          </div>
          <div className="h-3 rounded-full bg-white/5">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-primary via-accent to-white/90"
              style={{ width: `${Math.max((entry.value / max) * 100, 12)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
