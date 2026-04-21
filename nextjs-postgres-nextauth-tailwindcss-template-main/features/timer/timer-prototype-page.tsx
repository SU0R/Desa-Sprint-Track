"use client";

import * as React from "react";
import { Camera, Check, Play, RefreshCw, Save, Square, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSprintTrackerStore } from "@/hooks/use-sprint-tracker-store";
import {
  FinishLineDetector,
  type FinishCalibration,
  type FinishDetection
} from "@/features/timer/finish-detector";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

type TimerSnapshot = {
  status: "Idle" | "Running" | "Stopped";
  elapsedMs: number;
  stopReason?: string;
};

type TimerPhase = "idle" | "countdown" | "cue" | "running" | "finished";
type CaptureMode = "manual" | "camera";
type CameraState = "idle" | "requesting" | "granted" | "blocked";

const setupDelays = [
  { value: "10", label: "10 seconds", description: "Quick reset when someone else is holding the camera." },
  { value: "20", label: "20 seconds", description: "Original setup delay." },
  { value: "30", label: "30 seconds", description: "More time to set the phone down and get in position." },
  { value: "40", label: "40 seconds", description: "Longest fixed setup delay." },
  { value: "random-30-40", label: "Random 30-40 seconds", description: "Best demo mode because the start time is hidden." }
];

class Stopwatch {
  private listeners = new Set<(snapshot: TimerSnapshot) => void>();
  private startedAt: number | null = null;
  private frame: number | null = null;
  private snapshot: TimerSnapshot = { status: "Idle", elapsedMs: 0 };

  start() {
    this.startedAt = performance.now() - this.snapshot.elapsedMs;
    this.snapshot = { status: "Running", elapsedMs: this.snapshot.elapsedMs };
    this.emit();
    this.tick();
  }

  stop(reason: string) {
    if (this.startedAt !== null) {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      }

      this.snapshot = {
        status: "Stopped",
        elapsedMs: performance.now() - this.startedAt,
        stopReason: reason
      };
      this.startedAt = null;
      this.emit();
    }
  }

  reset() {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    this.startedAt = null;
    this.snapshot = { status: "Idle", elapsedMs: 0 };
    this.emit();
  }

  subscribe(listener: (snapshot: TimerSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of Array.from(this.listeners)) {
      listener(this.snapshot);
    }
  }

  private tick = () => {
    if (this.startedAt !== null) {
      this.snapshot = { status: "Running", elapsedMs: performance.now() - this.startedAt };
      this.emit();
      this.frame = requestAnimationFrame(this.tick);
    }
  };
}

function createBeep(audioContext: AudioContext | null) {
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.7, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
  gain.connect(audioContext.destination);

  [880, 1320].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, now + 0.16 * index);
    oscillator.connect(gain);
    oscillator.start(now + 0.16 * index);
    oscillator.stop(now + 0.16 * index + 0.22);
  });
}

async function requestCameraStream() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { supported: false, error: "Camera APIs are not supported in this browser." };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    return { supported: true, stream };
  } catch (error) {
    return {
      supported: true,
      error: error instanceof Error ? error.message : "Camera access was blocked."
    };
  }
}

export function TimerPrototypePage() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const countdownTimeoutRef = React.useRef<number | null>(null);
  const cueTimeoutRef = React.useRef<number | null>(null);
  const countdownIntervalRef = React.useRef<number | null>(null);
  const startAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const detectorRef = React.useRef<FinishLineDetector | null>(null);
  const calibrationRef = React.useRef<FinishCalibration | null>(null);
  const calibrationPromiseRef = React.useRef<Promise<FinishCalibration | null> | null>(null);
  const runIdRef = React.useRef(0);
  const latestElapsedRef = React.useRef(0);

  const [timerStatus, setTimerStatus] = React.useState<TimerSnapshot["status"]>("Idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [captureMode, setCaptureMode] = React.useState<CaptureMode>("manual");
  const [phase, setPhase] = React.useState<TimerPhase>("idle");
  const [delay, setDelay] = React.useState("random-30-40");
  const [remainingDelay, setRemainingDelay] = React.useState(0);
  const [lastSetupDelay, setLastSetupDelay] = React.useState(0);
  const [cameraState, setCameraState] = React.useState<CameraState>("idle");
  const [cameraStatus, setCameraStatus] = React.useState("Camera finish detection is idle.");
  const [lastDetection, setLastDetection] = React.useState<FinishDetection | null>(null);
  const [statusLine, setStatusLine] = React.useState("Waiting for finish trigger");
  const [saveState, setSaveState] = React.useState<"idle" | "saved">("idle");

  const { sessions, addAttempt } = useSprintTrackerStore();
  const latestSession = sessions[0];
  const stopwatch = React.useMemo(() => new Stopwatch(), []);

  const selectedDelay = setupDelays.find((item) => item.value === delay);
  const isRandomDelay = delay === "random-30-40";
  const controlsReady = phase !== "countdown" && phase !== "cue" && phase !== "running";
  const canSave = Boolean(latestSession && elapsed > 0);

  const clearCountdown = React.useCallback(() => {
    if (countdownTimeoutRef.current !== null) {
      window.clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }

    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (cueTimeoutRef.current !== null) {
      window.clearTimeout(cueTimeoutRef.current);
      cueTimeoutRef.current = null;
    }
  }, []);

  const getDetector = React.useCallback(() => {
    detectorRef.current ??= new FinishLineDetector({
      markerPosition: 0.72,
      sampleIntervalMs: 45
    });

    return detectorRef.current;
  }, []);

  const stopDetector = React.useCallback(() => {
    detectorRef.current?.stop();
    calibrationRef.current = null;
    calibrationPromiseRef.current = null;
  }, []);

  const getStartAudio = React.useCallback(() => {
    if (!startAudioRef.current) {
      const audio = new Audio("/sounds/start-cue.mp4");
      audio.preload = "auto";
      startAudioRef.current = audio;
    }

    return startAudioRef.current;
  }, []);

  const primeAudio = React.useCallback(() => {
    getStartAudio().load();
    audioContextRef.current ??= new AudioContext();
    void audioContextRef.current.resume();
  }, [getStartAudio]);

  const playCue = React.useCallback(() => {
    const audio = getStartAudio();
    audio.currentTime = 0;
    void audio.play().catch(() => createBeep(audioContextRef.current));
  }, [getStartAudio]);

  const startDetector = React.useCallback(
    async (runId: number, video: HTMLVideoElement) => {
      const calibration = calibrationRef.current ?? (await calibrationPromiseRef.current);

      if (runIdRef.current !== runId) {
        return;
      }

      if (!calibration) {
        setCameraStatus("No calibration available. Use manual finish trigger.");
        return;
      }

      setCameraStatus("Watching torso center for finish-line crossing.");
      getDetector().start({
        video,
        calibration,
        onStatus: setCameraStatus,
        onCross: (detection) => {
          if (runIdRef.current !== runId) {
            return;
          }

          setLastDetection(detection);
          setCameraStatus(
            detection.method === "pose-landmarker"
              ? `Finish detected by torso crossing at x=${detection.torsoX} with ${detection.confidence} confidence.`
              : `Fallback motion ${detection.fallbackMotion} crossed threshold ${detection.threshold}.`
          );
          stopwatch.stop("Automatic finish-line detection");
          setPhase("finished");
          setStatusLine(`Auto-stopped at ${formatSeconds(latestElapsedRef.current)} from finish-line motion.`);
        }
      });
    },
    [getDetector, stopwatch]
  );

  React.useEffect(() => {
    return stopwatch.subscribe((snapshot) => {
      latestElapsedRef.current = snapshot.elapsedMs / 1000;
      setElapsed(snapshot.elapsedMs / 1000);
      setTimerStatus(snapshot.status);

      if (snapshot.status === "Stopped") {
        setPhase("finished");
      }
    });
  }, [stopwatch]);

  React.useEffect(() => {
    return () => {
      runIdRef.current += 1;
      clearCountdown();
      stopDetector();
      startAudioRef.current?.pause();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [clearCountdown, stopDetector]);

  React.useEffect(() => {
    if (cameraState !== "granted" || !videoRef.current) {
      return;
    }

    let stopStream = () => {};
    let cancelled = false;

    requestCameraStream()
      .then((result) => {
        if (cancelled || !videoRef.current) {
          return;
        }

        if (!result.stream) {
          setCameraState("blocked");
          setCaptureMode("manual");
          setStatusLine(result.error || "Camera unavailable, switched to manual mode.");
          return;
        }

        videoRef.current.srcObject = result.stream;
        stopStream = () => result.stream?.getTracks().forEach((track) => track.stop());
      })
      .catch(() => {
        setCameraState("blocked");
        setCaptureMode("manual");
        setStatusLine("Camera setup failed, switched to manual mode.");
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [cameraState]);

  const startRun = () => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    clearCountdown();
    stopDetector();
    stopwatch.reset();
    setLastDetection(null);
    setSaveState("idle");

    const setupSeconds = delay === "random-30-40" ? Math.floor(Math.random() * 11) + 30 : Number(delay);
    const target = Date.now() + setupSeconds * 1000;

    primeAudio();
    setPhase("countdown");
    setLastSetupDelay(setupSeconds);
    setRemainingDelay(setupSeconds);
    setStatusLine(
      isRandomDelay
        ? "Random start armed. Get set and listen for the start tone."
        : `${setupSeconds}-second setup timer started.`
    );

    if (captureMode === "camera" && cameraState === "granted" && videoRef.current) {
      const calibrationMs = Math.min(5000, Math.max(1500, setupSeconds * 1000 - 1000));
      setCameraStatus("Loading pose model and calibrating fallback motion.");
      calibrationPromiseRef.current = getDetector()
        .calibrate(videoRef.current, calibrationMs, setCameraStatus)
        .then((calibration) => {
          if (runIdRef.current !== runId) {
            return null;
          }

          calibrationRef.current = calibration;
          setCameraStatus(
            calibration.poseReady
              ? `Pose ready. Fallback threshold ${calibration.threshold} from ${calibration.samples} samples.`
              : `Pose unavailable. Fallback threshold ${calibration.threshold} from ${calibration.samples} samples.`
          );
          return calibration;
        })
        .catch(() => {
          if (runIdRef.current === runId) {
            setCameraStatus("Calibration failed. Use manual finish trigger.");
          }

          return null;
        });
    } else {
      setCameraStatus(
        captureMode === "camera"
          ? "Camera is not ready, so manual finish trigger is still available."
          : "Manual mode selected. Use the finish trigger button to stop."
      );
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setRemainingDelay(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    }, 250);

    countdownTimeoutRef.current = window.setTimeout(() => {
      clearCountdown();
      setPhase("cue");
      setRemainingDelay(0);
      playCue();
      setStatusLine("Start cue playing. Timer will start on the gunshot in 4.15 seconds.");

      cueTimeoutRef.current = window.setTimeout(() => {
        cueTimeoutRef.current = null;

        if (runIdRef.current === runId) {
          setPhase("running");
          stopwatch.reset();
          stopwatch.start();
          setStatusLine("Gunshot reached. Timer is running.");

          if (captureMode === "camera" && videoRef.current) {
            void startDetector(runId, videoRef.current);
          }
        }
      }, 4150);
    }, setupSeconds * 1000);
  };

  const resetRun = () => {
    runIdRef.current += 1;
    clearCountdown();
    stopDetector();
    startAudioRef.current?.pause();

    if (startAudioRef.current) {
      startAudioRef.current.currentTime = 0;
    }

    stopwatch.reset();
    setPhase("idle");
    setRemainingDelay(0);
    setLastSetupDelay(0);
    setLastDetection(null);
    setSaveState("idle");
    setCameraStatus("Camera finish detection is idle.");
    setStatusLine("Timer reset");
  };

  const saveLatestTime = () => {
    if (!latestSession || elapsed === 0) {
      return;
    }

    addAttempt(latestSession.id, {
      eventType: "40-yard dash",
      time: Number(elapsed.toFixed(2)),
      notes: `Captured from timer console after a ${lastSetupDelay || "manual"} second setup delay`,
      videoReference: captureMode === "camera" ? "camera-prototype-capture" : "manual-prototype",
      captureMode,
      detectionMethod: lastDetection?.method,
      detectionMarkerPosition: lastDetection?.markerPosition,
      detectionThreshold: lastDetection?.threshold,
      detectionConfidence: lastDetection?.confidence,
      detectionLandmark: lastDetection?.landmarkUsed,
      detectionTimestampMs: lastDetection?.timestampMs
    });
    setSaveState("saved");
    setStatusLine(`Saved ${formatSeconds(elapsed)} to ${latestSession.title}.`);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-primary">DESA Finish Console</p>
          <h1 className="mt-2 text-4xl font-semibold leading-none text-white md:text-6xl">Sprint Timer</h1>
        </div>
        <Badge className="max-w-full" variant={captureMode === "camera" ? "default" : "secondary"}>
          {captureMode === "camera" ? "Camera mode" : "Manual mode"}
        </Badge>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.78fr)_minmax(560px,1.22fr)]">
        <Card className="min-h-[560px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">Clock</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-5">
            <div className="border border-white/10 bg-black p-5 text-center trim-corners">
              <p className="text-xs uppercase tracking-[0.38em] text-muted-foreground">
                {phase === "countdown" ? "Start delay" : "Current time"}
              </p>
              {phase === "countdown" ? (
                isRandomDelay ? (
                  <div className="mt-5 space-y-2">
                    <p className="text-4xl font-semibold text-white md:text-5xl">Listen for the tone</p>
                    <p className="text-sm text-muted-foreground">Random start window: 30-40 seconds</p>
                  </div>
                ) : (
                  <p className="metric-shadow mt-5 text-7xl font-semibold leading-none text-white">{remainingDelay}s</p>
                )
              ) : phase === "cue" ? (
                <div className="mt-5 space-y-2">
                  <p className="text-5xl font-semibold text-white">Get set</p>
                  <p className="text-sm text-muted-foreground">Timer starts on the gunshot.</p>
                </div>
              ) : (
                <p className="metric-shadow mt-5 text-7xl font-semibold leading-none text-white md:text-8xl">
                  {formatSeconds(elapsed)}
                </p>
              )}
              <p className="mt-4 text-sm text-muted-foreground">{timerStatus}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="border border-white/10 bg-white/[0.025] p-4 trim-corners">
                <label htmlFor="prep-delay" className="text-sm font-medium text-white">
                  Setup delay
                </label>
                <select
                  id="prep-delay"
                  value={delay}
                  disabled={phase === "countdown" || phase === "running"}
                  onChange={(event) => setDelay(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-white/10 bg-black px-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary"
                >
                  {setupDelays.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted-foreground">
                  {phase === "countdown" && isRandomDelay
                    ? "The exact start time is hidden. Wait for the tone."
                    : phase === "cue"
                      ? "The cue is playing."
                      : selectedDelay?.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:w-44 sm:grid-cols-1">
                <button
                  type="button"
                  disabled={!controlsReady}
                  className={cn(
                    "border p-3 text-left transition-colors trim-corners",
                    captureMode === "manual" ? "border-primary/45 bg-primary/10" : "border-white/10 bg-white/[0.025]"
                  )}
                  onClick={() => {
                    stopDetector();
                    setCaptureMode("manual");
                    setCameraState("idle");
                    setCameraStatus("Manual mode selected. Use the finish trigger button to stop.");
                  }}
                >
                  <p className="text-sm font-semibold text-white">Manual</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reliable trigger</p>
                </button>
                <button
                  type="button"
                  disabled={!controlsReady}
                  className={cn(
                    "border p-3 text-left transition-colors trim-corners",
                    captureMode === "camera" ? "border-primary/45 bg-primary/10" : "border-white/10 bg-white/[0.025]"
                  )}
                  onClick={() => {
                    setCaptureMode("camera");
                    setCameraState("requesting");
                    setCameraState("granted");
                    setCameraStatus("Camera mode selected. Waiting for preview.");
                  }}
                >
                  <p className="text-sm font-semibold text-white">Camera</p>
                  <p className="mt-1 text-xs text-muted-foreground">Auto finish</p>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button disabled={!controlsReady} onClick={startRun}>
                <Play className="h-4 w-4" />
                Start
              </Button>
              <Button
                variant="outline"
                disabled={phase !== "running"}
                onClick={() => {
                  stopDetector();
                  stopwatch.stop("Manual finish trigger");
                  setPhase("finished");
                  setStatusLine("Stopped from finish-line trigger.");
                }}
              >
                <Square className="h-4 w-4" />
                Finish
              </Button>
              <Button variant="outline" onClick={resetRun}>
                <RefreshCw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  primeAudio();
                  playCue();
                  setStatusLine("Start cue preview played.");
                }}
              >
                <Zap className="h-4 w-4" />
                Test cue
              </Button>
            </div>

            <div className="mt-auto border border-white/10 bg-white/[0.025] p-4 trim-corners">
              <p className="text-sm text-muted-foreground">{statusLine}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" disabled={!canSave} onClick={saveLatestTime}>
                  {saveState === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saveState === "saved" ? "Saved" : "Save time"}
                </Button>
                {latestSession ? (
                  <span className="text-xs text-muted-foreground">Latest session: {latestSession.title}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Create a session before saving.</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[560px]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-xl">Finish-line camera</CardTitle>
            <Badge variant="outline">{cameraState}</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative min-h-[360px] overflow-hidden border border-white/10 bg-black trim-corners md:min-h-[520px]">
              {captureMode === "camera" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full min-h-[360px] w-full object-cover opacity-90 md:min-h-[520px]"
                />
              ) : (
                <div className="flex min-h-[360px] items-center justify-center bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015)_35%,rgba(72,200,255,0.08))] md:min-h-[520px]">
                  <div className="text-center">
                    <Camera className="mx-auto h-14 w-14 text-primary" />
                    <p className="mt-4 text-xl font-semibold text-white">Simulated finish-lane preview</p>
                    <p className="mt-2 text-sm text-muted-foreground">Switch to camera mode to enable automatic finish detection.</p>
                  </div>
                </div>
              )}
              <div className="pointer-events-none absolute inset-y-0 right-[28%] w-px bg-primary shadow-[0_0_18px_rgba(72,200,255,0.85)]" />
              <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                <span className="border border-white/12 bg-black/65 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white backdrop-blur">
                  Finish marker
                </span>
              </div>
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
              <p className="border border-white/10 bg-white/[0.025] p-3 text-sm text-muted-foreground trim-corners">
                {cameraStatus}
              </p>
              <p className="border border-white/10 bg-white/[0.025] p-3 text-sm text-muted-foreground trim-corners">
                {lastDetection
                  ? `Last detection: ${lastDetection.method} using ${lastDetection.landmarkUsed}, confidence ${lastDetection.confidence}.`
                  : "No finish detection recorded yet."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
