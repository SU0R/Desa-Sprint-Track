'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Play, RefreshCw, Square } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';
import { createBrowserCameraService } from '@/services/camera/camera-service';
import { BasicTimingEngine } from '@/services/timing/timing-engine';
import { formatSeconds } from '@/lib/format';

export function TimerPrototypePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<'manual' | 'camera'>('manual');
  const [cameraState, setCameraState] = useState<
    'idle' | 'requesting' | 'granted' | 'blocked'
  >('idle');
  const [lastTrigger, setLastTrigger] = useState('Waiting for finish trigger');
  const { sessions, addAttempt } = useSprintTrackerStore();

  const latestSession = sessions[0];
  const engine = useMemo(() => new BasicTimingEngine(), []);

  useEffect(() => {
    return engine.subscribe((snapshot) => {
      setElapsed(snapshot.elapsedMs / 1000);
      setStatus(snapshot.status);
    });
  }, [engine]);

  useEffect(() => {
    if (cameraState !== 'granted' || !videoRef.current) {
      return;
    }

    let cleanup = () => {};

    createBrowserCameraService()
      .requestStream()
      .then((result) => {
        if (!videoRef.current) {
          return;
        }

        if (!result.stream) {
          setCameraState('blocked');
          setMode('manual');
          setLastTrigger(result.error || 'Camera unavailable, switched to manual mode.');
          return;
        }

        videoRef.current.srcObject = result.stream;
        cleanup = () => {
          result.stream?.getTracks().forEach((track) => track.stop());
        };
      })
      .catch(() => {
        setCameraState('blocked');
        setMode('manual');
        setLastTrigger('Camera setup failed, switched to manual mode.');
      });

    return () => cleanup();
  }, [cameraState]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <div className="space-y-6">
        <Card className="glass-panel border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-3xl text-white">Timer prototype</CardTitle>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
              {mode === 'camera' ? 'Camera mode' : 'Manual mode'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-black p-6 text-center">
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Current time
              </p>
              <p className="mt-4 text-6xl font-semibold text-white md:text-7xl">
                {formatSeconds(elapsed)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{status}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => engine.start()}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.04]"
                onClick={() => {
                  engine.stop('Manual finish trigger');
                  setLastTrigger('Stopped from finish-line trigger');
                }}
              >
                <Square className="mr-2 h-4 w-4" />
                Trigger finish line
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.04]"
                onClick={() => {
                  engine.reset();
                  setLastTrigger('Timer reset');
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'manual'
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
                onClick={() => setMode('manual')}
              >
                <p className="font-medium text-white">Manual prototype</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fastest reliable v1. Simulates a finish trigger with clean
                  timer architecture.
                </p>
              </button>
              <button
                type="button"
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'camera'
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
                onClick={() => {
                  setMode('camera');
                  setCameraState('requesting');
                  setCameraState('granted');
                }}
              >
                <p className="font-medium text-white">Camera preview</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Shows a camera feed if permission is available, otherwise the
                  page gracefully falls back to manual mode.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Finish-line view</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
              {mode === 'camera' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-video w-full object-cover opacity-75"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_top,rgba(0,255,163,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]">
                  <div className="text-center">
                    <Camera className="mx-auto h-12 w-12 text-primary" />
                    <p className="mt-4 text-lg font-medium text-white">
                      Simulated finish-lane preview
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Use manual trigger for this first iteration.
                    </p>
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute inset-y-0 right-[28%] w-[4px] bg-primary/90 shadow-[0_0_18px_rgba(43,214,122,0.5)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <Badge className="bg-background/90 text-white hover:bg-background/90">
                  Finish marker
                </Badge>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{lastTrigger}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Prototype notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The timing engine is intentionally isolated from the UI and camera
              access so later finish-line detection can replace the manual
              trigger without rewriting the whole page.
            </p>
            <p>
              Automatic vision detection is intentionally deferred. This version
              proves the timing flow, camera fallback, and overlay concept.
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="text-2xl text-white">Save current time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Save the last timer result into your most recent session to connect
              the prototype with the rest of the training workflow.
            </p>
            <Button
              disabled={!latestSession || elapsed === 0}
              className="w-full"
              onClick={() => {
                if (!latestSession || elapsed === 0) {
                  return;
                }

                addAttempt(latestSession.id, {
                  eventType: '40-yard dash',
                  time: Number(elapsed.toFixed(2)),
                  notes: 'Captured from timer prototype',
                  videoReference:
                    mode === 'camera' ? 'camera-prototype-capture' : 'manual-prototype'
                });
                setLastTrigger(`Saved ${formatSeconds(elapsed)} to ${latestSession.title}`);
              }}
            >
              Save to latest session
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
