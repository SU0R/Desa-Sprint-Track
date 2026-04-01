'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Video } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LineChart } from '@/components/charts/line-chart';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';
import {
  buildAttemptTrend,
  buildEventPersonalBests,
  formatDate,
  formatSeconds
} from '@/lib/format';
import { EVENT_TYPES, type EventType } from '@/types/sprint-tracker';

export function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const { getSessionById, getAttemptsForSession, addAttempt } =
    useSprintTrackerStore();

  const session = getSessionById(sessionId);
  const attempts = getAttemptsForSession(sessionId);

  const [eventType, setEventType] = useState<EventType>('40-yard dash');
  const [time, setTime] = useState('4.92');
  const [notes, setNotes] = useState('Strong first three steps and cleaner posture.');
  const [videoReference, setVideoReference] = useState('finish-cam-clip-a.mp4');

  const bestForSession = useMemo(
    () =>
      attempts.reduce(
        (best, attempt) => (!best || attempt.time < best.time ? attempt : best),
        attempts[0]
      ),
    [attempts]
  );

  if (!session) {
    return (
      <Card className="glass-panel mx-auto max-w-2xl border-white/10">
        <CardContent className="space-y-4 p-8 text-center">
          <p className="text-xl font-semibold text-white">Session not found</p>
          <p className="text-muted-foreground">
            This local session may have been cleared from storage.
          </p>
          <Link href="/">
            <Button>Return to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/">
          <Button
            variant="outline"
            className="gap-2 border-white/10 bg-white/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
          {formatDate(session.date)}
        </Badge>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white">{session.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <SummaryStat
              label="Attempts"
              value={String(attempts.length)}
              meta="Logged this session"
            />
            <SummaryStat
              label="Best"
              value={bestForSession ? formatSeconds(bestForSession.time) : '--'}
              meta={bestForSession?.eventType ?? 'Add an attempt'}
            />
            <SummaryStat
              label="Notes"
              value={session.notes ? 'Ready' : '--'}
              meta={session.notes || 'No session notes saved yet'}
            />
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Session context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{session.notes || 'No session notes added yet.'}</p>
            <div className="rounded-2xl border border-dashed border-white/10 p-4">
              <p className="font-medium text-white">Extensibility seam</p>
              <p className="mt-2">
                Attempts can already store a video reference placeholder so you
                can connect clips or future camera-analysis workflows later.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Log attempt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Event type">
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as EventType)}
                  className="flex h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time (seconds)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="border-white/10 bg-white/[0.04]"
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="border-white/10 bg-white/[0.04]"
              />
            </Field>

            <Field label="Video placeholder">
              <Input
                value={videoReference}
                onChange={(event) => setVideoReference(event.target.value)}
                className="border-white/10 bg-white/[0.04]"
                placeholder="Optional clip reference"
              />
            </Field>

            <Button
              onClick={() => {
                addAttempt(session.id, {
                  eventType,
                  time: Number(time),
                  notes,
                  videoReference
                });
                setNotes('');
                setVideoReference('');
              }}
            >
              Save attempt
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">
              Session progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LineChart
              data={buildAttemptTrend(attempts)}
              valueFormatter={formatSeconds}
            />
            <div className="grid gap-3 md:grid-cols-2">
              {buildEventPersonalBests(attempts).map((entry) => (
                <div
                  key={entry.label}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
                    {entry.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatSeconds(entry.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Attempt history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attempts
            .slice()
            .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
            .map((attempt) => (
              <div
                key={attempt.id}
                className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[0.9fr_0.7fr_1fr]"
              >
                <div>
                  <p className="font-medium text-white">{attempt.eventType}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(attempt.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white">
                    {formatSeconds(attempt.time)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                    Recorded time
                  </p>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{attempt.notes || 'No notes'}</p>
                  <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
                    <Video className="h-3.5 w-3.5 text-accent" />
                    {attempt.videoReference || 'No video linked yet'}
                  </p>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  meta
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{meta}</p>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
