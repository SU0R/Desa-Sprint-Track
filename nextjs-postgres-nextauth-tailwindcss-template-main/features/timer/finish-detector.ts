import type { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export type FinishCalibration = {
  baselineMotion: number;
  threshold: number;
  markerPosition: number;
  samples: number;
  poseReady: boolean;
};

export type FinishDetection = FinishCalibration & {
  method: "pose-landmarker" | "motion-fallback";
  confidence: number;
  landmarkUsed: string;
  timestampMs: number;
  fallbackMotion?: number;
  torsoX?: number;
};

type DetectorOptions = {
  markerPosition: number;
  modelAssetPath?: string;
  wasmRoot?: string;
  sampleIntervalMs?: number;
  minLandmarkVisibility?: number;
  minValidPoseFrames?: number;
  hysteresis?: number;
  smoothingAlpha?: number;
  poseLostGraceMs?: number;
  fallbackBandWidthRatio?: number;
  fallbackThresholdMargin?: number;
};

type PoseSample = {
  x: number;
  confidence: number;
  landmarkUsed: string;
  timestampMs: number;
};

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

export class FinishLineDetector {
  private canvas = document.createElement("canvas");
  private context = this.canvas.getContext("2d", { willReadFrequently: true });
  private detectInterval: number | null = null;
  private previousFallbackFrame: Uint8Array | null = null;
  private smoothedTorsoX: number | null = null;
  private validPoseFrames = 0;
  private lastPoseTimestampMs: number | null = null;
  private hasStartedBeforeLine = false;
  private hasDetected = false;
  private isProcessingFrame = false;

  private markerPosition: number;
  private modelAssetPath: string;
  private wasmRoot: string;
  private sampleIntervalMs: number;
  private minLandmarkVisibility: number;
  private minValidPoseFrames: number;
  private hysteresis: number;
  private smoothingAlpha: number;
  private poseLostGraceMs: number;
  private fallbackBandWidthRatio: number;
  private fallbackThresholdMargin: number;

  constructor(options: DetectorOptions) {
    this.markerPosition = options.markerPosition;
    this.modelAssetPath =
      options.modelAssetPath ??
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
    this.wasmRoot = options.wasmRoot ?? "/mediapipe/wasm";
    this.sampleIntervalMs = options.sampleIntervalMs ?? 50;
    this.minLandmarkVisibility = options.minLandmarkVisibility ?? 0.45;
    this.minValidPoseFrames = options.minValidPoseFrames ?? 3;
    this.hysteresis = options.hysteresis ?? 0.018;
    this.smoothingAlpha = options.smoothingAlpha ?? 0.45;
    this.poseLostGraceMs = options.poseLostGraceMs ?? 500;
    this.fallbackBandWidthRatio = options.fallbackBandWidthRatio ?? 0.12;
    this.fallbackThresholdMargin = options.fallbackThresholdMargin ?? 16;
  }

  async calibrate(
    video: HTMLVideoElement,
    durationMs: number,
    onStatus?: (status: string) => void
  ): Promise<FinishCalibration> {
    this.stop();
    this.resetTracking();

    let poseReady = false;

    try {
      await this.getPoseLandmarker();
      poseReady = true;
      onStatus?.("Pose model loaded. Calibrating motion baseline.");
    } catch {
      onStatus?.("Pose model unavailable. Calibrating motion fallback.");
    }

    const samples: number[] = [];
    const endAt = performance.now() + durationMs;

    while (performance.now() < endAt) {
      const sample = this.sampleFallbackMotion(video);

      if (sample) {
        samples.push(sample.motion);
      }

      await wait(this.sampleIntervalMs);
    }

    const baseline = samples.length > 0 ? samples.reduce((total, value) => total + value, 0) / samples.length : 0;
    const peak = samples.length > 0 ? Math.max(...samples) : 0;
    const threshold = Math.max(28, baseline + this.fallbackThresholdMargin, peak * 1.2);

    this.previousFallbackFrame = null;

    return {
      baselineMotion: round(baseline),
      threshold: round(threshold),
      markerPosition: this.markerPosition,
      samples: samples.length,
      poseReady
    };
  }

  start({
    video,
    calibration,
    onCross,
    onStatus
  }: {
    video: HTMLVideoElement;
    calibration: FinishCalibration;
    onCross: (detection: FinishDetection) => void;
    onStatus?: (status: string) => void;
  }) {
    this.stop();
    this.resetTracking();
    onStatus?.(
      calibration.poseReady
        ? "Pose detector armed. Watching finish marker."
        : "Pose unavailable. Using motion fallback."
    );

    this.detectInterval = window.setInterval(() => {
      void this.detectFrame(video, calibration, onCross, onStatus);
    }, this.sampleIntervalMs);
  }

  stop() {
    if (this.detectInterval !== null) {
      window.clearInterval(this.detectInterval);
      this.detectInterval = null;
    }

    this.resetTracking();
  }

  private async detectFrame(
    video: HTMLVideoElement,
    calibration: FinishCalibration,
    onCross: (detection: FinishDetection) => void,
    onStatus?: (status: string) => void
  ) {
    if (this.hasDetected || video.videoWidth === 0 || video.videoHeight === 0 || this.isProcessingFrame) {
      return;
    }

    this.isProcessingFrame = true;

    const pose = calibration.poseReady ? await this.samplePoseTorso(video).catch(() => null) : null;

    if (pose) {
      this.handlePoseSample(pose, calibration, onCross);
      this.isProcessingFrame = false;
      return;
    }

    if (this.shouldUseFallback(performance.now())) {
      const motion = this.sampleFallbackMotion(video);

      if (motion && motion.motion >= calibration.threshold) {
        this.hasDetected = true;
        onStatus?.("Fallback motion detected at finish marker.");
        onCross({
          ...calibration,
          method: "motion-fallback",
          confidence: 0,
          landmarkUsed: "foreground motion fallback",
          timestampMs: motion.timestampMs,
          fallbackMotion: round(motion.motion)
        });
        this.stop();
      }
    }

    this.isProcessingFrame = false;
  }

  private handlePoseSample(
    sample: PoseSample,
    calibration: FinishCalibration,
    onCross: (detection: FinishDetection) => void
  ) {
    this.lastPoseTimestampMs = sample.timestampMs;
    this.validPoseFrames += 1;
    this.smoothedTorsoX =
      this.smoothedTorsoX === null
        ? sample.x
        : this.smoothedTorsoX * (1 - this.smoothingAlpha) + sample.x * this.smoothingAlpha;

    const startSide = this.markerPosition + this.hysteresis;
    const finishSide = this.markerPosition - this.hysteresis;

    if (this.smoothedTorsoX > startSide) {
      this.hasStartedBeforeLine = true;
    }

    if (
      this.hasStartedBeforeLine &&
      this.validPoseFrames >= this.minValidPoseFrames &&
      this.smoothedTorsoX <= finishSide
    ) {
      this.hasDetected = true;
      onCross({
        ...calibration,
        method: "pose-landmarker",
        confidence: round(sample.confidence),
        landmarkUsed: sample.landmarkUsed,
        torsoX: round(this.smoothedTorsoX),
        timestampMs: sample.timestampMs
      });
      this.stop();
    }
  }

  private async samplePoseTorso(video: HTMLVideoElement): Promise<PoseSample | null> {
    const poseLandmarker = await this.getPoseLandmarker();
    const timestampMs = Math.round(video.currentTime * 1000 || performance.now());
    const landmarks = poseLandmarker.detectForVideo(video, timestampMs).landmarks[0];

    if (!landmarks) {
      return null;
    }

    const torsoCandidates = [
      { landmarkUsed: "shoulders+hips torso center", points: [landmarks[11], landmarks[12], landmarks[23], landmarks[24]] },
      { landmarkUsed: "hip center", points: [landmarks[23], landmarks[24]] },
      { landmarkUsed: "shoulder center", points: [landmarks[11], landmarks[12]] }
    ];

    for (const candidate of torsoCandidates) {
      const visible = candidate.points.filter((point) => (point?.visibility ?? 0) >= this.minLandmarkVisibility);

      if (visible.length === candidate.points.length) {
        return {
          x: visible.reduce((total, point) => total + point.x, 0) / visible.length,
          confidence: visible.reduce((total, point) => total + (point.visibility ?? 0), 0) / visible.length,
          landmarkUsed: candidate.landmarkUsed,
          timestampMs
        };
      }
    }

    return null;
  }

  private sampleFallbackMotion(video: HTMLVideoElement) {
    const frame = this.captureFallbackBand(video);

    if (!frame) {
      return null;
    }

    const timestampMs = Math.round(video.currentTime * 1000 || performance.now());

    if (!this.previousFallbackFrame) {
      this.previousFallbackFrame = frame;
      return { motion: 0, timestampMs };
    }

    let motion = 0;

    for (let index = 0; index < frame.length; index += 1) {
      motion += Math.abs(frame[index] - this.previousFallbackFrame[index]);
    }

    this.previousFallbackFrame = frame;

    return {
      motion: motion / Math.max(frame.length, 1),
      timestampMs
    };
  }

  private captureFallbackBand(video: HTMLVideoElement) {
    if (!this.context || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const width = Math.max(24, Math.floor(video.videoWidth * this.fallbackBandWidthRatio));
    const center = Math.floor(video.videoWidth * this.markerPosition);
    const left = Math.max(0, Math.min(video.videoWidth - 1, center) - Math.floor(width / 2));
    const clampedWidth = Math.max(1, Math.min(width, video.videoWidth - left));
    const image = this.context.getImageData(left, 0, clampedWidth, video.videoHeight);
    const grayscale = new Uint8Array(clampedWidth * video.videoHeight);

    for (let source = 0, target = 0; source < image.data.length; source += 4, target += 1) {
      grayscale[target] = Math.round(
        0.299 * image.data[source] + 0.587 * image.data[source + 1] + 0.114 * image.data[source + 2]
      );
    }

    return grayscale;
  }

  private shouldUseFallback(now: number) {
    return this.lastPoseTimestampMs === null || now - this.lastPoseTimestampMs > this.poseLostGraceMs;
  }

  private async getPoseLandmarker() {
    if (!poseLandmarkerPromise) {
      poseLandmarkerPromise = import("@mediapipe/tasks-vision").then(async (vision) => {
        const resolver = await (vision.FilesetResolver as typeof FilesetResolver).forVisionTasks(this.wasmRoot);
        const options = {
          baseOptions: {
            modelAssetPath: this.modelAssetPath,
            delegate: "GPU" as const
          },
          runningMode: "VIDEO" as const,
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
          outputSegmentationMasks: false
        };

        try {
          return await (vision.PoseLandmarker as typeof PoseLandmarker).createFromOptions(resolver, options);
        } catch {
          return (vision.PoseLandmarker as typeof PoseLandmarker).createFromOptions(resolver, {
            ...options,
            baseOptions: {
              ...options.baseOptions,
              delegate: "CPU" as const
            }
          });
        }
      });
    }

    return poseLandmarkerPromise;
  }

  private resetTracking() {
    this.previousFallbackFrame = null;
    this.smoothedTorsoX = null;
    this.validPoseFrames = 0;
    this.lastPoseTimestampMs = null;
    this.hasStartedBeforeLine = false;
    this.hasDetected = false;
    this.isProcessingFrame = false;
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function round(value: number) {
  return Number(value.toFixed(3));
}
