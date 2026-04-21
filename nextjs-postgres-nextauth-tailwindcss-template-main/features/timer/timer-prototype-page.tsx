'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Play, RefreshCw, Square } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprintTrackerStore } from '@/hooks/use-sprint-tracker-store';
import { createBrowserCameraService } from '@/services/camera/camera-service';
import {
  MotionBandFinishLineDetector,
  type FinishLineCalibration,
  type FinishLineDetectionResult
} from '@/services/camera/finish-line-detector';
import { BasicTimingEngine } from '@/services/timing/timing-engine';
import { formatSeconds } from '@/lib/format';

type PrepOption = '10' | '20' | '30' | '40' | 'random-30-40';
type TimerPhase = 'idle' | 'countdown' | 'running' | 'finished';

const FINISH_MARKER_POSITION = 0.72;

const PREP_OPTIONS: Array<{
  value: PrepOption;
  label: string;
  description: string;
}> = [
  {
    value: '10',
    label: '10 seconds',
    description: 'Quick reset when someone else is holding the camera.'
  },
  {
    value: '20',
    label: '20 seconds',
    description: 'Original setup delay.'
  },
  {
    value: '30',
    label: '30 seconds',
    description: 'More time to set the phone down and get in position.'
  },
  {
    value: '40',
    label: '40 seconds',
    description: 'Longest fixed setup delay.'
  },
  {
    value: 'random-30-40',
    label: 'Random 30-40 seconds',
    description: 'Best first-test mode because you cannot count down the start.'
  }
];

export function TimerPrototypePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const detectorRef = useRef<MotionBandFinishLineDetector | null>(null);
  const calibrationRef = useRef<FinishLineCalibration | null>(null);
  const calibrationPromiseRef = useRef<Promise<FinishLineCalibration | null> | null>(
    null
  );
  const runIdRef = useRef(0);
  const elapsedRef = useRef(0);
  const [status, setStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<'manual' | 'camera'>('manual');
  const [phase, setPhase] = useState<TimerPhase>('idle');
  const [prepOption, setPrepOption] = useState<PrepOption>('random-30-40');
  const [remainingPrepSeconds, setRemainingPrepSeconds] = useState(0);
  const [actualPrepSeconds, setActualPrepSeconds] = useState(0);
  const [cameraState, setCameraState] = useState<
    'idle' | 'requesting' | 'granted' | 'blocked'
  >('idle');
  const [detectorStatus, setDetectorStatus] = useState(
    'Camera finish detection is idle.'
  );
  const [lastDetection, setLastDetection] =
    useState<FinishLineDetectionResult | null>(null);
  const [lastTrigger, setLastTrigger] = useState('Waiting for finish trigger');
  const { sessions, addAttempt } = useSprintTrackerStore();

  const latestSession = sessions[0];
  const engine = useMemo(() => new BasicTimingEngine(), []);

  function clearStartDelay() {
    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }

  function getDetector() {
    if (!detectorRef.current) {
      detectorRef.current = new MotionBandFinishLineDetector({
        markerPosition: FINISH_MARKER_POSITION,
        sampleIntervalMs: 45,
        consecutiveDetections: 2
      });
    }

    return detectorRef.current;
  }

  function stopDetector() {
    detectorRef.current?.stop();
    calibrationRef.current = null;
    calibrationPromiseRef.current = null;
  }

  function primeStartTone() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    void audioContextRef.current.resume();
  }

  function playStartTone() {
    const context = audioContextRef.current;
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
    gain.connect(context.destination);

    [880, 1320].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.16);
      oscillator.connect(gain);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.22);
    });
  }

  useEffect(() => {
    return engine.subscribe((snapshot) => {
      elapsedRef.current = snapshot.elapsedMs / 1000;
      setElapsed(snapshot.elapsedMs / 1000);
      setStatus(snapshot.status);

      if (snapshot.status === 'Stopped') {
        setPhase('finished');
      }
    });
  }, [engine]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      clearStartDelay();
      stopDetector();
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

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

  const selectedPrepOption = PREP_OPTIONS.find(
    (option) => option.value === prepOption
  );
  const isRandomStart = prepOption === 'random-30-40';
  const canStart = phase !== 'countdown' && phase !== 'running';

  const startRun = () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    clearStartDelay();
    stopDetector();
    engine.reset();
    setLastDetection(null);

    const prepSeconds =
      prepOption === 'random-30-40'
        ? getRandomIntegerInclusive(30, 40)
        : Number(prepOption);
    const startsAt = Date.now() + prepSeconds * 1000;

    primeStartTone();
    setPhase('countdown');
    setActualPrepSeconds(prepSeconds);
    setRemainingPrepSeconds(prepSeconds);
    setLastTrigger(
      isRandomStart
        ? 'Random start armed. Get set and listen for the start tone.'
        : `${prepSeconds}-second setup timer started.`
    );

    if (mode === 'camera' && cameraState === 'granted' && videoRef.current) {
      const calibrationDuration = Math.min(
        5000,
        Math.max(1500, prepSeconds * 1000 - 1000)
      );

      setDetectorStatus('Calibrating finish-line motion during setup.');
      calibrationPromiseRef.current = getDetector()
        .calibrate(videoRef.current, calibrationDuration)
        .then((calibration) => {
          if (runIdRef.current !== runId) {
            return null;
          }

          calibrationRef.current = calibration;
          setDetectorStatus(
            `Ready: threshold ${calibration.threshold} from ${calibration.samples} samples.`
          );
          return calibration;
        })
        .catch(() => {
          if (runIdRef.current === runId) {
            setDetectorStatus('Calibration failed. Use manual finish trigger.');
          }

          return null;
        });
    } else {
      setDetectorStatus(
        mode === 'camera'
          ? 'Camera is not ready, so manual finish trigger is still available.'
          : 'Manual mode selected. Use the finish trigger button to stop.'
      );
    }

    countdownIntervalRef.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
      setRemainingPrepSeconds(remaining);
    }, 250);

    startTimeoutRef.current = window.setTimeout(() => {
      clearStartDelay();
      setPhase('running');
      setRemainingPrepSeconds(0);
      engine.reset();
      engine.start();
      playStartTone();
      setLastTrigger('Start tone played. Timer is running.');

      if (mode === 'camera' && videoRef.current) {
        void startFinishDetection(runId, videoRef.current);
      }
    }, prepSeconds * 1000);
  };

  const resetRun = () => {
    runIdRef.current += 1;
    clearStartDelay();
    stopDetector();
    engine.reset();
    setPhase('idle');
    setRemainingPrepSeconds(0);
    setActualPrepSeconds(0);
    setLastDetection(null);
    setDetectorStatus('Camera finish detection is idle.');
    setLastTrigger('Timer reset');
  };

  const manualFinish = () => {
    stopDetector();
    engine.stop('Manual finish trigger');
    setPhase('finished');
    setLastTrigger('Stopped from finish-line trigger');
  };

  const startFinishDetection = async (
    runId: number,
    video: HTMLVideoElement
  ) => {
    const calibration =
      calibrationRef.current ?? (await calibrationPromiseRef.current);

    if (runIdRef.current !== runId) {
      return;
    }

    if (!calibration) {
      setDetectorStatus('No calibration available. Use manual finish trigger.');
      return;
    }

    setDetectorStatus('Watching the finish marker for crossing motion.');
    getDetector().start({
      video,
      calibration,
      onCross: (result) => {
        if (runIdRef.current !== runId) {
          return;
        }

        setLastDetection(result);
        setDetectorStatus(
          `Finish detected: motion ${result.detectedMotion}, threshold ${result.threshold}.`
        );
        engine.stop('Automatic finish-line detection');
        setPhase('finished');
        setLastTrigger(
          `Auto-stopped at ${formatSeconds(elapsedRef.current)} from finish-line motion.`
        );
      }
    });
  };

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
                {phase === 'countdown' ? 'Start delay' : 'Current time'}
              </p>
              {phase === 'countdown' ? (
                isRandomStart ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-4xl font-semibold text-white md:text-5xl">
                      Listen for the tone
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Random start window: 30-40 seconds
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-6xl font-semibold text-white md:text-7xl">
                    {remainingPrepSeconds}s
                  </p>
                )
              ) : (
                <p className="mt-4 text-6xl font-semibold text-white md:text-7xl">
                  {formatSeconds(elapsed)}
                </p>
              )}
              <p className="mt-2 text-sm text-muted-foreground">{status}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label
                htmlFor="prep-delay"
                className="text-sm font-medium text-white"
              >
                Setup delay before timer starts
              </label>
              <select
                id="prep-delay"
                value={prepOption}
                disabled={phase === 'countdown' || phase === 'running'}
                onChange={(event) => setPrepOption(event.target.value as PrepOption)}
                className="mt-3 h-11 w-full rounded-md border border-white/10 bg-background px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary"
              >
                {PREP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-muted-foreground">
                {phase === 'countdown' && isRandomStart
                  ? 'The exact start time is hidden. Wait for the tone.'
                  : selectedPrepOption?.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button disabled={!canStart} onClick={startRun}>
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.04]"
                disabled={phase !== 'running'}
                onClick={manualFinish}
              >
                <Square className="mr-2 h-4 w-4" />
                Trigger finish line
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.04]"
                onClick={resetRun}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/[0.04]"
                onClick={() => {
                  primeStartTone();
                  playStartTone();
                  setLastTrigger('Start tone preview played.');
                }}
              >
                Test start tone
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={!canStart}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'manual'
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
                onClick={() => {
                  stopDetector();
                  setMode('manual');
                  setCameraState('idle');
                  setDetectorStatus(
                    'Manual mode selected. Use the finish trigger button to stop.'
                  );
                }}
              >
                <p className="font-medium text-white">Manual prototype</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Fastest reliable v1. Simulates a finish trigger with clean
                  timer architecture.
                </p>
              </button>
              <button
                type="button"
                disabled={!canStart}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  mode === 'camera'
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
                onClick={() => {
                  setMode('camera');
                  setCameraState('requesting');
                  setCameraState('granted');
                  setDetectorStatus('Camera mode selected. Waiting for preview.');
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
                      Switch to camera mode to enable automatic finish detection.
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
            <p className="mt-2 text-sm text-muted-foreground">{detectorStatus}</p>
            {lastDetection ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Last detection: marker {lastDetection.markerPosition}, threshold{' '}
                {lastDetection.threshold}, motion {lastDetection.detectedMotion}
              </p>
            ) : null}
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
                  notes: `Captured from timer prototype after a ${actualPrepSeconds || 'manual'} second setup delay`,
                  videoReference:
                    mode === 'camera' ? 'camera-prototype-capture' : 'manual-prototype',
                  captureMode: mode,
                  detectionMethod: lastDetection ? 'motion-band' : undefined,
                  detectionMarkerPosition: lastDetection?.markerPosition,
                  detectionThreshold: lastDetection?.threshold
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

function getRandomIntegerInclusive(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
