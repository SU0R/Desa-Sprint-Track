'use client';

import { useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PoseFinishLineDetector,
  type FinishLineCalibration,
  type FinishLineDetectionResult
} from '@/services/camera/finish-line-detector';
import { formatSeconds } from '@/lib/format';

const TEST_MARKER_POSITION = 0.72;

export function VideoDetectorTestPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectorRef = useRef<PoseFinishLineDetector | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Choose a local sprint video to test.');
  const [calibration, setCalibration] = useState<FinishLineCalibration | null>(
    null
  );
  const [result, setResult] = useState<FinishLineDetectionResult | null>(null);

  const getDetector = () => {
    if (!detectorRef.current) {
      detectorRef.current = new PoseFinishLineDetector({
        markerPosition: TEST_MARKER_POSITION,
        sampleIntervalMs: 45
      });
    }

    return detectorRef.current;
  };

  const stop = () => {
    detectorRef.current?.stop();
    videoRef.current?.pause();
  };

  return (
    <div className="space-y-6">
      <Card className="glass-panel border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-3xl text-white">
            Finish detector video test
          </CardTitle>
          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
            Local video harness
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Load a local video, then run the same pose-first detector used by the
            live timer. The result reports the detected crossing timestamp and
            whether pose or fallback motion was used.
          </p>

          <input
            type="file"
            accept="video/*"
            className="block w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              if (videoUrl) {
                URL.revokeObjectURL(videoUrl);
              }

              setVideoUrl(URL.createObjectURL(file));
              setCalibration(null);
              setResult(null);
              setStatus(`Loaded ${file.name}. Run detector when ready.`);
            }}
          />

          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                muted
                playsInline
                className="aspect-video w-full object-contain"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
                No video selected.
              </div>
            )}
            <div className="pointer-events-none absolute inset-y-0 right-[28%] w-[4px] bg-primary/90 shadow-[0_0_18px_rgba(43,214,122,0.5)]" />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!videoUrl}
              onClick={async () => {
                const video = videoRef.current;
                if (!video) {
                  return;
                }

                stop();
                video.currentTime = 0;
                setResult(null);
                setStatus('Calibrating first 1.5 seconds of the selected video.');

                const detector = getDetector();
                await video.play();
                const nextCalibration = await detector.calibrate(
                  video,
                  1500,
                  setStatus
                );
                video.pause();
                video.currentTime = 0;
                setCalibration(nextCalibration);
                setStatus('Playing video and watching for torso crossing.');

                await video.play();
                detector.start({
                  video,
                  calibration: nextCalibration,
                  onStatus: setStatus,
                  onCross: (detection) => {
                    video.pause();
                    setResult(detection);
                    setStatus(
                      `Detected ${detection.method} crossing at ${formatSeconds(
                        detection.timestampMs / 1000
                      )}.`
                    );
                  }
                });
              }}
            >
              Run detector
            </Button>
            <Button
              variant="outline"
              className="border-white/10 bg-white/[0.04]"
              onClick={() => {
                stop();
                setStatus('Detector stopped.');
              }}
            >
              Stop
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl text-white">Detector report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{status}</p>
          {calibration ? (
            <p>
              Calibration: pose {calibration.poseReady ? 'ready' : 'unavailable'},
              fallback threshold {calibration.threshold}, samples{' '}
              {calibration.samples}.
            </p>
          ) : null}
          {result ? (
            <p>
              Result: {result.method}, timestamp{' '}
              {formatSeconds(result.timestampMs / 1000)}, confidence{' '}
              {result.confidence}, landmark {result.landmarkUsed}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
