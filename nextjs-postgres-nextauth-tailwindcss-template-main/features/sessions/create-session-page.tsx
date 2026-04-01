'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';

export function CreateSessionPage() {
  const router = useRouter();
  const { createSession } = useSprintTrackerStore();
  const [title, setTitle] = useState('Acceleration day');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(
    'Focus on sharp starts, upright mechanics, and strong finish posture.'
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl text-white">Create session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Session title">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="border-white/10 bg-white/[0.04]"
                placeholder="Evening speed block"
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="border-white/10 bg-white/[0.04]"
              />
            </Field>
          </div>

          <Field label="Session notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="border-white/10 bg-white/[0.04]"
              placeholder="Optional context for the training block"
            />
          </Field>

          <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
            Version 1 keeps sessions intentionally simple. Event types live at
            the attempt level so one session can hold multiple race distances or
            timing experiments.
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                const session = createSession({
                  title: title || 'Untitled session',
                  date,
                  notes
                });

                router.push(`/sessions/${session.id}`);
              }}
            >
              Create and open session
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/[0.04]"
              onClick={() => router.push('/')}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
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
