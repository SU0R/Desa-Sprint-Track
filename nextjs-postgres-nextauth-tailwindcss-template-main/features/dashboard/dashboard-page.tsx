'use client';

import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock3, Plus, Timer } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LineChart } from '@/components/charts/line-chart';
import { SplitBarChart } from '@/components/charts/split-bar-chart';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';
import {
  buildAttemptTrend,
  buildEventPersonalBests,
  formatDate,
  formatRelativeDate,
  formatSeconds
} from '@/lib/format';

export function DashboardPage() {
  const { sessions, attempts, user, isLoaded } = useSprintTrackerStore();

  const bestAttempt = attempts.reduce(
    (best, attempt) => (!best || attempt.time < best.time ? attempt : best),
    attempts[0]
  );
  const recentSessions = [...sessions]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 4);

  const totalAttempts = attempts.length;
  const uniqueEvents = new Set(attempts.map((attempt) => attempt.eventType)).size;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="glass-panel overflow-hidden border-white/10">
          <CardContent className="grid gap-8 p-6 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="space-y-5">
              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                {user.username}
              </Badge>
              <div className="space-y-3">
                <h2 className="text-4xl text-white md:text-5xl">
                  Track every sprint like a real training block.
                </h2>
                <p className="max-w-xl text-base text-muted-foreground">
                  Keep sessions clean, log attempts fast, and prototype a
                  believable timing workflow without needing a backend before
                  you are ready.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/sessions/new">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Start session
                  </Button>
                </Link>
                <Link href="/timer">
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/5"
                  >
                    <Timer className="h-4 w-4" />
                    Open timer prototype
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              <MetricCard
                label="Best recorded time"
                value={bestAttempt ? formatSeconds(bestAttempt.time) : '--'}
                meta={
                  bestAttempt ? `${bestAttempt.eventType} personal best` : 'No attempts yet'
                }
              />
              <MetricCard
                label="Total attempts"
                value={String(totalAttempts)}
                meta="Saved locally on this device"
              />
              <MetricCard
                label="Tracked sessions"
                value={String(sessions.length)}
                meta={`${uniqueEvents || 0} event types in rotation`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-white">Recent sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.map((session) => (
              <Link
                href={`/sessions/${session.id}`}
                key={session.id}
                className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {session.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(session.date)}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Updated {formatRelativeDate(session.date)}
                </p>
              </Link>
            ))}
            {recentSessions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">
                {isLoaded
                  ? 'Create your first session to start logging sprint work.'
                  : 'Loading session feed...'}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="glass-panel border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl text-white">
              Progress over time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={buildAttemptTrend(attempts)}
              valueFormatter={formatSeconds}
            />
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-xl text-white">Event bests</CardTitle>
          </CardHeader>
          <CardContent>
            <SplitBarChart data={buildEventPersonalBests(attempts)} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xl text-white">Attempt feed</CardTitle>
            <Clock3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-3">
            {attempts
              .slice()
              .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
              .slice(0, 6)
              .map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div>
                    <p className="font-medium text-white">{attempt.eventType}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-white">
                      {formatSeconds(attempt.time)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                      Result
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xl text-white">Route map</CardTitle>
            <CalendarDays className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <RouteLine href="/" label="Dashboard and overview" />
            <RouteLine href="/sessions/new" label="Session creation workflow" />
            <RouteLine href="/sessions/[id]" label="Attempt logging and history" />
            <RouteLine href="/timer" label="Camera and finish-line prototype" />
            <RouteLine href="/rooms" label="Create or join room scaffolding" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  meta
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{meta}</p>
    </div>
  );
}

function RouteLine({ href, label }: { href: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="font-medium text-white">{href}</p>
      <p className="mt-1">{label}</p>
    </div>
  );
}
