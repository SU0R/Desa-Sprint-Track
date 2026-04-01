import { type Attempt } from '@/types/sprint-tracker';

export function formatSeconds(value: number) {
  return `${value.toFixed(2)}s`;
}

export function formatDate(input: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(input));
}

export function formatRelativeDate(input: string) {
  const now = Date.now();
  const date = new Date(input).getTime();
  const diffInDays = Math.max(0, Math.round((now - date) / (1000 * 60 * 60 * 24)));

  if (diffInDays === 0) {
    return 'today';
  }

  if (diffInDays === 1) {
    return '1 day ago';
  }

  return `${diffInDays} days ago`;
}

export function buildAttemptTrend(attempts: Attempt[]) {
  return attempts
    .slice()
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    .map((attempt, index) => ({
      label:
        attempts.length > 6
          ? String(index + 1)
          : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
              new Date(attempt.createdAt)
            ),
      value: attempt.time
    }));
}

export function buildEventPersonalBests(attempts: Attempt[]) {
  const byEvent = new Map<string, number>();

  for (const attempt of attempts) {
    const current = byEvent.get(attempt.eventType);
    if (current === undefined || attempt.time < current) {
      byEvent.set(attempt.eventType, attempt.time);
    }
  }

  return Array.from(byEvent.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.value - b.value);
}
