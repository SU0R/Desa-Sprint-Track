'use client';

import { cn } from '@/lib/utils';

type Point = {
  label: string;
  value: number;
};

function describePath(points: Point[], width: number, height: number) {
  if (points.length === 0) {
    return '';
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function LineChart({
  data,
  strokeClassName,
  className,
  valueFormatter
}: {
  data: Point[];
  strokeClassName?: string;
  className?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex h-56 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-muted-foreground',
          className
        )}
      >
        No attempts yet. Add a result to start tracking your curve.
      </div>
    );
  }

  const width = 480;
  const height = 180;
  const path = describePath(data, width, height);
  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-white/[0.02] p-4',
        className
      )}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Trend
          </p>
          <p className="text-lg font-semibold text-white">
            {valueFormatter ? valueFormatter(min) : min.toFixed(2)} to{' '}
            {valueFormatter ? valueFormatter(max) : max.toFixed(2)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {data.length} data point{data.length === 1 ? '' : 's'}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height + 20}`}
        className="h-48 w-full overflow-visible"
        role="img"
        aria-label="Attempt progression chart"
      >
        {[0, 1, 2, 3].map((line) => {
          const y = (height / 3) * line;
          return (
            <line
              key={line}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="6 8"
            />
          );
        })}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className={cn('text-primary', strokeClassName)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((point, index) => {
          const x = (index / Math.max(data.length - 1, 1)) * width;
          const y =
            height - ((point.value - min) / Math.max(max - min || 1, 1)) * height;
          return (
            <g key={`${point.label}-${index}`}>
              <circle
                cx={x}
                cy={y}
                r="5"
                className="fill-background stroke-primary"
                strokeWidth="3"
              />
              <text
                x={x}
                y={height + 16}
                textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[10px]"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
