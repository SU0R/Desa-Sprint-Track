export type FinishLineCalibration = {
  baselineMotion: number;
  threshold: number;
  markerPosition: number;
  samples: number;
};

export type FinishLineDetectionResult = FinishLineCalibration & {
  detectedMotion: number;
};

export type FinishLineDetectorConfig = {
  markerPosition: number;
  bandWidthPx?: number;
  rowStep?: number;
  calibrationMargin?: number;
  minimumThreshold?: number;
  sampleIntervalMs?: number;
  consecutiveDetections?: number;
};

type DetectOptions = {
  video: HTMLVideoElement;
  calibration: FinishLineCalibration;
  onCross: (result: FinishLineDetectionResult) => void;
};

const DEFAULT_BAND_WIDTH_PX = 10;
const DEFAULT_ROW_STEP = 4;
const DEFAULT_CALIBRATION_MARGIN = 18;
const DEFAULT_MINIMUM_THRESHOLD = 35;
const DEFAULT_SAMPLE_INTERVAL_MS = 90;
const DEFAULT_CONSECUTIVE_DETECTIONS = 2;

export class MotionBandFinishLineDetector {
  private readonly markerPosition: number;
  private readonly bandWidthPx: number;
  private readonly rowStep: number;
  private readonly calibrationMargin: number;
  private readonly minimumThreshold: number;
  private readonly sampleIntervalMs: number;
  private readonly consecutiveDetections: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D | null;
  private detectInterval: number | null = null;
  private previousBand: Uint8Array | null = null;
  private consecutiveHits = 0;
  private hasDetected = false;

  constructor(config: FinishLineDetectorConfig) {
    this.markerPosition = config.markerPosition;
    this.bandWidthPx = config.bandWidthPx ?? DEFAULT_BAND_WIDTH_PX;
    this.rowStep = config.rowStep ?? DEFAULT_ROW_STEP;
    this.calibrationMargin = config.calibrationMargin ?? DEFAULT_CALIBRATION_MARGIN;
    this.minimumThreshold = config.minimumThreshold ?? DEFAULT_MINIMUM_THRESHOLD;
    this.sampleIntervalMs = config.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;
    this.consecutiveDetections =
      config.consecutiveDetections ?? DEFAULT_CONSECUTIVE_DETECTIONS;
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  async calibrate(
    video: HTMLVideoElement,
    durationMs: number
  ): Promise<FinishLineCalibration> {
    this.stop();
    this.previousBand = null;

    const samples: number[] = [];
    const endAt = performance.now() + durationMs;

    while (performance.now() < endAt) {
      const motion = this.sampleMotion(video);
      if (motion !== null) {
        samples.push(motion);
      }

      await wait(this.sampleIntervalMs);
    }

    const average =
      samples.length > 0
        ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length
        : 0;
    const peak = samples.length > 0 ? Math.max(...samples) : 0;
    const threshold = Math.max(
      this.minimumThreshold,
      average + this.calibrationMargin,
      peak * 1.25
    );

    this.previousBand = null;

    return {
      baselineMotion: roundMotion(average),
      threshold: roundMotion(threshold),
      markerPosition: this.markerPosition,
      samples: samples.length
    };
  }

  start({ video, calibration, onCross }: DetectOptions) {
    this.stop();
    this.previousBand = null;
    this.consecutiveHits = 0;
    this.hasDetected = false;

    this.detectInterval = window.setInterval(() => {
      if (this.hasDetected) {
        return;
      }

      const motion = this.sampleMotion(video);
      if (motion === null) {
        return;
      }

      if (motion >= calibration.threshold) {
        this.consecutiveHits += 1;
      } else {
        this.consecutiveHits = 0;
      }

      if (this.consecutiveHits >= this.consecutiveDetections) {
        this.hasDetected = true;
        onCross({
          ...calibration,
          detectedMotion: roundMotion(motion)
        });
        this.stop();
      }
    }, this.sampleIntervalMs);
  }

  stop() {
    if (this.detectInterval !== null) {
      window.clearInterval(this.detectInterval);
      this.detectInterval = null;
    }

    this.previousBand = null;
    this.consecutiveHits = 0;
    this.hasDetected = false;
  }

  private sampleMotion(video: HTMLVideoElement) {
    const band = this.captureBand(video);
    if (!band) {
      return null;
    }

    if (!this.previousBand) {
      this.previousBand = band;
      return 0;
    }

    let motionSum = 0;

    for (let index = 0; index < band.length; index += 1) {
      motionSum += Math.abs(band[index] - this.previousBand[index]);
    }

    this.previousBand = band;

    return motionSum / Math.max(band.length, 1);
  }

  private captureBand(video: HTMLVideoElement) {
    if (!this.context || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
    this.context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const markerX = Math.min(
      video.videoWidth - 1,
      Math.max(0, Math.floor(video.videoWidth * this.markerPosition))
    );
    const bandStart = Math.max(0, markerX - Math.floor(this.bandWidthPx / 2));
    const bandWidth = Math.max(
      1,
      Math.min(this.bandWidthPx, video.videoWidth - bandStart)
    );
    const image = this.context.getImageData(
      bandStart,
      0,
      bandWidth,
      video.videoHeight
    );
    const rows = Math.ceil(video.videoHeight / this.rowStep);
    const band = new Uint8Array(rows * bandWidth);

    let targetIndex = 0;
    for (let y = 0; y < video.videoHeight; y += this.rowStep) {
      for (let x = 0; x < bandWidth; x += 1) {
        const pixelIndex = (y * bandWidth + x) * 4;
        band[targetIndex] = Math.round(
          image.data[pixelIndex] * 0.299 +
            image.data[pixelIndex + 1] * 0.587 +
            image.data[pixelIndex + 2] * 0.114
        );
        targetIndex += 1;
      }
    }

    return band;
  }
}

function roundMotion(value: number) {
  return Number(value.toFixed(2));
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
