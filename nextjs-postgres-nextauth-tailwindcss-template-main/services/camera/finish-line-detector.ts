import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult
} from '@mediapipe/tasks-vision';

export type FinishDetectionMethod = 'pose-landmarker' | 'motion-fallback';

export type FinishLineCalibration = {
  baselineMotion: number;
  threshold: number;
  markerPosition: number;
  samples: number;
  poseReady: boolean;
};

export type FinishLineDetectionResult = FinishLineCalibration & {
  method: FinishDetectionMethod;
  confidence: number;
  landmarkUsed: string;
  torsoX?: number;
  timestampMs: number;
  fallbackMotion?: number;
};

export type FinishLineDetectorConfig = {
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

type DetectOptions = {
  video: HTMLVideoElement;
  calibration: FinishLineCalibration;
  onCross: (result: FinishLineDetectionResult) => void;
  onStatus?: (status: string) => void;
};

type TorsoSample = {
  x: number;
  confidence: number;
  landmarkUsed: string;
  timestampMs: number;
};

type FallbackSample = {
  motion: number;
  timestampMs: number;
};

const DEFAULT_MODEL_ASSET_PATH = '/models/pose_landmarker_lite.task';
const DEFAULT_WASM_ROOT = '/mediapipe/wasm';
const DEFAULT_SAMPLE_INTERVAL_MS = 50;
const DEFAULT_MIN_LANDMARK_VISIBILITY = 0.45;
const DEFAULT_MIN_VALID_POSE_FRAMES = 3;
const DEFAULT_HYSTERESIS = 0.018;
const DEFAULT_SMOOTHING_ALPHA = 0.45;
const DEFAULT_POSE_LOST_GRACE_MS = 500;
const DEFAULT_FALLBACK_BAND_WIDTH_RATIO = 0.12;
const DEFAULT_FALLBACK_THRESHOLD_MARGIN = 16;

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

export class PoseFinishLineDetector {
  private readonly markerPosition: number;
  private readonly modelAssetPath: string;
  private readonly wasmRoot: string;
  private readonly sampleIntervalMs: number;
  private readonly minLandmarkVisibility: number;
  private readonly minValidPoseFrames: number;
  private readonly hysteresis: number;
  private readonly smoothingAlpha: number;
  private readonly poseLostGraceMs: number;
  private readonly fallbackBandWidthRatio: number;
  private readonly fallbackThresholdMargin: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private detectInterval: number | null = null;
  private previousFallbackFrame: Uint8Array | null = null;
  private smoothedTorsoX: number | null = null;
  private validPoseFrames = 0;
  private lastPoseTimestampMs: number | null = null;
  private hasStartedBeforeLine = false;
  private hasDetected = false;
  private isProcessingFrame = false;

  constructor(config: FinishLineDetectorConfig) {
    this.markerPosition = config.markerPosition;
    this.modelAssetPath = config.modelAssetPath ?? DEFAULT_MODEL_ASSET_PATH;
    this.wasmRoot = config.wasmRoot ?? DEFAULT_WASM_ROOT;
    this.sampleIntervalMs = config.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.minLandmarkVisibility =
      config.minLandmarkVisibility ?? DEFAULT_MIN_LANDMARK_VISIBILITY;
    this.minValidPoseFrames =
      config.minValidPoseFrames ?? DEFAULT_MIN_VALID_POSE_FRAMES;
    this.hysteresis = config.hysteresis ?? DEFAULT_HYSTERESIS;
    this.smoothingAlpha = config.smoothingAlpha ?? DEFAULT_SMOOTHING_ALPHA;
    this.poseLostGraceMs = config.poseLostGraceMs ?? DEFAULT_POSE_LOST_GRACE_MS;
    this.fallbackBandWidthRatio =
      config.fallbackBandWidthRatio ?? DEFAULT_FALLBACK_BAND_WIDTH_RATIO;
    this.fallbackThresholdMargin =
      config.fallbackThresholdMargin ?? DEFAULT_FALLBACK_THRESHOLD_MARGIN;
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  async calibrate(
    video: HTMLVideoElement,
    durationMs: number,
    onStatus?: (status: string) => void
  ): Promise<FinishLineCalibration> {
    this.stop();
    this.resetTracking();

    let poseReady = false;
    try {
      await this.getPoseLandmarker();
      poseReady = true;
      onStatus?.('Pose model loaded. Calibrating fallback motion baseline.');
    } catch {
      onStatus?.('Pose model failed to load. Calibrating motion fallback only.');
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

    const average =
      samples.length > 0
        ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length
        : 0;
    const peak = samples.length > 0 ? Math.max(...samples) : 0;
    const threshold = Math.max(28, average + this.fallbackThresholdMargin, peak * 1.2);

    this.previousFallbackFrame = null;

    return {
      baselineMotion: roundMetric(average),
      threshold: roundMetric(threshold),
      markerPosition: this.markerPosition,
      samples: samples.length,
      poseReady
    };
  }

  start({ video, calibration, onCross, onStatus }: DetectOptions) {
    this.stop();
    this.resetTracking();
    onStatus?.(
      calibration.poseReady
        ? 'Pose detector armed. Waiting for torso to cross the marker.'
        : 'Pose unavailable. Using broader motion fallback.'
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
    calibration: FinishLineCalibration,
    onCross: (result: FinishLineDetectionResult) => void,
    onStatus?: (status: string) => void
  ) {
    if (this.hasDetected || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    if (this.isProcessingFrame) {
      return;
    }

    this.isProcessingFrame = true;

    const poseSample = calibration.poseReady
      ? await this.samplePoseTorso(video).catch(() => null)
      : null;

    if (poseSample) {
      this.handlePoseSample(poseSample, calibration, onCross);
      this.isProcessingFrame = false;
      return;
    }

    if (this.shouldUseFallback(performance.now())) {
      const fallbackSample = this.sampleFallbackMotion(video);
      if (fallbackSample && fallbackSample.motion >= calibration.threshold) {
        this.hasDetected = true;
        onStatus?.('Pose was unavailable, so fallback motion detected finish.');
        onCross({
          ...calibration,
          method: 'motion-fallback',
          confidence: 0,
          landmarkUsed: 'foreground motion fallback',
          timestampMs: fallbackSample.timestampMs,
          fallbackMotion: roundMetric(fallbackSample.motion)
        });
        this.stop();
      }
    }

    this.isProcessingFrame = false;
  }

  private handlePoseSample(
    sample: TorsoSample,
    calibration: FinishLineCalibration,
    onCross: (result: FinishLineDetectionResult) => void
  ) {
    this.lastPoseTimestampMs = sample.timestampMs;
    this.validPoseFrames += 1;
    this.smoothedTorsoX =
      this.smoothedTorsoX === null
        ? sample.x
        : this.smoothedTorsoX * (1 - this.smoothingAlpha) +
          sample.x * this.smoothingAlpha;

    const armedLine = this.markerPosition + this.hysteresis;
    const crossedLine = this.markerPosition - this.hysteresis;

    if (this.smoothedTorsoX > armedLine) {
      this.hasStartedBeforeLine = true;
    }

    if (
      this.hasStartedBeforeLine &&
      this.validPoseFrames >= this.minValidPoseFrames &&
      this.smoothedTorsoX <= crossedLine
    ) {
      this.hasDetected = true;
      onCross({
        ...calibration,
        method: 'pose-landmarker',
        confidence: roundMetric(sample.confidence),
        landmarkUsed: sample.landmarkUsed,
        torsoX: roundMetric(this.smoothedTorsoX),
        timestampMs: sample.timestampMs
      });
      this.stop();
    }
  }

  private async samplePoseTorso(video: HTMLVideoElement): Promise<TorsoSample | null> {
    const poseLandmarker = await this.getPoseLandmarker();
    const timestampMs = Math.round(video.currentTime * 1000 || performance.now());
    const result = poseLandmarker.detectForVideo(video, timestampMs);
    const landmarks = result.landmarks[0];

    if (!landmarks) {
      return null;
    }

    return getTorsoSample(landmarks, timestampMs, this.minLandmarkVisibility);
  }

  private sampleFallbackMotion(video: HTMLVideoElement): FallbackSample | null {
    const frame = this.captureFallbackBand(video);
    if (!frame) {
      return null;
    }

    const timestampMs = Math.round(video.currentTime * 1000 || performance.now());
    if (!this.previousFallbackFrame) {
      this.previousFallbackFrame = frame;
      return {
        motion: 0,
        timestampMs
      };
    }

    let motionSum = 0;
    for (let index = 0; index < frame.length; index += 1) {
      motionSum += Math.abs(frame[index] - this.previousFallbackFrame[index]);
    }

    this.previousFallbackFrame = frame;

    return {
      motion: motionSum / Math.max(frame.length, 1),
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

    const bandWidth = Math.max(
      24,
      Math.floor(video.videoWidth * this.fallbackBandWidthRatio)
    );
    const markerX = Math.min(
      video.videoWidth - 1,
      Math.max(0, Math.floor(video.videoWidth * this.markerPosition))
    );
    const bandStart = Math.max(0, markerX - Math.floor(bandWidth / 2));
    const actualBandWidth = Math.max(
      1,
      Math.min(bandWidth, video.videoWidth - bandStart)
    );
    const image = this.context.getImageData(
      bandStart,
      0,
      actualBandWidth,
      video.videoHeight
    );
    const gray = new Uint8Array(actualBandWidth * video.videoHeight);

    for (let index = 0, target = 0; index < image.data.length; index += 4) {
      gray[target] = Math.round(
        image.data[index] * 0.299 +
          image.data[index + 1] * 0.587 +
          image.data[index + 2] * 0.114
      );
      target += 1;
    }

    return gray;
  }

  private shouldUseFallback(nowMs: number) {
    if (this.lastPoseTimestampMs === null) {
      return true;
    }

    return nowMs - this.lastPoseTimestampMs > this.poseLostGraceMs;
  }

  private async getPoseLandmarker() {
    if (!poseLandmarkerPromise) {
      poseLandmarkerPromise = FilesetResolver.forVisionTasks(this.wasmRoot).then(
        async (vision) => {
          const options = {
            baseOptions: {
              modelAssetPath: this.modelAssetPath,
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
            outputSegmentationMasks: false
          } as const;

          try {
            return await PoseLandmarker.createFromOptions(vision, options);
          } catch {
            return PoseLandmarker.createFromOptions(vision, {
              ...options,
              baseOptions: {
                modelAssetPath: this.modelAssetPath,
                delegate: 'CPU'
              }
            });
          }
        }
      );
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

export class MotionBandFinishLineDetector extends PoseFinishLineDetector {}

function getTorsoSample(
  landmarks: NormalizedLandmark[],
  timestampMs: number,
  minVisibility: number
): TorsoSample | null {
  const candidates = [
    {
      names: 'shoulders+hips torso center',
      points: [
        landmarks[LEFT_SHOULDER],
        landmarks[RIGHT_SHOULDER],
        landmarks[LEFT_HIP],
        landmarks[RIGHT_HIP]
      ]
    },
    {
      names: 'hip center',
      points: [landmarks[LEFT_HIP], landmarks[RIGHT_HIP]]
    },
    {
      names: 'shoulder center',
      points: [landmarks[LEFT_SHOULDER], landmarks[RIGHT_SHOULDER]]
    }
  ];

  for (const candidate of candidates) {
    const visiblePoints = candidate.points.filter(
      (point) => (point?.visibility ?? 0) >= minVisibility
    );

    if (visiblePoints.length === candidate.points.length) {
      const x =
        visiblePoints.reduce((sum, point) => sum + point.x, 0) /
        visiblePoints.length;
      const confidence =
        visiblePoints.reduce((sum, point) => sum + (point.visibility ?? 0), 0) /
        visiblePoints.length;

      return {
        x,
        confidence,
        landmarkUsed: candidate.names,
        timestampMs
      };
    }
  }

  return null;
}

function roundMetric(value: number) {
  return Number(value.toFixed(3));
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
